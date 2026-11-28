import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction, CashTransactionType, PaymentMethod } from '@prisma/client';

/**
 * Résout proprement la date d'une écriture de caisse :
 * - Si une date seule "YYYY-MM-DD" est envoyée depuis un <input type="date">,
 *   on la combine avec l'heure réelle courante (heures/minutes/secondes) au lieu
 *   de 00:00:00Z (qui provoquait un affichage erroné "01:00" en UTC+1).
 */
function resolveTransactionDate(raw?: string | Date | null): Date {
  const now = new Date();
  if (!raw) return now;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? now : raw;
  const trimmed = String(raw).trim();
  if (!trimmed) return now;
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    return new Date(y, m, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? now : parsed;
}

function isClinicPharmacyCategory(cat?: string | null): boolean {
  return cat === 'Dépense Clinique (Pharmacie)' || cat === 'Dépense Dentisterie (Pharmacie)';
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Seuls les administrateurs, comptables et accueil (petite caisse) ont accès
  if (
    session.role !== 'SUPER_ADMIN' &&
    session.role !== 'CLINIC_ADMIN' &&
    session.role !== 'ACCOUNTANT' &&
    session.role !== 'RECEPTIONIST'
  ) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  const isReceptionist = session.role === 'RECEPTIONIST';

  try {
    const [
      expenses,
      payrollSlips,
      clinicRequisitions,
      staffUsers,
      employees,
      medicines,
      dentalConsultations,
      dentalCashTransactions,
    ] = await Promise.all([
      // 1. Mouvements de caisse : Cloisonnement strict pour l'Accueil (RECEPTIONIST ne voit que Petite Caisse + Petite Caisse Week-end)
      prisma.cashTransaction.findMany({
        where: isReceptionist
          ? {
              clinicId: session.clinicId,
              cashRegister: { in: ['PETITE_CAISSE', 'PETITE_CAISSE_WEEKEND'] },
            }
          : {
              clinicId: session.clinicId,
            },
        include: {
          performedBy: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { transactionDate: 'desc' },
        take: 500,
      }),

      // 2. Fiches de paie du personnel (Confidentiel : masqué pour la réception)
      isReceptionist
        ? Promise.resolve([])
        : prisma.payrollSlip.findMany({
            where: { clinicId: session.clinicId },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  role: { select: { displayName: true, name: true } },
                },
              },
              employee: true,
            },
            orderBy: { paymentDate: 'desc' },
            take: 200,
          }),

      // 3. Prélèvements de médicaments pour la clinique
      prisma.clinicMedicineRequisition.findMany({
        where: { clinicId: session.clinicId },
        orderBy: { date: 'desc' },
        take: 100,
      }),

      // 4. Liste de tous les comptes utilisateurs actifs
      prisma.user.findMany({
        where: {
          clinicId: session.clinicId,
          isActive: true,
        },
        include: {
          role: { select: { id: true, name: true, displayName: true } },
          doctorProfile: { select: { specialtyName: true } },
        },
        orderBy: { lastName: 'asc' },
      }),

      // 4b. Liste complète des Employés de la clinique (Table Employee)
      prisma.employee.findMany({
        where: { clinicId: session.clinicId },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),

      // 5. Médicaments en stock pour le prélèvement clinique
      prisma.medicine.findMany({
        where: { clinicId: session.clinicId, isActive: true },
        select: {
          id: true,
          name: true,
          dosage: true,
          form: true,
          currentStock: true,
          purchasePrice: true,
          sellingPrice: true,
        },
        orderBy: { name: 'asc' },
      }),

      // 6. Consultations / Actes dentaires (Entrées d'argent Dentisterie)
      prisma.consultation.findMany({
        where: {
          patient: { clinicId: session.clinicId },
          OR: [
            { reason: { contains: 'dent' } },
            { reason: { contains: 'carie' } },
            { reason: { contains: 'stomat' } },
            { reason: { contains: 'détartr' } },
            { reason: { contains: 'detartr' } },
            { reason: { contains: 'odont' } },
            { doctor: { specialty: { name: { contains: 'dent' } } } },
          ],
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
          doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialty: true } },
          invoice: { include: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),

      // 7. Transactions directes de la Dentisterie (Entrées & Sorties)
      prisma.cashTransaction.findMany({
        where: {
          clinicId: session.clinicId,
          OR: [
            { category: { contains: 'Dent' } },
            { description: { contains: 'dent' } },
            { description: { contains: 'carie' } },
          ],
        },
        include: {
          performedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { transactionDate: 'desc' },
        take: 100,
      }),
    ]);

    // Calculs de synthèse globale
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPayroll = payrollSlips.reduce((sum, p) => sum + p.netSalary, 0);
    const totalClinicRequisitions = clinicRequisitions.reduce((sum, r) => sum + r.totalCost, 0);

    // Bilan financier spécifique Dentisterie
    const dentalRequisitions = clinicRequisitions.filter((r) =>
      (r.department || '').toLowerCase().includes('dent')
    );

    const dentalConsultationsIncome = dentalConsultations.reduce(
      (sum: number, c: any) => sum + (c.invoice?.totalAmount ? Number(c.invoice.totalAmount) : 0),
      0
    );

    const dentalDirectIncome = dentalCashTransactions
      .filter((t: any) => t.type === CashTransactionType.INCOME)
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const totalDentalIncome = dentalConsultationsIncome + dentalDirectIncome;

    const dentalRequisitionsExpenses = dentalRequisitions.reduce(
      (sum: number, r: any) => sum + Number(r.totalCost),
      0
    );

    const dentalDirectExpenses = dentalCashTransactions
      .filter((t: any) => t.type === CashTransactionType.EXPENSE)
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const totalDentalExpenses = dentalRequisitionsExpenses + dentalDirectExpenses;
    const dentalNetMargin = totalDentalIncome - totalDentalExpenses;

    return NextResponse.json({
      expenses,
      payrollSlips,
      clinicRequisitions,
      staffUsers,
      employees,
      medicines,
      dentalConsultations,
      dentalRequisitions,
      dentistry: {
        totalIncome: totalDentalIncome,
        totalExpenses: totalDentalExpenses,
        netMargin: dentalNetMargin,
        countIncome: dentalConsultations.length,
        countRequisitions: dentalRequisitions.length,
        consultations: dentalConsultations,
        requisitions: dentalRequisitions,
        transactions: dentalCashTransactions,
      },
      stats: {
        totalExpenses,
        totalPayroll,
        totalClinicRequisitions,
        countExpenses: expenses.length,
        countPayroll: payrollSlips.length,
        countRequisitions: clinicRequisitions.length,
      },
    });
  } catch (error: any) {
    console.error('Fetch expenses error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const isReceptionist = session.role === 'RECEPTIONIST';
  const isAdminOrAccountant =
    session.role === 'SUPER_ADMIN' || session.role === 'CLINIC_ADMIN' || session.role === 'ACCOUNTANT';

  if (!isAdminOrAccountant && !isReceptionist) {
    return NextResponse.json({ error: 'Accès non autorisé aux sorties de caisse' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    // Seuls les administrateurs et comptables peuvent émettre les salaires
    if (action === 'PAYROLL_SLIP' && !isAdminOrAccountant) {
      return NextResponse.json({ error: 'La gestion des salaires est réservée à la direction.' }, { status: 403 });
    }

    // =========================================================================
    // CAS 0b : CONFIGURATION & MODIFICATION DE LA BANQUE (NOM, RIB, SOLDE INITIAL)
    // =========================================================================
    if (action === 'UPDATE_BANK_SETTINGS') {
      if (!isAdminOrAccountant) {
        return NextResponse.json({ error: 'La configuration bancaire est réservée aux administrateurs.' }, { status: 403 });
      }

      const { bankName, bankRib, bankHolder, initialAmount } = body;

      const numInitial = parseFloat(initialAmount);
      if (isNaN(numInitial) || numInitial < 0) {
        return NextResponse.json({ error: 'Le montant du solde initial doit être positif ou égal à zéro.' }, { status: 400 });
      }

      const nameToSave = (bankName || 'Banque').trim();
      const ribToSave = (bankRib || '').trim();
      const holderToSave = (bankHolder || 'Clinique Betesda').trim();

      const [updatedSettings, initialTx] = await prisma.$transaction(async (tx) => {
        // 1. Sauvegarde des paramètres dans Setting
        const settingsToUpsert = [
          { key: 'bank_name', value: nameToSave },
          { key: 'bank_rib', value: ribToSave },
          { key: 'bank_holder', value: holderToSave },
        ];

        for (const s of settingsToUpsert) {
          await tx.setting.upsert({
            where: {
              clinicId_key: { clinicId: session.clinicId, key: s.key },
            },
            create: {
              clinicId: session.clinicId,
              key: s.key,
              value: s.value,
              category: 'bank',
            },
            update: {
              value: s.value,
            },
          });
        }

        // 2. Mise à jour ou création de la transaction d'ouverture BQ-INIT-001
        let bqInit = await tx.cashTransaction.findFirst({
          where: { clinicId: session.clinicId, reference: 'BQ-INIT-001' },
        });

        const desc = `Solde d'ouverture et fonds de roulement du compte bancaire (${nameToSave}${ribToSave ? ` - N° ${ribToSave}` : ''})`;

        if (bqInit) {
          bqInit = await tx.cashTransaction.update({
            where: { id: bqInit.id },
            data: {
              amount: numInitial,
              description: desc,
              performedById: session.id,
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });
        } else {
          bqInit = await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.INCOME,
              category: 'Capital & Solde Bancaire Initial',
              amount: numInitial,
              paymentMethod: PaymentMethod.BANK_TRANSFER,
              reference: 'BQ-INIT-001',
              description: desc,
              cashRegister: 'BANQUE',
              performedById: session.id,
              transactionDate: new Date('2026-10-01T08:00:00Z'),
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });
        }

        return [{ bank_name: nameToSave, bank_rib: ribToSave, bank_holder: holderToSave }, bqInit];
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.UPDATE,
        entity: 'BankSettings',
        entityId: session.clinicId,
        details: `Mise à jour des coordonnées bancaires : ${nameToSave} (Solde initial : ${numInitial} Ar) par ${session.firstName} ${session.lastName}`,
      });

      return NextResponse.json({
        success: true,
        bankSettings: updatedSettings,
        initialTransaction: initialTx,
      });
    }

    // =========================================================================
    // CAS 0 : VERSEMENTS & TRANSFERTS INTER-COMPTES (Petite Caisse, Grande Caisse, Banque)
    // =========================================================================
    if (action === 'CASH_TRANSFER') {
      const {
        transferType = 'PETITE_CAISSE_TO_GRANDE_CAISSE',
        amount,
        senderName,
        receiverName,
        notes,
        attachmentUrl,
        attachmentName,
        transferDate,
      } = body;

      const numAmount = parseFloat(amount);
      if (!numAmount || numAmount <= 0) {
        return NextResponse.json({ error: 'Le montant du transfert doit être supérieur à zéro.' }, { status: 400 });
      }

      // Seul l'administrateur ou le comptable peut effectuer des opérations bancaires
      if ((transferType === 'GRANDE_CAISSE_TO_BANQUE' || transferType === 'BANQUE_TO_GRANDE_CAISSE') && !isAdminOrAccountant) {
        return NextResponse.json({ error: 'Les opérations bancaires sont réservées à la direction de la clinique.' }, { status: 403 });
      }

      const txDate = resolveTransactionDate(transferDate);
      const currentYear = new Date().getFullYear();
      const operatorName = `${session.firstName} ${session.lastName}`.trim();

      // -----------------------------------------------------------------------
      // TYPE A : VERSEMENT PETITE CAISSE -> GRANDE CAISSE (ACCUEIL VERS ADMIN)
      // -----------------------------------------------------------------------
      if (transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE') {
        const petiteTxs = await prisma.cashTransaction.findMany({
          where: {
            clinicId: session.clinicId,
            cashRegister: 'PETITE_CAISSE',
          },
          select: { type: true, amount: true, category: true },
        });
        const petiteIncome = petiteTxs
          .filter((t) => t.type === CashTransactionType.INCOME)
          .reduce((s, t) => s + t.amount, 0);
        const petiteExpenses = petiteTxs
          .filter(
            (t) =>
              t.type === CashTransactionType.EXPENSE &&
              t.category !== 'Salaires & Paie' &&
              !isClinicPharmacyCategory(t.category)
          )
          .reduce((s, t) => s + t.amount, 0);
        const currentAvailable = petiteIncome - petiteExpenses;

        if (numAmount > currentAvailable) {
          return NextResponse.json({
            error: `Le montant à verser (${numAmount.toLocaleString()} Ar) ne peut pas dépasser le solde disponible en Petite Caisse (${Math.max(0, currentAvailable).toLocaleString()} Ar). Le solde de caisse ne peut pas être négatif.`,
          }, { status: 400 });
        }

        const count = await prisma.cashTransaction.count({
          where: { clinicId: session.clinicId, reference: { startsWith: 'VERS-' } },
        });
        const transferRef = `VERS-${currentYear}-${String(count + 1).padStart(4, '0')}`;
        // Donneur d'ordre / Émetteur figé sur le nom de la personne connectée
        const sender = operatorName;
        const receiver = receiverName || 'Direction Clinique / Comptabilité';

        const result = await prisma.$transaction(async (tx) => {
          const outTx = await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.EXPENSE,
              category: 'Versement vers Grande Caisse',
              amount: numAmount,
              paymentMethod: PaymentMethod.CASH,
              reference: transferRef,
              description: `Versement Petite Caisse ➔ Grande Caisse (${transferRef}) | Remettant : ${sender} ➔ Récepteur : ${receiver} | Opérateur : ${operatorName}${notes ? ` | Motif : ${notes}` : ''}`,
              transactionDate: txDate,
              performedById: session.id,
              attachmentUrl: attachmentUrl || null,
              attachmentName: attachmentName || null,
              cashRegister: 'PETITE_CAISSE',
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });

          const inTx = await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.INCOME,
              category: 'Versement reçu de la Petite Caisse',
              amount: numAmount,
              paymentMethod: PaymentMethod.CASH,
              reference: transferRef,
              description: `Encaissement Versement Petite Caisse (${transferRef}) | Récepteur : ${receiver} de la part de : ${sender} | Opérateur : ${operatorName}${notes ? ` | Motif : ${notes}` : ''}`,
              transactionDate: txDate,
              performedById: session.id,
              attachmentUrl: attachmentUrl || null,
              attachmentName: attachmentName || null,
              cashRegister: 'GRANDE_CAISSE',
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });

          return { outTx, inTx, transferRef, transferType };
        });

        await logAuditAction({
          clinicId: session.clinicId,
          userId: session.id,
          action: AuditAction.CREATE,
          entity: 'CashTransaction',
          entityId: result.outTx.id,
          details: `Versement inter-caisses de ${numAmount} Ar de Petite Caisse vers Grande Caisse (${result.transferRef})`,
        });

        return NextResponse.json({ success: true, transfer: result });
      }

      // -----------------------------------------------------------------------
      // TYPE B : GRANDE CAISSE -> BANQUE (DÉPÔT D'ESPÈCES AU COMPTE BANCAIRE)
      // -----------------------------------------------------------------------
      if (transferType === 'GRANDE_CAISSE_TO_BANQUE') {
        const grandeTxs = await prisma.cashTransaction.findMany({
          where: { clinicId: session.clinicId, cashRegister: 'GRANDE_CAISSE' },
          select: { type: true, amount: true },
        });
        const grandeIncome = grandeTxs.filter((t) => t.type === CashTransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
        const grandeExpenses = grandeTxs.filter((t) => t.type === CashTransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
        const currentGrandeAvailable = grandeIncome - grandeExpenses;

        if (numAmount > currentGrandeAvailable) {
          return NextResponse.json({
            error: `Le montant à déposer en banque (${numAmount.toLocaleString()} Ar) ne peut pas dépasser le solde disponible au coffre Grande Caisse (${Math.max(0, currentGrandeAvailable).toLocaleString()} Ar).`,
          }, { status: 400 });
        }

        const countBq = await prisma.cashTransaction.count({
          where: { clinicId: session.clinicId, reference: { startsWith: 'DEP-BQ' } },
        });
        const transferRef = `DEP-BQ-${currentYear}-${String(countBq + 1).padStart(4, '0')}`;
        const sender = operatorName; // Figé sur le nom de la personne connectée
        const receiver = receiverName || 'Banque';

        const result = await prisma.$transaction(async (tx) => {
          const outTx = await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.EXPENSE,
              category: 'Dépôt Bancaire (Grande Caisse ➔ Banque)',
              amount: numAmount,
              paymentMethod: PaymentMethod.CASH,
              reference: transferRef,
              description: `Dépôt bancaire d'espèces Grande Caisse ➔ Banque (${transferRef}) | Déposant : ${sender} ➔ Compte : ${receiver} | Opérateur : ${operatorName}${notes ? ` | Motif : ${notes}` : ''}`,
              transactionDate: txDate,
              performedById: session.id,
              attachmentUrl: attachmentUrl || null,
              attachmentName: attachmentName || null,
              cashRegister: 'GRANDE_CAISSE',
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });

          const inTx = await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.INCOME,
              category: 'Dépôt d’espèces en Banque',
              amount: numAmount,
              paymentMethod: PaymentMethod.BANK_TRANSFER,
              reference: transferRef,
              description: `Crédit Compte Bancaire (${transferRef}) | Dépôt espèces reçu de la Grande Caisse par : ${sender} | Opérateur : ${operatorName}${notes ? ` | Motif : ${notes}` : ''}`,
              transactionDate: txDate,
              performedById: session.id,
              attachmentUrl: attachmentUrl || null,
              attachmentName: attachmentName || null,
              cashRegister: 'BANQUE',
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });

          return { outTx, inTx, transferRef, transferType };
        });

        await logAuditAction({
          clinicId: session.clinicId,
          userId: session.id,
          action: AuditAction.CREATE,
          entity: 'CashTransaction',
          entityId: result.outTx.id,
          details: `Dépôt bancaire de ${numAmount} Ar de Grande Caisse vers Banque (${result.transferRef})`,
        });

        return NextResponse.json({ success: true, transfer: result });
      }

      // -----------------------------------------------------------------------
      // TYPE C : BANQUE -> GRANDE CAISSE (RETRAIT BANCAIRE / APPROVISIONNEMENT COFFRE)
      // -----------------------------------------------------------------------
      if (transferType === 'BANQUE_TO_GRANDE_CAISSE') {
        const bqTxs = await prisma.cashTransaction.findMany({
          where: { clinicId: session.clinicId, cashRegister: 'BANQUE' },
          select: { type: true, amount: true },
        });
        const bqIncome = bqTxs.filter((t) => t.type === CashTransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
        const bqExpenses = bqTxs.filter((t) => t.type === CashTransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
        const currentBqAvailable = bqIncome - bqExpenses;

        if (numAmount > currentBqAvailable) {
          return NextResponse.json({
            error: `Le montant du retrait bancaire (${numAmount.toLocaleString()} Ar) ne peut pas dépasser le solde disponible sur le compte bancaire (${Math.max(0, currentBqAvailable).toLocaleString()} Ar).`,
          }, { status: 400 });
        }

        const countRet = await prisma.cashTransaction.count({
          where: { clinicId: session.clinicId, reference: { startsWith: 'RET-BQ' } },
        });
        const transferRef = `RET-BQ-${currentYear}-${String(countRet + 1).padStart(4, '0')}`;
        const sender = senderName || 'Banque';
        const receiver = receiverName || `${session.firstName} ${session.lastName}`;

        const result = await prisma.$transaction(async (tx) => {
          const outTx = await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.EXPENSE,
              category: 'Retrait Bancaire vers Grande Caisse',
              amount: numAmount,
              paymentMethod: PaymentMethod.BANK_TRANSFER,
              reference: transferRef,
              description: `Débit Compte Bancaire (${transferRef}) | Retrait de fonds pour approvisionner le coffre Grande Caisse | Bénéficiaire : ${receiver} | Opérateur : ${operatorName}${notes ? ` | Motif : ${notes}` : ''}`,
              transactionDate: txDate,
              performedById: session.id,
              attachmentUrl: attachmentUrl || null,
              attachmentName: attachmentName || null,
              cashRegister: 'BANQUE',
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });

          const inTx = await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.INCOME,
              category: 'Approvisionnement depuis Banque',
              amount: numAmount,
              paymentMethod: PaymentMethod.CASH,
              reference: transferRef,
              description: `Alimentation Grande Caisse (${transferRef}) | Retrait effectué sur le compte bancaire par : ${sender} ➔ Réceptionné par : ${receiver} | Opérateur : ${operatorName}${notes ? ` | Motif : ${notes}` : ''}`,
              transactionDate: txDate,
              performedById: session.id,
              attachmentUrl: attachmentUrl || null,
              attachmentName: attachmentName || null,
              cashRegister: 'GRANDE_CAISSE',
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });

          return { outTx, inTx, transferRef, transferType };
        });

        await logAuditAction({
          clinicId: session.clinicId,
          userId: session.id,
          action: AuditAction.CREATE,
          entity: 'CashTransaction',
          entityId: result.outTx.id,
          details: `Retrait bancaire de ${numAmount} Ar vers Grande Caisse (${result.transferRef})`,
        });

        return NextResponse.json({ success: true, transfer: result });
      }

      // -----------------------------------------------------------------------
      // TYPE D : VERSEMENT PETITE CAISSE WEEK-END (ACCUEIL) -> GRANDE CAISSE WEEK-END
      // -----------------------------------------------------------------------
      // 4. TRANSFERT PETITE CAISSE (ACTES SPÉCIFIQUES & WEEK-END) ➔ GRANDE CAISSE (BUDGET ACTES SPÉCIFIQUES)
      if (transferType === 'WEEKEND_PETITE_TO_WEEKEND_GRANDE' || transferType === 'SPECIFIC_PETITE_TO_GRANDE') {
        const wePetiteTxs = await prisma.cashTransaction.findMany({
          where: {
            clinicId: session.clinicId,
            cashRegister: 'PETITE_CAISSE_WEEKEND',
          },
          select: { type: true, amount: true },
        });
        const wePetiteIn = wePetiteTxs
          .filter((t) => t.type === CashTransactionType.INCOME)
          .reduce((s, t) => s + t.amount, 0);
        const wePetiteOut = wePetiteTxs
          .filter((t) => t.type === CashTransactionType.EXPENSE)
          .reduce((s, t) => s + t.amount, 0);
        const currentWePetiteAvailable = wePetiteIn - wePetiteOut;

        if (numAmount > currentWePetiteAvailable) {
          return NextResponse.json(
            {
              error: `Le montant à verser (${numAmount.toLocaleString('fr-FR')} Ar) dépasse le solde disponible en Actes Spécifiques Petite Caisse (${Math.max(0, currentWePetiteAvailable).toLocaleString('fr-FR')} Ar).`,
            },
            { status: 400 }
          );
        }

        const countWe = await prisma.cashTransaction.count({
          where: {
            clinicId: session.clinicId,
            OR: [
              { reference: { startsWith: 'VERS-WE-' } },
              { reference: { startsWith: 'VERS-SPEC-' } },
            ],
          },
        });
        const transferRef = `VERS-SPEC-${currentYear}-${String(countWe + 1).padStart(4, '0')}`;
        const sender = operatorName; // Figé par le nom de l'utilisateur connecté
        const receiver = receiverName || 'Grande Caisse (Direction / Comptabilité)';

        const result = await prisma.$transaction(async (tx) => {
          const outTx = await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.EXPENSE,
              category: 'Versement Actes Spécifiques vers Grande Caisse',
              amount: numAmount,
              paymentMethod: PaymentMethod.CASH,
              reference: transferRef,
              description: `Versement Actes Spécifiques (${transferRef}) | Remettant : ${sender} ➔ Récepteur : ${receiver} | Opérateur : ${operatorName}${notes ? ` | Motif : ${notes}` : ''}`.slice(0, 255),
              transactionDate: txDate,
              performedById: session.id,
              attachmentUrl: attachmentUrl || null,
              attachmentName: attachmentName || null,
              cashRegister: 'PETITE_CAISSE_WEEKEND',
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });

          const inTx = await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.INCOME,
              category: 'Versement Actes Spécifiques reçu de la Petite Caisse',
              amount: numAmount,
              paymentMethod: PaymentMethod.CASH,
              reference: transferRef,
              description: `Versement Actes Spécifiques reçu (${transferRef}) | Récepteur : ${receiver} de la part de : ${sender} | Opérateur : ${operatorName}${notes ? ` | Motif : ${notes}` : ''}`.slice(0, 255),
              transactionDate: txDate,
              performedById: session.id,
              attachmentUrl: attachmentUrl || null,
              attachmentName: attachmentName || null,
              cashRegister: 'CONSULTATION_WEEKEND',
            },
            include: { performedBy: { select: { firstName: true, lastName: true } } },
          });

          return { outTx, inTx, transferRef, transferType };
        });

        await logAuditAction({
          clinicId: session.clinicId,
          userId: session.id,
          action: AuditAction.CREATE,
          entity: 'CashTransaction',
          entityId: result.outTx.id,
          details: `Versement Week-end de ${numAmount} Ar de Petite Caisse Week-end vers Grande Caisse Week-end (${result.transferRef})`,
        });

        return NextResponse.json({ success: true, transfer: result });
      }

      return NextResponse.json({ error: 'Type de transfert non reconnu' }, { status: 400 });
    }

    // =========================================================================
    // CAS 0c : ENTRÉE BUDGET ACTES SPÉCIFIQUES & CONSULTATIONS WEEK-END
    // =========================================================================
    if (action === 'WEEKEND_CONSULTATION_INCOME' || action === 'SPECIFIC_ACT_INCOME') {
      const {
        amount,
        patientName,
        doctorName,
        actName,
        paymentMethod,
        transactionDate,
        notes,
        attachmentUrl,
        attachmentName,
      } = body;

      const numAmount = parseFloat(amount);
      if (!numAmount || numAmount <= 0) {
        return NextResponse.json({ error: "Le montant de l'acte spécifique doit être supérieur à zéro." }, { status: 400 });
      }

      const txDate = resolveTransactionDate(transactionDate);
      const currentYear = new Date().getFullYear();
      const specCount = await prisma.cashTransaction.count({
        where: {
          clinicId: session.clinicId,
          OR: [
            { reference: { startsWith: 'CONS-SPEC' } },
            { reference: { startsWith: 'CONS-WE' } },
          ],
        },
      });
      const consRef = `CONS-SPEC-${currentYear}-${String(specCount + 1).padStart(4, '0')}`;
      const operatorName = `${session.firstName} ${session.lastName}`.trim();
      const cleanPatient = patientName && String(patientName).trim() ? String(patientName).trim() : 'Néant';
      const cleanDoctor = doctorName && String(doctorName).trim() ? String(doctorName).trim() : 'Médecin de garde';
      const cleanAct = actName && String(actName).trim() ? String(actName).trim() : 'Acte Spécifique';
      const cleanNotes = notes && String(notes).trim() ? String(notes).trim() : 'Néant';
      const targetWeekendRegister = isReceptionist ? 'PETITE_CAISSE_WEEKEND' : 'CONSULTATION_WEEKEND';

      const createdTx = await prisma.cashTransaction.create({
        data: {
          clinicId: session.clinicId,
          type: CashTransactionType.INCOME,
          category: 'Acte spécifique',
          amount: numAmount,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          reference: consRef,
          description: `[ACTE SPÉCIFIQUE] ${cleanAct} (${consRef}) | Patient : ${cleanPatient} | Médecin : ${cleanDoctor} | Remarque : ${cleanNotes} | Saisi par : ${operatorName}`.slice(0, 255),
          transactionDate: txDate,
          performedById: session.id,
          attachmentUrl: attachmentUrl || null,
          attachmentName: attachmentName || null,
          cashRegister: targetWeekendRegister,
        },
        include: {
          performedBy: { select: { firstName: true, lastName: true } },
        },
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.CREATE,
        entity: 'SpecificActConsultation',
        entityId: createdTx.id,
        details: `Entrée Acte Spécifique de ${numAmount} Ar (${consRef}) - Médecin : ${cleanDoctor}`,
      });

      return NextResponse.json({ success: true, transaction: createdTx });
    }

    // =========================================================================
    // CAS 0d : PAIEMENT HONORAIRES MÉDECIN DEPUIS LE BUDGET ACTES SPÉCIFIQUES & WEEK-END
    // =========================================================================
    if (action === 'WEEKEND_DOCTOR_PAYMENT' || action === 'SPECIFIC_DOCTOR_PAYMENT') {
      if (!isAdminOrAccountant) {
        return NextResponse.json(
          { error: 'Le paiement des médecins sur le budget des actes spécifiques est réservé à la Grande Caisse ou à la direction.' },
          { status: 403 }
        );
      }

      const {
        doctorName,
        amount,
        consultationId,
        consultationRef,
        consultationTotalAmount,
        actName,
        patientName,
        retainedAmount,
        paymentMethod,
        transactionDate,
        weekendPeriod,
        notes,
        attachmentUrl,
        attachmentName,
      } = body;

      const numAmount = parseFloat(amount);
      if (!numAmount || numAmount <= 0) {
        return NextResponse.json({ error: 'Le montant à verser au médecin doit être supérieur à zéro.' }, { status: 400 });
      }
      if (!doctorName || !String(doctorName).trim()) {
        return NextResponse.json({ error: 'Veuillez sélectionner ou saisir le nom du médecin bénéficiaire.' }, { status: 400 });
      }

      // Calcul du budget disponible Grande Caisse Actes Spécifiques
      // (Provient UNIQUEMENT des versements effectifs reçus dans CONSULTATION_WEEKEND ;
      // les montants encaissés en Petite Caisse ne sont pas disponibles tant qu'ils n'ont pas été versés)
      const [weekendTxs] = await Promise.all([
        prisma.cashTransaction.findMany({
          where: { clinicId: session.clinicId, cashRegister: 'CONSULTATION_WEEKEND' },
          select: { type: true, amount: true, reference: true },
        }),
      ]);

      const directWeIncome = weekendTxs
        .filter((t) => t.type === CashTransactionType.INCOME)
        .reduce((s, t) => s + t.amount, 0);
      const totalWePaidOut = weekendTxs
        .filter((t) => t.type === CashTransactionType.EXPENSE)
        .reduce((s, t) => s + t.amount, 0);

      const availableWeekendBudget = Math.max(0, directWeIncome - totalWePaidOut);

      if (numAmount > availableWeekendBudget) {
        return NextResponse.json(
          {
            error: `Le paiement demandé (${numAmount.toLocaleString('fr-FR')} Ar) dépasse le budget disponible des actes spécifiques en Grande Caisse (${availableWeekendBudget.toLocaleString('fr-FR')} Ar). Veuillez d'abord effectuer un versement depuis la Petite Caisse.`,
          },
          { status: 400 }
        );
      }

      const txDate = resolveTransactionDate(transactionDate);
      const currentYear = new Date().getFullYear();
      const payCount = await prisma.cashTransaction.count({
        where: {
          clinicId: session.clinicId,
          OR: [
            { reference: { startsWith: 'PAY-MED-SPEC' } },
            { reference: { startsWith: 'PAY-MED-WE' } },
          ],
        },
      });
      const payRef = `PAY-MED-SPEC-${currentYear}-${String(payCount + 1).padStart(4, '0')}`;
      const operatorName = `${session.firstName} ${session.lastName}`.trim();
      const cleanDoc = String(doctorName).trim();
      const cleanRef = consultationRef && String(consultationRef).trim() ? String(consultationRef).trim() : 'ACTE';
      const cleanPatient = patientName && String(patientName).trim() ? String(patientName).trim() : 'Patient';
      const cleanAct = actName && String(actName).trim() ? String(actName).trim() : 'Acte spécifique';
      const parsedTotal = consultationTotalAmount ? parseFloat(consultationTotalAmount) : 0;
      const parsedRetained = retainedAmount !== undefined
        ? parseFloat(retainedAmount)
        : parsedTotal > numAmount
        ? parsedTotal - numAmount
        : 0;
      const cleanNotes = notes && String(notes).trim() ? String(notes).trim() : 'Néant';

      const descriptionText = parsedTotal > 0
        ? `Paiement Médecin : ${cleanDoc} | Acte : ${cleanAct} (${cleanRef}) | Patient : ${cleanPatient} | Total Acte : ${parsedTotal.toLocaleString('fr-FR')} Ar | Rémunération Médecin : ${numAmount.toLocaleString('fr-FR')} Ar | Part Grande Caisse : ${parsedRetained.toLocaleString('fr-FR')} Ar | Réf : ${payRef}`
        : `Paiement Médecin Actes Spécifiques (${payRef}) | Bénéficiaire : ${cleanDoc} | Remarque : ${cleanNotes} | Décaissé par : ${operatorName}`;

      const paymentTx = await prisma.cashTransaction.create({
        data: {
          clinicId: session.clinicId,
          type: CashTransactionType.EXPENSE,
          category: 'Paiement Médecin (Acte Spécifique)',
          amount: numAmount,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          reference: payRef,
          description: descriptionText.slice(0, 255),
          transactionDate: txDate,
          performedById: session.id,
          attachmentUrl: attachmentUrl || null,
          attachmentName: attachmentName || null,
          cashRegister: 'CONSULTATION_WEEKEND',
        },
        include: {
          performedBy: { select: { firstName: true, lastName: true } },
        },
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.CREATE,
        entity: 'SpecificDoctorPayment',
        entityId: paymentTx.id,
        details: `Paiement Médecin Acte Spécifique de ${numAmount} Ar à ${cleanDoc} (${payRef}) - Réf Acte: ${cleanRef}`,
      });

      return NextResponse.json({
        success: true,
        paymentTx,
        paymentRef: payRef,
        doctorAmount: numAmount,
        retainedAmount: parsedRetained,
        consultationRef: cleanRef,
      });
    }

    // =========================================================================
    // CAS 1 : DÉPENSE STANDARD / SORTIE DE CAISSE (Jirama, Loyer, Achats, Autre, etc.)
    // =========================================================================
    if (!action || action === 'STANDARD_EXPENSE') {
      const {
        category,
        customCategory,
        amount,
        beneficiary,
        paymentMethod,
        reference,
        description,
        transactionDate,
        attachmentUrl,
        attachmentName,
        cashRegister,
      } = body;

      const numAmount = parseFloat(amount);
      if (!numAmount || numAmount <= 0) {
        return NextResponse.json({ error: 'Le montant de la dépense doit être supérieur à zéro.' }, { status: 400 });
      }

      if (category === 'Autre' && (!customCategory || !String(customCategory).trim())) {
        return NextResponse.json({ error: 'Veuillez préciser le libellé de la catégorie personnalisée (« Autre »).' }, { status: 400 });
      }

      const resolvedCategory =
        category === 'Autre' && customCategory && String(customCategory).trim()
          ? String(customCategory).trim()
          : category || 'Charges d’exploitation';

      if (!description && !beneficiary) {
        return NextResponse.json({ error: 'Veuillez préciser le motif ou le bénéficiaire de la sortie.' }, { status: 400 });
      }

      const txDate = resolveTransactionDate(transactionDate);
      const count = await prisma.cashTransaction.count({
        where: { clinicId: session.clinicId, type: CashTransactionType.EXPENSE },
      });
      const currentYear = new Date().getFullYear();
      const isDentistry = resolvedCategory.toLowerCase().includes('dent');
      const autoPrefix = isDentistry ? 'DEP-DENT' : 'DEP';
      const autoRef =
        reference && String(reference).trim() && String(reference).trim() !== 'Néant'
          ? String(reference).trim()
          : `${autoPrefix}-${currentYear}-${String(count + 1).padStart(4, '0')}`;

      const operatorName = `${session.firstName} ${session.lastName}`;
      const cleanBeneficiary = beneficiary && String(beneficiary).trim() ? String(beneficiary).trim() : 'Néant';
      const cleanDescription = description && String(description).trim() ? String(description).trim() : 'Sortie de caisse';
      const descFormatted = `${cleanDescription} | Bénéficiaire : ${cleanBeneficiary} | Saisi par : ${operatorName}`.slice(0, 255);

      const targetRegister = isReceptionist ? 'PETITE_CAISSE' : (cashRegister || 'GRANDE_CAISSE');

      const expenseTx = await prisma.cashTransaction.create({
        data: {
          clinicId: session.clinicId,
          type: CashTransactionType.EXPENSE,
          category: resolvedCategory,
          amount: numAmount,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          reference: autoRef,
          description: descFormatted,
          transactionDate: txDate,
          performedById: session.id,
          attachmentUrl: attachmentUrl || null,
          attachmentName: attachmentName || null,
          cashRegister: targetRegister,
        },
        include: {
          performedBy: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.CREATE,
        entity: 'CashExpense',
        entityId: expenseTx.id,
        details: `Décaissement de ${numAmount} Ar (${expenseTx.category}) - Réf : ${autoRef}`,
      });

      return NextResponse.json({ success: true, expense: expenseTx });
    }

    // =========================================================================
    // CAS 2 : FICHE DE PAIE & DÉCAISSEMENT SALAIRE D'UN EMPLOYÉ
    // =========================================================================
    if (action === 'PAYROLL_SLIP') {
      const {
        userId,
        employeeId,
        month,
        monthLabel,
        baseSalary,
        bonusAmount,
        deductionAmount,
        paymentMethod,
        notes,
      } = body;

      if (!userId && !employeeId) {
        return NextResponse.json({ error: 'Veuillez sélectionner un employé.' }, { status: 400 });
      }

      let staffName = '';
      let staffPosition = '';
      let targetUserId: string | null = null;
      let targetEmployeeId: string | null = null;

      if (employeeId) {
        const emp = await prisma.employee.findUnique({
          where: { id: employeeId },
        });
        if (!emp) {
          return NextResponse.json({ error: 'Employé introuvable dans la base.' }, { status: 404 });
        }
        targetEmployeeId = emp.id;
        staffName = `${emp.lastName.toUpperCase()} ${emp.firstName}`;
        staffPosition = emp.position || 'Salarié';
      } else if (userId) {
        const staff = await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true },
        });
        if (!staff) {
          return NextResponse.json({ error: 'Employé introuvable.' }, { status: 404 });
        }
        targetUserId = staff.id;
        staffName = `${staff.lastName.toUpperCase()} ${staff.firstName}`;
        staffPosition = staff.role.displayName || 'Salarié';
      }

      const base = parseFloat(baseSalary || '0');
      const bonus = parseFloat(bonusAmount || '0');
      const deduction = parseFloat(deductionAmount || '0');
      const netSalary = Math.max(0, base + bonus - deduction);

      if (netSalary <= 0) {
        return NextResponse.json({ error: 'Le salaire net à décaisser doit être supérieur à zéro.' }, { status: 400 });
      }

      const count = await prisma.payrollSlip.count({
        where: { clinicId: session.clinicId },
      });
      const currentYear = new Date().getFullYear();
      const currentMonth = month || `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const slipNumber = `PAIE-${currentYear}-${String(count + 1).padStart(4, '0')}`;

      // Transaction atomique : création du bulletin de paie + inscription dans la caisse
      const [payrollSlip, cashTx] = await prisma.$transaction(async (tx) => {
        // 1. Transaction de caisse (Sortie d'argent Grande Caisse)
        const operatorName = `${session.firstName} ${session.lastName}`;
        const createdCashTx = await tx.cashTransaction.create({
          data: {
            clinicId: session.clinicId,
            type: CashTransactionType.EXPENSE,
            category: 'Salaires & Paie',
            amount: netSalary,
            paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.BANK_TRANSFER,
            reference: slipNumber,
            description: `Paie ${monthLabel || currentMonth} - ${staffName} (${staffPosition}) | Décaissé par l'Administrateur : ${operatorName}`,
            performedById: session.id,
            cashRegister: 'GRANDE_CAISSE',
          },
          include: {
            performedBy: {
              select: { firstName: true, lastName: true },
            },
          },
        });

        // 2. Fiche de paie
        const createdSlip = await tx.payrollSlip.create({
          data: {
            clinicId: session.clinicId,
            userId: targetUserId,
            employeeId: targetEmployeeId,
            employeeName: staffName,
            employeePosition: staffPosition,
            slipNumber,
            month: currentMonth,
            monthLabel: monthLabel || `Mois de ${currentMonth}`,
            baseSalary: base,
            bonusAmount: bonus,
            deductionAmount: deduction,
            netSalary,
            paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.BANK_TRANSFER,
            status: 'PAID',
            notes: notes || null,
            transactionId: createdCashTx.id,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: { select: { displayName: true, name: true } },
              },
            },
            employee: true,
          },
        });

        return [createdSlip, createdCashTx];
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.CREATE,
        entity: 'PayrollSlip',
        entityId: payrollSlip.id,
        details: `Émission fiche de paie #${slipNumber} pour ${staffName} (Net : ${netSalary} Ar)`,
      });

      return NextResponse.json({ success: true, payrollSlip, cashTx });
    }

    // =========================================================================
    // CAS 3 : DÉPENSE CLINIQUE : PRÉLÈVEMENT DE MÉDICAMENTS DANS LA PHARMACIE
    // (Débité sur GRANDE_CAISSE et suivi dédié dans le compte Comptable/Admin)
    // =========================================================================
    if (action === 'CLINIC_MEDICINE_REQUISITION') {
      if (!isAdminOrAccountant && !isReceptionist) {
        return NextResponse.json(
          { error: 'Le prélèvement interne de médicaments clinique est réservé à la Petite Caisse, à la comptabilité et à la direction.' },
          { status: 403 }
        );
      }

      const {
        department,
        customDepartment,
        reason,
        items, // [{ medicineId, quantity, unitCost, medicineName }] en unités !
        notes,
        attachmentUrl,
        attachmentName,
      } = body;

      if (department === 'Autre' && (!customDepartment || !String(customDepartment).trim())) {
        return NextResponse.json(
          { error: 'Veuillez préciser le service destinataire personnalisé (« Autre »).' },
          { status: 400 }
        );
      }

      const resolvedDepartment =
        department === 'Autre' && customDepartment && String(customDepartment).trim()
          ? String(customDepartment).trim()
          : department || 'Infirmerie & Soins';

      if (!items || !items.length) {
        return NextResponse.json({ error: 'Veuillez sélectionner au moins un médicament à prélever.' }, { status: 400 });
      }

      // Vérifier stocks disponibles en unités
      const medicineIds = items.map((i: any) => i.medicineId);
      const dbMeds = await prisma.medicine.findMany({
        where: { id: { in: medicineIds } },
      });
      const medMap = new Map(dbMeds.map((m) => [m.id, m]));

      let calculatedTotal = 0;
      const formattedItems: Array<{
        medicineId: string;
        medicineName: string;
        dosage?: string | null;
        form?: string | null;
        quantity: number;
        unitCost: number;
        totalCost: number;
      }> = [];

      for (const item of items) {
        const med = medMap.get(item.medicineId);
        const qty = parseInt(item.quantity, 10);
        if (!med) {
          return NextResponse.json({ error: `Médicament introuvable : ${item.medicineName || item.name}` }, { status: 400 });
        }
        if (med.currentStock < qty) {
          return NextResponse.json({
            error: `Stock insuffisant pour "${med.name}". Disponible : ${med.currentStock} unités, Demandé : ${qty} unités`,
          }, { status: 400 });
        }

        // On valorise la dépense au prix de revient ou d'achat unitaire (ou prix de vente)
        const cost = parseFloat(item.unitCost || String(med.purchasePrice || med.sellingPrice));
        const itemTotal = cost * qty;
        calculatedTotal += itemTotal;

        formattedItems.push({
          medicineId: med.id,
          medicineName: med.name,
          dosage: med.dosage,
          form: med.form,
          quantity: qty, // en unités
          unitCost: cost,
          totalCost: itemTotal,
        });
      }

      const isDentistry = (resolvedDepartment || '').toLowerCase().includes('dent');
      const autoPrefix = isDentistry ? 'DEP-DENT' : 'DEP-CLI';
      const requisitionCategory = isDentistry
        ? 'Dépense Dentisterie (Pharmacie)'
        : 'Dépense Clinique (Pharmacie)';

      const count = await prisma.clinicMedicineRequisition.count({
        where: { clinicId: session.clinicId },
      });
      const currentYear = new Date().getFullYear();
      const requisitionNumber = `${autoPrefix}-${currentYear}-${String(count + 1).padStart(4, '0')}`;

      // Transaction atomique :
      // 1. Décrémentation du stock en unités dans la pharmacie
      // 2. Enregistrement de la dépense dans CashTransaction sur GRANDE_CAISSE
      // 3. Enregistrement de la fiche de réquisition clinique interne
      const [requisition, cashTx] = await prisma.$transaction(async (tx) => {
        // 1. Déduire les unités de la pharmacie
        for (const it of formattedItems) {
          await tx.medicine.update({
            where: { id: it.medicineId },
            data: {
              currentStock: { decrement: it.quantity },
            },
          });
        }

        // 2. Transaction de dépense imputée sur la GRANDE CAISSE (et Demandeur figé sur l'utilisateur connecté)
        const operatorName = `${session.firstName} ${session.lastName}`.trim();
        const requester = operatorName;
        const targetRegister = 'GRANDE_CAISSE';
        const createdCashTx = await tx.cashTransaction.create({
          data: {
            clinicId: session.clinicId,
            type: CashTransactionType.EXPENSE,
            category: requisitionCategory,
            amount: calculatedTotal,
            paymentMethod: PaymentMethod.CASH,
            reference: requisitionNumber,
            description: `Prélèvement Pharmacie pour ${resolvedDepartment} (${formattedItems.length} méd.) | Demandeur : ${requester} | Validé par : ${operatorName}${reason ? ` | Motif : ${reason}` : ''}`.slice(0, 255),
            performedById: session.id,
            attachmentUrl: attachmentUrl || null,
            attachmentName: attachmentName || null,
            cashRegister: targetRegister,
          },
          include: {
            performedBy: {
              select: { firstName: true, lastName: true },
            },
          },
        });

        // 3. Fiche de réquisition
        const createdRequisition = await tx.clinicMedicineRequisition.create({
          data: {
            clinicId: session.clinicId,
            requisitionNumber,
            department: resolvedDepartment,
            requestedBy: requester,
            reason: reason || 'Soins internes clinique',
            totalCost: calculatedTotal,
            notes: notes || null,
            itemsJson: JSON.stringify(formattedItems),
            attachmentUrl: attachmentUrl || null,
            attachmentName: attachmentName || null,
            transactionId: createdCashTx.id,
          },
        });

        return [createdRequisition, createdCashTx];
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.CREATE,
        entity: 'ClinicMedicineRequisition',
        entityId: requisition.id,
        details: `Prélèvement clinique #${requisitionNumber} (Grande Caisse) : ${formattedItems.length} médicaments sortis de pharmacie pour ${resolvedDepartment} (${calculatedTotal} Ar)`,
      });

      return NextResponse.json({
        success: true,
        requisition,
        cashTx,
        items: formattedItems,
      });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error: any) {
    console.error('Create expense error:', error);
    return NextResponse.json({ error: error.message || 'Erreur enregistrement dépense' }, { status: 500 });
  }
}

