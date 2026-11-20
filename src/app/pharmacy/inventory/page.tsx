import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { hasModuleAccess } from '@/lib/permissions';
import PharmacyInventoryClient from './PharmacyInventoryClient';

export default async function PharmacyInventoryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!hasModuleAccess(session.role, '/pharmacy/inventory')) {
    redirect('/dashboard?unauthorized=1');
  }

  const [medicines, categories, pastInventories] = await Promise.all([
    prisma.medicine.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.medicineCategory.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.pharmacyInventory.findMany({
      where: { clinicId: session.clinicId },
      include: {
        items: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                genericName: true,
                dosage: true,
                form: true,
                location: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  return (
    <DashboardLayout user={session}>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
              <span>/</span>
              <Link href="/pharmacy" className="hover:text-blue-600">Pharmacie</Link>
              <span>/</span>
              <span className="text-slate-600 font-medium">Inventaire Personnalisé</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              Inventaire Pharmacie Personnalisé
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Sélectionnez sur-mesure les médicaments à contrôler, comptez les stocks physiques réels et régularisez les écarts
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/pharmacy"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
            >
              ← Retour Pharmacie
            </Link>
          </div>
        </div>

        {/* Client Component */}
        <PharmacyInventoryClient
          currentUser={session}
          medicines={medicines}
          categories={categories}
          initialInventories={pastInventories}
        />
      </div>
    </DashboardLayout>
  );
}
