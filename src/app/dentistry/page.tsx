import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import DentistryClient from './DentistryClient';
import { hasModuleAccess } from '@/lib/permissions';

export default async function DentistryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!hasModuleAccess(session.role, '/dentistry')) {
    redirect('/dashboard?unauthorized=1');
  }

  const [clinic, dentalActs, dentalConsultations, dentalTransactions] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: session.clinicId },
    }),
    prisma.dentalAct.findMany({
      where: { clinicId: session.clinicId },
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
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true } },
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
      include: {
        performedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 100,
    }),
  ]);

  return (
    <DashboardLayout user={session}>
      <DentistryClient
        clinic={clinic}
        currentUser={session}
        initialDentalActs={JSON.parse(JSON.stringify(dentalActs))}
        initialConsultations={JSON.parse(JSON.stringify(dentalConsultations))}
        initialTransactions={JSON.parse(JSON.stringify(dentalTransactions))}
      />
    </DashboardLayout>
  );
}
