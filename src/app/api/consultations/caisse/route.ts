import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import {
  AuditAction,
  PaymentMethod,
  InvoiceStatus,
  InvoiceItemType,
  CashTransactionType,
  ConsultationStatus,
} from '@prisma/client';
import { ConsultationTicketData } from '@/lib/consultationReceipt';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const todayOnly = searchParams.get('today') === 'true';

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const consultations = await prisma.consultation.findMany({
      where: {
        patient: { clinicId: session.clinicId },
        ...(todayOnly ? { createdAt: { gte: todayStart } } : {}),
      },
      include: {
        patient: true,
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            specialty: { select: { name: true } },
          },
        },
        invoice: {
          include: {
            payments: true,
          },
        },
        vitalSigns: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, consultations });
  } catch (error: any) {
    console.error('Fetch consultation payments error:', error);
    return NextResponse.json({ error: 'Erreur serveur : ' + error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      patientId,
      newPatient, // { firstName, lastName, phone, gender, birthDate, address }
      doctorId,
      actName, // Ex: "Consultation Médecine Générale"
      selectedActs, // Array of { name: string, price: number, quantity?: number }
      amount, // Montant en Ariary
      paymentMethod, // CASH, MVOLA, ORANGE_MONEY, AIRTEL_MONEY, etc.
      paymentReference,
      cashTendered,
      changeDue,
      reason, // Motif de visite
      vitals, // { temperature, systolicBP, diastolicBP, weight, height, heartRate, oxygenSaturation, bloodSugar, notes }
      isFreeConsultation, // Coche 0 Ar pour consultation gratuite
      isSpecificAct, // Coche Acte spécifique (gestion séparée et règlement praticien)
      isWeekendConsultation, // Optionnel : rétrocompatibilité
    } = body;

    const isSpecific = Boolean(isSpecificAct || isWeekendConsultation);

    const parsedAmount = Math.max(0, parseFloat(amount || '0'));
    if (!parsedAmount && !isFreeConsultation) {
      return NextResponse.json(
        { error: 'Le montant de la consultation est requis et doit être valide (ou cochez Consultation Gratuite).' },
        { status: 400 }
      );
    }

    // 1. Récupération ou création du patient
    let patientRecord: any = null;

    if (patientId) {
      patientRecord = await prisma.patient.findFirst({
        where: { id: patientId, clinicId: session.clinicId },
      });
      if (!patientRecord) {
        return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 });
      }
    } else if (newPatient && newPatient.lastName && newPatient.firstName) {
      // Génération du numéro de patient PAT-2026-XXXX
      const currentYear = new Date().getFullYear();
      const patientCount = await prisma.patient.count({ where: { clinicId: session.clinicId } });
      const patientNumber = `PAT-${currentYear}-${String(patientCount + 1).padStart(4, '0')}`;

      patientRecord = await prisma.patient.create({
        data: {
          clinicId: session.clinicId,
          patientNumber,
          firstName: newPatient.firstName.trim(),
          lastName: newPatient.lastName.trim(),
          gender: newPatient.gender || 'MALE',
          birthDate: newPatient.birthDate ? new Date(newPatient.birthDate) : new Date(2000, 0, 1),
          phone: newPatient.phone && String(newPatient.phone).trim() ? String(newPatient.phone).trim() : 'Néant',
          address: newPatient.address && String(newPatient.address).trim() ? String(newPatient.address).trim() : 'Néant',
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Veuillez sélectionner un patient existant ou renseigner les informations du nouveau patient.' },
        { status: 400 }
      );
    }

    // 2. Détermination du praticien (Optionnel)
    let activeDoctorId = doctorId || null;
    if (!activeDoctorId) {
      // Recherche du premier médecin actif de la clinique en fallback
      const firstDoctor = await prisma.doctor.findFirst({
        where: { clinicId: session.clinicId, isActive: true },
      });
      activeDoctorId = firstDoctor?.id || null;
    }

    // 3. Calcul du numéro d'ordre de passage du jour
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const consultationsTodayCount = await prisma.consultation.count({
      where: {
        createdAt: { gte: startOfToday, lt: endOfToday },
        patient: { clinicId: session.clinicId },
      },
    });
    const orderNumber = consultationsTodayCount + 1;

    // 4. Numéro de facture et reçu
    const currentYear = new Date().getFullYear();
    const invoiceCount = await prisma.invoice.count({ where: { clinicId: session.clinicId } });
    const invoiceNumber = `FAC-CONS-${currentYear}-${String(invoiceCount + 1).padStart(4, '0')}`;
    const paymentNumber = `PAY-CONS-${currentYear}-${String(invoiceCount + 1).padStart(4, '0')}`;

    // Calcul IMC automatique si poids et taille fournis
    let bmi: number | null = null;
    if (vitals?.weight && vitals?.height && parseFloat(vitals.height) > 0) {
      const hM = parseFloat(vitals.height) / 100;
      bmi = parseFloat((parseFloat(vitals.weight) / (hM * hM)).toFixed(1));
    }

    // Transaction atomique : Création consultation + Facture PAID + Paiement + CashTransaction + Vitals
    const result = await prisma.$transaction(async (tx) => {
      // A. Consultation (statut IN_PROGRESS = en attente d'appel / examen)
      const consultation = await tx.consultation.create({
        data: {
          patientId: patientRecord.id,
          doctorId: activeDoctorId,
          reason: reason || actName || 'Consultation Médicale',
          doctorNotes: isSpecific ? '[ACTE SPÉCIFIQUE]' : null,
          status: ConsultationStatus.IN_PROGRESS,
          vitalSigns: (vitals && (vitals.systolicBP || vitals.temperature || vitals.weight || vitals.heartRate))
            ? {
                create: {
                  temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
                  systolicBP: vitals.systolicBP ? parseInt(vitals.systolicBP, 10) : null,
                  diastolicBP: vitals.diastolicBP ? parseInt(vitals.diastolicBP, 10) : null,
                  heartRate: vitals.heartRate ? parseInt(vitals.heartRate, 10) : null,
                  oxygenSaturation: vitals.oxygenSaturation ? parseFloat(vitals.oxygenSaturation) : null,
                  weight: vitals.weight ? parseFloat(vitals.weight) : null,
                  height: vitals.height ? parseFloat(vitals.height) : null,
                  bmi,
                },
              }
            : undefined,
        },
        include: {
          patient: true,
          doctor: {
            include: {
              user: true,
              specialty: true,
            },
          },
          vitalSigns: true,
        },
      });

      // Préparation des lignes d'actes facturés
      const actsList: Array<{ name: string; price: number; quantity: number }> =
        Array.isArray(selectedActs) && selectedActs.length > 0
          ? selectedActs.map((a: any) => ({
              name: String(a.name || 'Acte Médical'),
              price: Math.max(0, parseFloat(a.price) || 0),
              quantity: Math.max(1, parseInt(a.quantity || '1', 10)),
            }))
          : [
              {
                name: actName || 'Consultation Médicale',
                price: parsedAmount,
                quantity: 1,
              },
            ];

      const actsSummary = actsList.map((a) => a.name).join(' + ');

      // B. Facture réglée à 100% (ou à 0 Ar si exonérée)
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          clinicId: session.clinicId,
          patientId: patientRecord.id,
          consultationId: consultation.id,
          totalAmount: isFreeConsultation ? 0 : parsedAmount,
          discountAmount: 0,
          taxAmount: 0,
          paidAmount: isFreeConsultation ? 0 : parsedAmount,
          balance: 0,
          status: InvoiceStatus.PAID,
          notes: isFreeConsultation
            ? `[CONSULTATION GRATUITE (0 Ar) - PRISE EN CHARGE CLINIQUE] (${actsSummary})`
            : `Encaissement consultation (${actsSummary})`,
          items: {
            create: actsList.map((a) => ({
              description: a.name,
              itemType: InvoiceItemType.CONSULTATION,
              quantity: a.quantity,
              unitPrice: isFreeConsultation ? 0 : a.price,
              totalPrice: isFreeConsultation ? 0 : a.price * a.quantity,
            })),
          },
          payments: {
            create: [
              {
                paymentNumber,
                amount: isFreeConsultation ? 0 : parsedAmount,
                paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
                reference: paymentReference || null,
                notes: isFreeConsultation
                  ? `Consultation gratuite (0 Ar) exonérée prise en charge clinique pour ${patientRecord.lastName} ${patientRecord.firstName}`
                  : `Paiement au comptoir par ${patientRecord.lastName} ${patientRecord.firstName}`,
                receivedById: session.id,
              },
            ],
          },
        },
      });

      // C. Inscription dans le journal de caisse (CashTransaction)
      // Si la consultation est un acte spécifique, elle est isolée en Petite Caisse jusqu'à versement vers la Grande Caisse
      const isInfirmerie = /soin|pansement|inject|perfus|infirm|bandage|suture/i.test(actsSummary);
      const docDisplay = consultation.doctor
        ? (consultation.doctor.firstName || consultation.doctor.lastName
            ? `${consultation.doctor.title || 'Dr.'} ${consultation.doctor.firstName || ''} ${consultation.doctor.lastName || ''}`.trim()
            : consultation.doctor.user
            ? `Dr. ${consultation.doctor.user.firstName} ${consultation.doctor.user.lastName}`
            : 'Médecin consultant')
        : 'Médecin consultant';
      const incomeCategory = isFreeConsultation
        ? 'Consultation Gratuite (0 Ar)'
        : isSpecific && !isInfirmerie
        ? 'Acte spécifique'
        : isInfirmerie
        ? 'Infirmerie'
        : 'Consultation';
      // Les actes spécifiques encaissés au comptoir vont dans la caisse dédiée de la Petite Caisse (PETITE_CAISSE_WEEKEND)
      // puis sont versés par la Petite Caisse vers la Grande Caisse (CONSULTATION_WEEKEND) pour le paiement des médecins.
      const targetRegister = isSpecific && !isInfirmerie ? 'PETITE_CAISSE_WEEKEND' : 'PETITE_CAISSE';

      const cashTx = await tx.cashTransaction.create({
        data: {
          clinicId: session.clinicId,
          type: CashTransactionType.INCOME,
          category: incomeCategory,
          amount: isFreeConsultation ? 0 : parsedAmount,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          reference: invoiceNumber,
          description: isFreeConsultation
            ? `Consultation Gratuite (0 Ar) prise en charge clinique - ${patientRecord.lastName} ${patientRecord.firstName} (${actsSummary})`
            : isSpecific && !isInfirmerie
            ? `[ACTE SPÉCIFIQUE] Encaissement consultation ${invoiceNumber} - ${patientRecord.lastName} ${patientRecord.firstName} (${actsSummary}) | Médecin : ${docDisplay}`
            : `Encaissement ${incomeCategory.toLowerCase()} ${invoiceNumber} - ${patientRecord.lastName} ${patientRecord.firstName} (${actsSummary})`,
          performedById: session.id,
          cashRegister: targetRegister,
        },
      });

      return { consultation, invoice, cashTx, actsList, actsSummary };
    });

    // 5. Récupération des informations de la clinique
    const clinic = await prisma.clinic.findUnique({
      where: { id: session.clinicId },
    });

    // 6. Calcul de l'âge du patient
    let patientAge: number | string = '-';
    if (patientRecord.birthDate) {
      const birth = new Date(patientRecord.birthDate);
      const diff = Date.now() - birth.getTime();
      patientAge = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
    }

    // 7. Construction des données du ticket double volet
    const ticketData: ConsultationTicketData = {
      clinic: {
        name: clinic?.name || 'CLINIQUE BETESDA',
        slogan: clinic?.slogan || 'Soins, Bienveillance & Gestion Intelligente',
        address: clinic?.address || 'Lot IVG 35 Antananarivo, Madagascar',
        phone: clinic?.phone || '+261 20 22 123 45',
        email: clinic?.email || 'contact@cliniquebetesda.mg',
        website: clinic?.website || 'https://cliniquebetesda.mg',
        taxId: clinic?.taxId || 'NIF: 3000123456 / STAT: 85111',
        currency: clinic?.currency || 'Ar',
      },
      receiptNumber: result.invoice.invoiceNumber,
      orderNumber,
      consultationId: result.consultation.id,
      date: new Date(),
      cashierName: `${session.firstName} ${session.lastName}`,
      patient: {
        id: patientRecord.id,
        patientNumber: patientRecord.patientNumber,
        firstName: patientRecord.firstName,
        lastName: patientRecord.lastName,
        phone: patientRecord.phone && String(patientRecord.phone).trim() ? patientRecord.phone : 'Néant',
        age: patientAge,
        gender: patientRecord.gender,
      },
      doctorName: result.consultation.doctor
        ? (result.consultation.doctor.firstName || result.consultation.doctor.lastName
            ? `${result.consultation.doctor.title || 'Dr.'} ${result.consultation.doctor.firstName || ''} ${result.consultation.doctor.lastName || ''}`.trim()
            : (result.consultation.doctor.user ? `${result.consultation.doctor.user.firstName} ${result.consultation.doctor.user.lastName}` : 'Médecin consultant'))
        : 'Médecin consultant',
      specialty: result.consultation.doctor?.specialty?.name || result.consultation.doctor?.specialtyName || 'Médecine Générale',
      actName: result.actsSummary || actName || 'Consultation Médecine Générale',
      items: result.actsList,
      amount: parsedAmount,
      paymentMethod: paymentMethod || 'CASH',
      paymentReference: paymentReference || null,
      cashTendered: cashTendered ? parseFloat(cashTendered) : null,
      changeDue: changeDue ? parseFloat(changeDue) : null,
      reason: reason || null,
      vitals: vitals || undefined,
    };

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.CREATE,
      entity: 'ConsultationPayment',
      entityId: result.consultation.id,
      details: `Encaissement de ${parsedAmount} Ar pour consultation de ${patientRecord.lastName} ${patientRecord.firstName} (Ticket #${orderNumber})`,
    });

    return NextResponse.json({
      success: true,
      consultation: result.consultation,
      invoice: result.invoice,
      ticketData,
    });
  } catch (error: any) {
    console.error('Create consultation payment error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l’encaissement : ' + error.message },
      { status: 500 }
    );
  }
}