// =========================================================================
// PATCH : MODIFICATION D'UNE TRANSACTION PAR L'ADMINISTRATEUR
// =========================================================================
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const isAdminOrAccountant =
    session.role === 'SUPER_ADMIN' || session.role === 'CLINIC_ADMIN' || session.role === 'ACCOUNTANT';

  if (!isAdminOrAccountant) {
    return NextResponse.json({ error: 'Seule la direction de la clinique peut modifier une transaction de caisse.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      id,
      amount,
      category,
      description,
      paymentMethod,
      transactionDate,
      cashRegister,
      reference,
      attachmentUrl,
      attachmentName,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Identifiant de transaction manquant.' }, { status: 400 });
    }

    const existingTx = await prisma.cashTransaction.findFirst({
      where: { id, clinicId: session.clinicId },
    });

    if (!existingTx) {
      return NextResponse.json({ error: 'Transaction introuvable.' }, { status: 404 });
    }

    const updateData: any = {};
    if (amount !== undefined && !isNaN(parseFloat(amount))) {
      updateData.amount = parseFloat(amount);
    }
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod as PaymentMethod;
    if (reference !== undefined) updateData.reference = reference;
    if (cashRegister !== undefined) updateData.cashRegister = cashRegister;
    if (transactionDate) updateData.transactionDate = resolveTransactionDate(transactionDate);
    if (attachmentUrl !== undefined) updateData.attachmentUrl = attachmentUrl;
    if (attachmentName !== undefined) updateData.attachmentName = attachmentName;

    const updatedTx = await prisma.cashTransaction.update({
      where: { id },
      data: updateData,
      include: {
        performedBy: { select: { firstName: true, lastName: true } },
      },
    });

    // Si la transaction fait partie d'un transfert jumelé (VERS-, DEP-BQ-, RET-BQ-)
    // et qu'on modifie le montant ou la date, répercuter sur la contrepartie
    if (existingTx.reference && (updateData.amount !== undefined || updateData.transactionDate !== undefined)) {
      const isTransferRef =
        existingTx.reference.startsWith('VERS-') ||
        existingTx.reference.startsWith('DEP-BQ-') ||
        existingTx.reference.startsWith('RET-BQ-');

      if (isTransferRef) {
        const pairedTx = await prisma.cashTransaction.findFirst({
          where: {
            clinicId: session.clinicId,
            reference: existingTx.reference,
            id: { not: existingTx.id },
          },
        });

        if (pairedTx) {
          const pairedUpdate: any = {};
          if (updateData.amount !== undefined) pairedUpdate.amount = updateData.amount;
          if (updateData.transactionDate !== undefined) pairedUpdate.transactionDate = updateData.transactionDate;
          await prisma.cashTransaction.update({
            where: { id: pairedTx.id },
            data: pairedUpdate,
          });
        }
      }
    }

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.UPDATE,
      entity: 'CashTransaction',
      entityId: updatedTx.id,
      details: `Modification transaction #${updatedTx.reference || updatedTx.id} (${updatedTx.amount} Ar - ${updatedTx.cashRegister}) par ${session.firstName} ${session.lastName}`,
    });

    return NextResponse.json({ success: true, transaction: updatedTx });
  } catch (error: any) {
    console.error('Update expense error:', error);
    return NextResponse.json({ error: error.message || 'Erreur mise à jour transaction' }, { status: 500 });
  }
}

