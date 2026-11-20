import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import POSClient from './POSClient';
import Link from 'next/link';

import { hasModuleAccess } from '@/lib/permissions';

export default async function PharmacySalesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasModuleAccess(session.role, '/pharmacy')) {
    redirect('/dashboard?unauthorized=1');
  }

  const [clinic, medicines, patients, recentSales, employees] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: session.clinicId },
    }),
    prisma.medicine.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.patient.findMany({
      where: { clinicId: session.clinicId, deletedAt: null },
      select: { id: true, patientNumber: true, firstName: true, lastName: true, phone: true },
      orderBy: { lastName: 'asc' },
    }),
    prisma.pharmacySale.findMany({
      where: { clinicId: session.clinicId },
      include: {
        items: {
          include: { medicine: true },
        },
        patient: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.employee.findMany({
      where: { clinicId: session.clinicId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ]);

  const isPharmacist = session.role === 'PHARMACIST';
  const isReceptionist = session.role === 'RECEPTIONIST';

  return (
    <DashboardLayout user={session}>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
          <span>/</span>
          {!isReceptionist && (
            <>
              <Link href="/pharmacy" className="hover:text-blue-600">Pharmacie</Link>
              <span>/</span>
            </>
          )}
          <span className="text-slate-600 font-medium">
            {isReceptionist
              ? 'Commande de paiement'
              : isPharmacist
              ? 'Demande de Caisse'
              : 'Point de Vente (POS)'}
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {isReceptionist
              ? 'Commande de paiement'
              : isPharmacist
              ? 'Demandes de Caisse & Délivrance'
              : 'Caisse Pharmacie & Délivrance (POS)'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isReceptionist
              ? "Encaissement des commandes de médicaments transmises par le pharmacien"
              : isPharmacist
              ? "Enregistrement des demandes de médicaments pour transmission à l'accueil et validation de la délivrance"
              : 'Délivrance rapide des médicaments, déduction automatique des stocks et encaissement'}
          </p>
        </div>

        <POSClient
          clinic={clinic}
          currentUser={session}
          medicines={medicines}
          patients={patients}
          employees={employees}
          initialSales={recentSales}
        />
      </div>
    </DashboardLayout>
  );
}
