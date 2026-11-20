import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import PharmacyFinancialsClient from './PharmacyFinancialsClient';
import { hasModuleAccess } from '@/lib/permissions';

export default async function PharmacyFinancialsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!hasModuleAccess(session.role, '/pharmacy/financials')) {
    redirect('/dashboard?unauthorized=1');
  }

  // Récupération des ventes complètes avec médicaments et prix d'achat, du stock actuel et des infos clinique
  const [sales, medicines, clinic] = await Promise.all([
    prisma.pharmacySale.findMany({
      where: { clinicId: session.clinicId },
      include: {
        items: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                purchasePrice: true,
                sellingPrice: true,
                currentStock: true,
                category: { select: { name: true } },
              },
            },
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientNumber: true,
          },
        },
      },
      orderBy: { saleDate: 'desc' },
      take: 500,
    }),
    prisma.medicine.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      include: {
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.clinic.findUnique({
      where: { id: session.clinicId },
    }),
  ]);

  return (
    <DashboardLayout user={session}>
      <PharmacyFinancialsClient
        user={session}
        sales={JSON.parse(JSON.stringify(sales))}
        medicines={JSON.parse(JSON.stringify(medicines))}
        clinic={JSON.parse(JSON.stringify(clinic))}
      />
    </DashboardLayout>
  );
}
