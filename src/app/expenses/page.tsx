import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import ExpensesClient from './ExpensesClient';
import { hasModuleAccess } from '@/lib/permissions';
import { CashTransactionType } from '@prisma/client';

export default async function ExpensesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!hasModuleAccess(session.role, '/expenses')) {
    redirect('/dashboard?unauthorized=1');
  }

  const isReceptionist = session.role === 'RECEPTIONIST';

  const [
    clinic,
    expenses,
    staffUsers,
    employees,
    payrollSlips,
    clinicRequisitions,
    medicines,
    dentalConsultations,
    dentalCashTransactions,
    staffMedicineSales,
    doctors,
    allConsultationsForWeekend,
  ] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: session.clinicId },
      include: {
        settings: true,
      },
    }),
    // Cloisonnement strict : l'Accueil (RECEPTIONIST) ne voit JAMAIS la Grande Caisse ni la Banque
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
    prisma.employee.findMany({
      where: {
        clinicId: session.clinicId,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    // Les fiches de paie sont strictement confidentielles et réservées à l'administration
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
    prisma.clinicMedicineRequisition.findMany({
      where: { clinicId: session.clinicId },
      orderBy: { date: 'desc' },
      take: 100,
    }),
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
    prisma.cashTransaction.findMany({
      where: {
        clinicId: session.clinicId,
        OR: [
          { category: { contains: 'Dent' } },
          { description: { contains: 'dent' } },
          { description: { contains: 'carie' } },
        ],
      },
      include: { performedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { transactionDate: 'desc' },
      take: 100,
    }),
    prisma.pharmacySale.findMany({
      where: {
        clinicId: session.clinicId,
        OR: [
          { employeeId: { not: null } },
          { customerName: { contains: 'PERSONNEL' } },
        ],
      },
      include: {
        items: {
          include: { medicine: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    // Médecins actifs pour les paiements d'honoraires Consultations Week-end
    prisma.doctor.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        specialty: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Consultations récentes (filtrées Samedi/Dimanche ci-dessous) pour l'onglet Consultations Week-end
    isReceptionist
      ? Promise.resolve([])
      : prisma.consultation.findMany({
          where: { patient: { clinicId: session.clinicId } },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true } },
            doctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                specialty: { select: { name: true } },
              },
            },
            invoice: { include: { payments: true } },
          },
          orderBy: { consultationDate: 'desc' },
          take: 500,
        }),
  ]);

  const weekendConsultations = (allConsultationsForWeekend || []).filter((c: any) => {
    const day = new Date(c.consultationDate).getDay();
    return day === 0 || day === 6;
  });

  return (
    <DashboardLayout user={session}>
      <ExpensesClient
        clinic={clinic}
        currentUser={session}
        initialExpenses={JSON.parse(JSON.stringify(expenses))}
        staffUsers={JSON.parse(JSON.stringify(staffUsers))}
        employees={JSON.parse(JSON.stringify(employees))}
        initialPayrollSlips={JSON.parse(JSON.stringify(payrollSlips))}
        initialClinicRequisitions={JSON.parse(JSON.stringify(clinicRequisitions))}
        medicines={JSON.parse(JSON.stringify(medicines))}
        initialDentalConsultations={JSON.parse(JSON.stringify(dentalConsultations))}
        initialDentalCashTransactions={JSON.parse(JSON.stringify(dentalCashTransactions))}
        staffMedicineSales={JSON.parse(JSON.stringify(staffMedicineSales))}
        doctors={JSON.parse(JSON.stringify(doctors))}
        initialWeekendConsultations={JSON.parse(JSON.stringify(weekendConsultations))}
      />
    </DashboardLayout>
  );
}
