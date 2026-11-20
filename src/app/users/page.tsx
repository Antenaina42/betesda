import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import UsersClient from './UsersClient';
import { hasModuleAccess } from '@/lib/permissions';
import { RoleType } from '@prisma/client';

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasModuleAccess(session.role, '/users')) {
    redirect('/dashboard?unauthorized=1');
  }

  // 4 types d'utilisateurs autorisés : Accueil, Pharmacien, Administrateur, Super Admin
  const ALLOWED_ROLE_NAMES: RoleType[] = ['RECEPTIONIST', 'PHARMACIST', 'CLINIC_ADMIN', 'SUPER_ADMIN'];

  const [employees, users, roles] = await Promise.all([
    prisma.employee.findMany({
      where: { clinicId: session.clinicId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.user.findMany({
      where: { clinicId: session.clinicId },
      include: {
        role: true,
        doctorProfile: {
          include: {
            specialty: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.role.findMany({
      where: {
        name: { in: ALLOWED_ROLE_NAMES },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <DashboardLayout user={session}>
      <div className="space-y-6">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
              <span>/</span>
              <span className="text-slate-600 font-medium">Administration</span>
              <span>/</span>
              <span className="text-slate-900 font-semibold">Gestion des Utilisateurs &amp; Employés</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight flex items-center gap-2.5">
              <span>Gestion des Utilisateurs &amp; Personnel</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Répertoire de tous les employés (Nom, prénom, téléphone, poste, salaire) et gestion des 4 types de comptes utilisateurs (Accueil, Pharmacien, Administrateur, Super Admin).
            </p>
          </div>
        </div>

        {/* Client Interactive Component */}
        <UsersClient
          initialEmployees={JSON.parse(JSON.stringify(employees))}
          initialUsers={JSON.parse(JSON.stringify(users))}
          roles={roles}
          currentUserRole={session.role}
          currentUserId={session.id}
        />
      </div>
    </DashboardLayout>
  );
}
