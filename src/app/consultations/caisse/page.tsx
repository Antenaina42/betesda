import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import ConsultationCaisseClient from './ConsultationCaisseClient';
import { hasModuleAccess } from '@/lib/permissions';
import { DEFAULT_CONSULTATION_ACTS, ConsultationAct } from '@/lib/consultationActs';

export default async function ConsultationCaissePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Accessible par Super Admin, Admin Clinique, Accueil et Pharmacie
  if (!hasModuleAccess(session.role, '/consultations/caisse')) {
    redirect('/dashboard?unauthorized=1');
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Récupération des médecins, des patients récents, des consultations du jour, des actes configurés et des actes dentaires
  const [doctors, patients, todayConsultations, actsSetting, dentalActs] = await Promise.all([
    prisma.doctor.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true } },
        specialty: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.patient.findMany({
      where: { clinicId: session.clinicId, deletedAt: null },
      select: {
        id: true,
        patientNumber: true,
        firstName: true,
        lastName: true,
        phone: true,
        gender: true,
        birthDate: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 60,
    }),
    prisma.consultation.findMany({
      where: {
        patient: { clinicId: session.clinicId },
        createdAt: { gte: startOfToday },
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
            items: true,
          },
        },
        vitalSigns: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.setting.findUnique({
      where: {
        clinicId_key: {
          clinicId: session.clinicId,
          key: 'consultation_acts',
        },
      },
    }),
    prisma.dentalAct.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  let finalDentalActs = dentalActs;
  if (finalDentalActs.length === 0) {
    const { DEFAULT_DENTAL_ACTS } = await import('@/lib/dentistry-acts');
    await prisma.dentalAct.createMany({
      data: DEFAULT_DENTAL_ACTS.map((act) => ({
        clinicId: session.clinicId,
        name: act.name,
        price: act.price,
        description: act.description,
        isActive: true,
      })),
    });
    finalDentalActs = await prisma.dentalAct.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  let initialActs: ConsultationAct[] = DEFAULT_CONSULTATION_ACTS;
  if (actsSetting?.value) {
    try {
      const parsed = JSON.parse(actsSetting.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        initialActs = parsed;
      }
    } catch {}
  }

  return (
    <DashboardLayout user={session}>
      <ConsultationCaisseClient
        user={session}
        doctors={doctors}
        initialPatients={patients}
        initialConsultations={todayConsultations}
        initialActs={initialActs}
        initialDentalActs={JSON.parse(JSON.stringify(finalDentalActs))}
      />
    </DashboardLayout>
  );
}
