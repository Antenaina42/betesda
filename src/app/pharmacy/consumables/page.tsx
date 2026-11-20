import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { hasModuleAccess } from '@/lib/permissions';
import ConsumablesClient from './ConsumablesClient';

export default async function ConsumablesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!hasModuleAccess(session.role, '/pharmacy/consumables')) {
    redirect('/dashboard?unauthorized=1');
  }

  // Récupérer le catalogue des consommables, tous les médicaments, les fiches existantes, les patients et les éléments de catalogue
  const [clinic, allMedicines, pastDeliveries, patients, catalogItems] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: session.clinicId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        taxId: true,
        currency: true,
      },
    }),
    prisma.medicine.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.consumableDelivery.findMany({
      where: { clinicId: session.clinicId },
      include: {
        patient: {
          select: { id: true, patientNumber: true, firstName: true, lastName: true, phone: true },
        },
        items: {
          include: {
            medicine: true,
          },
          orderBy: [
            { category: 'asc' },
            { orderIndex: 'asc' },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    }),
    prisma.patient.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      select: { id: true, patientNumber: true, firstName: true, lastName: true, phone: true },
      orderBy: { lastName: 'asc' },
      take: 300,
    }),
    prisma.consumableCatalogItem.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      orderBy: [
        { category: 'asc' },
        { orderIndex: 'asc' },
        { name: 'asc' },
      ],
    }),
  ]);

  const clinicInfo = {
    name: clinic?.name || 'Clinique Betesda',
    email: clinic?.email || 'contact@betesda.com',
    phone: clinic?.phone || '034 51 365 45 / 034 53 689 59',
    taxId: clinic?.taxId || 'NIF: 3 005 710 430 - N° Stat: 86201 11 2021 0 08027',
    address: clinic?.address || 'Lot IVG 35 Antananarivo, Madagascar',
    currency: clinic?.currency || 'Ar',
  };

  return (
    <DashboardLayout user={session}>
      <div className="space-y-6">
        {/* En-tête masqué lors de l'impression A4 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
              <span>/</span>
              <Link href="/pharmacy" className="hover:text-blue-600">Pharmacie</Link>
              <span>/</span>
              <span className="text-slate-600 font-medium">Consommables, Actes & Hébergement</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              Fiches Consommables, Actes & Hébergement
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Médicaments, Actes infirmiers, Hébergement et Autres. Fiche A4 modifiable, émission de fiches vierges avec référence et saisie administrative.
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

        {/* Composant interactif Client */}
        <ConsumablesClient
          currentUser={session}
          clinicInfo={clinicInfo}
          allMedicines={allMedicines}
          initialDeliveries={pastDeliveries}
          patients={patients}
          initialCatalogItems={catalogItems}
        />
      </div>
    </DashboardLayout>
  );
}
