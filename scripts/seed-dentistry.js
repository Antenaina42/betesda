const { PrismaClient, CashTransactionType } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    console.log('No clinic found');
    return;
  }
  const clinicId = clinic.id;

  const admin = await prisma.user.findFirst({
    where: { clinicId },
  });

  // Check existing requisitions for Dentisterie
  const existingReqs = await prisma.clinicMedicineRequisition.findMany({
    where: {
      clinicId,
      department: 'Dentisterie',
    },
  });

  console.log('Existing dental requisitions:', existingReqs.length);

  // If none exist, create a sample dental requisition
  if (existingReqs.length === 0) {
    // Find medicines (Compresses, Anesthésiques, Seringues, Bétadine)
    const medicines = await prisma.medicine.findMany({
      where: { clinicId },
      take: 5,
    });

    if (medicines.length > 0) {
      const med1 = medicines[0];
      const med2 = medicines.length > 1 ? medicines[1] : medicines[0];

      const items = [
        {
          medicineId: med1.id,
          medicineName: med1.name,
          dosage: med1.dosage,
          form: med1.form,
          quantity: 20, // 20 unités
          unitCost: med1.purchasePrice || 800,
          availableStock: med1.currentStock,
        },
        {
          medicineId: med2.id,
          medicineName: med2.name,
          dosage: med2.dosage,
          form: med2.form,
          quantity: 15, // 15 unités
          unitCost: med2.purchasePrice || 1200,
          availableStock: med2.currentStock,
        },
      ];

      const totalCost = items.reduce((sum, it) => sum + it.unitCost * it.quantity, 0);

      const count = await prisma.clinicMedicineRequisition.count({ where: { clinicId } });
      const reqNumber = `REQ-DENT-${String(count + 1).padStart(4, '0')}`;

      const requisition = await prisma.clinicMedicineRequisition.create({
        data: {
          clinicId,
          requisitionNumber: reqNumber,
          department: 'Dentisterie',
          requestedBy: 'Dr. Haja Ravelo (Chirurgien Dentiste)',
          reason: 'Dotation soins bucco-dentaires & anesthésie locale (extractions, caries)',
          totalCost,
          notes: 'Prélèvement physique en unités au comptoir de la pharmacie.',
          itemsJson: JSON.stringify(items),
        },
      });

      // Also record as a cash transaction expense
      await prisma.cashTransaction.create({
        data: {
          clinicId,
          type: CashTransactionType.EXPENSE,
          category: 'Dépense Dentisterie (Pharmacie)',
          amount: totalCost,
          paymentMethod: 'CASH',
          reference: `DEP-${reqNumber}`,
          description: `Prélèvement pharmacie Dentisterie : ${items.length} produits (35 unités) - Bon ${reqNumber}`,
          performedById: admin ? admin.id : null,
          transactionDate: new Date(),
        },
      });

      console.log('Created sample dental requisition and cash expense:', reqNumber, totalCost);
    }
  }

  // Check dental consultations
  const dentalConsultations = await prisma.consultation.findMany({
    where: {
      patient: { clinicId },
      OR: [
        { reason: { contains: 'dent' } },
        { reason: { contains: 'carie' } },
        { reason: { contains: 'détartr' } },
      ],
    },
    include: { invoice: true, patient: true },
  });

  console.log('Existing dental consultations:', dentalConsultations.length);

  if (dentalConsultations.length === 0) {
    const patient = await prisma.patient.findFirst({ where: { clinicId } });
    const doctor = await prisma.doctor.findFirst({
      where: { user: { clinicId } },
      include: { user: true },
    });

    if (patient && doctor) {
      // Create a dental consultation and paid invoice
      const invNum = `FAC-DENT-${Date.now()}`;
      const invoice = await prisma.invoice.create({
        data: {
          clinicId,
          patientId: patient.id,
          invoiceNumber: invNum,
          status: 'PAID',
          totalAmount: 50000,
          paidAmount: 50000,
          balance: 0,
          issuedDate: new Date(),
        },
      });

      await prisma.payment.create({
        data: {
          paymentNumber: `PAY-${invNum}`,
          invoiceId: invoice.id,
          amount: 50000,
          paymentMethod: 'CASH',
          paymentDate: new Date(),
        },
      });

      await prisma.consultation.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          reason: 'Soins de Carie & Extraction Molaire sous Anesthésie',
          diagnosis: 'Carie profonde molaire 36, pulpite aiguë résolue',
          treatment: 'Obturation composite, antiseptique local',
          status: 'COMPLETED',
          invoice: { connect: { id: invoice.id } },
        },
      });

      console.log('Created sample dental consultation with invoice FAC-DENT-2026-001');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