// =========================================================================
// DELETE : SUPPRESSION D'UNE TRANSACTION PAR L'ADMINISTRATEUR
// =========================================================================
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const isAdminOrAccountant =
    session.role === 'SUPER_ADMIN' || session.role === 'CLINIC_ADMIN' || session.role === 'ACCOUNTANT';
  if (!isAdminOrAccountant) {
    return NextResponse.json({ error: 'Seule la direction ou la comptabilité peut supprimer une écriture de caisse.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Identifiant de transaction requis.' }, { status: 400 });
    }

    const tx = await prisma.cashTransaction.findFirst({
      where: { id, clinicId: session.clinicId },
    });

    if (!tx) {
      return NextResponse.json({ error: 'Transaction introuvable.' }, { status: 404 });
    }

    // Si c'est un versement / transfert jumelé, supprimer les deux écritures associées
    const isPairedTransfer =
      tx.reference &&
      (tx.reference.startsWith('VERS-') || tx.reference.startsWith('DEP-BQ-') || tx.reference.startsWith('RET-BQ-'));

    if (isPairedTransfer) {
      await prisma.cashTransaction.deleteMany({
        where: {
          clinicId: session.clinicId,
          reference: tx.reference!,
        },
      });
    } else {
      await prisma.cashTransaction.delete({
        where: { id },
      });
    }

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.DELETE,
      entity: 'CashTransaction',
      entityId: id,
      details: `Suppression transaction #${tx.reference || tx.id} (${tx.amount} Ar - ${tx.cashRegister}) par ${session.firstName} ${session.lastName}`,
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('Delete expense error:', error);
    return NextResponse.json({ error: error.message || 'Erreur suppression transaction' }, { status: 500 });
  }
}
