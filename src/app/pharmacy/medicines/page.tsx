import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import MedicinesClient from './MedicinesClient';

interface MedicinesPageProps {
  searchParams: { q?: string; categoryId?: string };
}

export default async function MedicinesPage({ searchParams }: MedicinesPageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const q = searchParams.q?.trim() || '';
  const categoryId = searchParams.categoryId || '';

  const whereClause: any = {
    clinicId: session.clinicId,
    isActive: true,
  };

  if (q) {
    whereClause.OR = [
      { name: { contains: q } },
      { genericName: { contains: q } },
    ];
  }

  if (categoryId) {
    whereClause.categoryId = categoryId;
  }

  const [medicines, categories] = await Promise.all([
    prisma.medicine.findMany({
      where: whereClause,
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.medicineCategory.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const canViewPurchasePrice =
    session.role === 'SUPER_ADMIN' ||
    session.role === 'CLINIC_ADMIN' ||
    session.role === 'ACCOUNTANT';
  const sanitizedMedicines = canViewPurchasePrice
    ? medicines
    : medicines.map((m) => ({ ...m, purchasePrice: 0 }));

  return (
    <DashboardLayout user={session}>
      <MedicinesClient
        user={session}
        initialMedicines={sanitizedMedicines as any}
        categories={categories}
        initialSearch={q}
        initialCategoryId={categoryId}
      />
    </DashboardLayout>
  );
}
