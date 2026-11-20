import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import PatientsClient from './PatientsClient';

export default async function PatientsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [total, patients, doctors] = await Promise.all([
    prisma.patient.count({
      where: { clinicId: session.clinicId, deletedAt: null },
    }),
    prisma.patient.findMany({
      where: { clinicId: session.clinicId, deletedAt: null },
      include: {
        primaryDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            specialty: { select: { name: true } },
          },
        },
        medicalRecord: true,
        _count: {
          select: {
            consultations: true,
            prescriptions: true,
            invoices: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    prisma.doctor.findMany({
      where: { clinicId: session.clinicId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        specialty: { select: { name: true } },
      },
      orderBy: { lastName: 'asc' },
    }),
  ]);

  return (
    <DashboardLayout user={session}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
              <span>/</span>
              <span className="text-slate-600 font-medium">Patients</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              Gestion des Patients ({total})
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Répertoire des dossiers médicaux informatisés de la clinique • CRUD complet
            </p>
          </div>

          <Link
            href="/patients/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouveau Patient</span>
          </Link>
        </div>

        <PatientsClient
          initialPatients={patients}
          doctors={doctors}
          userRole={session.role}
        />
      </div>
    </DashboardLayout>
  );
}
