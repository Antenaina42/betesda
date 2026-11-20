import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import DoctorsClient from './DoctorsClient';
import { hasModuleAccess } from '@/lib/permissions';

export default async function DoctorsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!hasModuleAccess(session.role, '/doctors')) {
    redirect('/dashboard?unauthorized=1');
  }

  const [doctors, specialties] = await Promise.all([
    prisma.doctor.findMany({
      where: { clinicId: session.clinicId },
      include: {
        user: true,
        specialty: true,
        _count: {
          select: {
            consultations: true,
            appointments: true,
            prescriptions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.specialty.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <DashboardLayout user={session}>
      <DoctorsClient
        user={session}
        initialDoctors={doctors as any}
        specialties={specialties}
      />
    </DashboardLayout>
  );
}
