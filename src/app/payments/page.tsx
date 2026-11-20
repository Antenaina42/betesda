import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import PaymentsClient from './PaymentsClient';

export default async function PaymentsCashPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // RBAC guard: Seuls Super Admin et Administrateur de la clinique ont la vue complète de tous les mouvements financiers
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    redirect('/dashboard');
  }

  const [transactions, consultations, pharmacySales, consumableDeliveries] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: { clinicId: session.clinicId },
      include: {
        performedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
      take: 200,
    }),
    prisma.consultation.findMany({
      where: {
        patient: { clinicId: session.clinicId },
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
      take: 200,
    }),
    prisma.pharmacySale.findMany({
      where: { clinicId: session.clinicId },
      include: {
        patient: {
          select: { firstName: true, lastName: true, patientNumber: true },
        },
        items: true,
      },
      orderBy: { saleDate: 'desc' },
      take: 200,
    }),
    prisma.consumableDelivery.findMany({
      where: { clinicId: session.clinicId },
      include: {
        patient: {
          select: { id: true, patientNumber: true, firstName: true, lastName: true, phone: true },
        },
        items: {
          orderBy: [
            { category: 'asc' },
            { orderIndex: 'asc' },
          ],
        },
      },
      orderBy: { date: 'desc' },
      take: 200,
    }),
  ]);

  return (
    <DashboardLayout user={session}>
      <PaymentsClient
        user={session}
        transactions={JSON.parse(JSON.stringify(transactions))}
        consultations={JSON.parse(JSON.stringify(consultations))}
        pharmacySales={JSON.parse(JSON.stringify(pharmacySales))}
        consumableDeliveries={JSON.parse(JSON.stringify(consumableDeliveries))}
      />
    </DashboardLayout>
  );
}
