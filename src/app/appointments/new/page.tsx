import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import AppointmentFormClient from './AppointmentFormClient';
import Link from 'next/link';
import { PauseCircle } from 'lucide-react';

export default async function NewAppointmentPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [patients, doctors] = await Promise.all([
    prisma.patient.findMany({
      where: { clinicId: session.clinicId, deletedAt: null },
      select: { id: true, patientNumber: true, firstName: true, lastName: true },
      orderBy: { lastName: 'asc' },
    }),
    prisma.doctor.findMany({
      where: { clinicId: session.clinicId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        specialty: { select: { name: true } },
      },
    }),
  ]);

  return (
    <DashboardLayout user={session}>
      <div className="space-y-6 w-full">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
          <span>/</span>
          <Link href="/appointments" className="hover:text-blue-600">Rendez-vous</Link>
          <span>/</span>
          <span className="text-slate-600 font-medium">Nouveau RDV</span>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Programmer un Rendez-vous
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Planification d'une consultation médicale ou d'un acte spécialisé
          </p>
        </div>

        {/* Bannière Module en pause */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-900 text-xs shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <PauseCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold">Module en pause :</span> La prise de rendez-vous est actuellement suspendue. L'enregistrement des patients et les consultations se font directement à l'accueil et en caisse.
          </div>
        </div>

        <AppointmentFormClient patients={patients} doctors={doctors} />
      </div>
    </DashboardLayout>
  );
}
