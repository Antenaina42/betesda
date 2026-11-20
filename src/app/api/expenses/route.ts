import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction, CashTransactionType, PaymentMethod } from '@prisma/client';

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
      // 1. Mouvements de caisse : Cloisonnement strict pour l'Accueil (RECEPTIONIST ne voit que Petite Caisse)
      prisma.cashTransaction.findMany({
        where: isReceptionist
          ? {
              clinicId: session.clinicId,
              cashRegister: 'PETITE_CAISSE',
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

      const txDate = transferDate ? new Date(transferDate) : new Date();
      const currentYear = new Date().getFullYear();
      const operatorName = `${session.firstName} ${session.lastName}`;

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
          .filter((t) => t.type === CashTransactionType.EXPENSE && t.category !== 'Salaires & Paie')
          .reduce((s, t) => s + t.amount, 0);
        const currentAvailable = petiteIncome - petiteExpenses;

        if (numAmount > currentAvailable) {
          return NextResponse.json({
            error: `Le montant à verser (${numAmount.toLocaleString()} Ar) ne peut pas dépasser le solde disponible en Petite Caisse (${Math.max(0, currentAvailable).toLocaleString()} Ar). Le solde de caisse ne peut pas être négatif.`,
          }, { status: 400 });
        }

        const count = await prisma.cashTransaction.count({
          where: { clinicId: session.clinicId, category: { contains: 'Versement' } },
        });
        const transferRef = `VERS-${currentYear}-${String(count + 1).padStart(4, '0')}`;
        const sender = senderName || (isReceptionist ? `${session.firstName} ${session.lastName}` : 'Accueil & Caisse');
        const receiver = receiverName || 'Direction Clinique / Administrateur';

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
        const sender = senderName || `${session.firstName} ${session.lastName}`;
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

      return NextResponse.json({ error: 'Type de transfert non reconnu' }, { status: 400 });
    }

    // =========================================================================
    // CAS 1 : DÉPENSE STANDARD / SORTIE DE CAISSE (Jirama, Loyer, Achats, etc.)
    // =========================================================================
    if (!action || action === 'STANDARD_EXPENSE') {
      const {
        category,
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

      if (!description && !beneficiary) {
        return NextResponse.json({ error: 'Veuillez préciser le motif ou le bénéficiaire de la sortie.' }, { status: 400 });
      }

      const txDate = transactionDate ? new Date(transactionDate) : new Date();
      const count = await prisma.cashTransaction.count({
        where: { clinicId: session.clinicId, type: CashTransactionType.EXPENSE },
      });
      const currentYear = new Date().getFullYear();
      const isDentistry = (category || '').toLowerCase().includes('dent');
      const autoPrefix = isDentistry ? 'DEP-DENT' : 'DEP';
      const autoRef = reference || `${autoPrefix}-${currentYear}-${String(count + 1).padStart(4, '0')}`;

      const operatorName = `${session.firstName} ${session.lastName}`;
      const descFormatted = beneficiary
        ? `${description || 'Sortie de caisse'} | Bénéficiaire : ${beneficiary} | Saisi par : ${operatorName}`
        : `${description || 'Sortie de caisse'} | Saisi par : ${operatorName}`;

      const targetRegister = isReceptionist ? 'PETITE_CAISSE' : (cashRegister || 'PETITE_CAISSE');

      const expenseTx = await prisma.cashTransaction.create({
        data: {
          clinicId: session.clinicId,
          type: CashTransactionType.EXPENSE,
          category: category || 'Charges d’exploitation',
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
    // =========================================================================
    if (action === 'CLINIC_MEDICINE_REQUISITION') {
      const {
        department,
        requestedBy,
        reason,
        items, // [{ medicineId, quantity, unitCost, medicineName }] en unités !
        notes,
        attachmentUrl,
        attachmentName,
      } = body;

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

      const isDentistry = (department || '').toLowerCase().includes('dent');
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
      // 2. Enregistrement de la dotation clinique interne
      // 3. Enregistrement de la dépense dans CashTransaction (Dépense Clinique ou Dentisterie)
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

        // 2. Transaction de dépense
        const operatorName = `${session.firstName} ${session.lastName}`;
        const requester = requestedBy || operatorName;
        const targetRegister = isReceptionist ? 'PETITE_CAISSE' : 'PETITE_CAISSE';
        const createdCashTx = await tx.cashTransaction.create({
          data: {
            clinicId: session.clinicId,
            type: CashTransactionType.EXPENSE,
            category: requisitionCategory,
            amount: calculatedTotal,
            paymentMethod: PaymentMethod.CASH,
            reference: requisitionNumber,
            description: `Prélèvement Pharmacie pour ${department || 'Clinique'} (${formattedItems.length} méd.) | Demandeur : ${requester} | Validé par : ${operatorName}${reason ? ` | Motif : ${reason}` : ''}`,
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
            department: department || (isDentistry ? 'Dentisterie' : 'Infirmerie & Soins'),
            requestedBy: requestedBy || session.firstName + ' ' + session.lastName,
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
        details: `Prélèvement clinique #${requisitionNumber} : ${formattedItems.length} médicaments sortis de pharmacie pour ${department} (${calculatedTotal} Ar)`,
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
    if (transactionDate) updateData.transactionDate = new Date(transactionDate);
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

  const isAdmin = session.role === 'SUPER_ADMIN' || session.role === 'CLINIC_ADMIN';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Seul un administrateur peut supprimer une écriture de caisse.' }, { status: 403 });
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
