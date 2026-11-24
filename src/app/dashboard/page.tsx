import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardClient from './DashboardClient';
import prisma from '@/lib/prisma';

function isInternalTransferTx(tx: { category?: string | null; reference?: string | null }) {
  const cat = (tx.category || '').toLowerCase();
  const ref = tx.reference || '';
  return (
    ref.startsWith('VERS-') ||
    ref.startsWith('DEP-BQ-') ||
    ref.startsWith('RET-BQ-') ||
    ref.startsWith('BQ-INIT') ||
    cat.includes('versement') ||
    cat.includes('dépôt bancaire') ||
    cat.includes('retrait bancaire') ||
    cat.includes('reçu')
  );
}

function toLocalDateKey(dateInput: Date | string) {
  const d = new Date(dateInput);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // Bornes temporelles pour aujourd'hui
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  const isAdmin =
    session.role === 'SUPER_ADMIN' ||
    session.role === 'CLINIC_ADMIN' ||
    session.role === 'ACCOUNTANT';

  // Trouver l'entité Doctor si le rôle est DOCTOR
  let doctorEntity: any = null;
  if (session.role === 'DOCTOR') {
    doctorEntity = await prisma.doctor.findFirst({
      where: { userId: session.id },
    });
  }

  const [
    totalPatients,
    patientsToday,
    consultationsToday,
    appointmentsToday,
    unpaidSum,
    lowStockCount,
    expiringCount,
    recentAppointments,
    recentSales,
    salesTodayAgg,
    lowStockMedicines,
    recentPatients,
    recentConsultations,
    activeDoctorsCount,
    doctorAppointmentsToday,
    doctorConsultationsToday,
    doctorPrescriptionsCount,
    allCashTransactions,
    adminConsumableDeliveries,
    adminAuditLogs,
    clinicUsers,
    bankNameSetting,
  ] = await Promise.all([
    // Statistiques globales
    prisma.patient.count({ where: { clinicId: session.clinicId, deletedAt: null } }),
    prisma.patient.count({ where: { clinicId: session.clinicId, createdAt: { gte: today, lt: tomorrow }, deletedAt: null } }),
    prisma.consultation.count({ where: { patient: { clinicId: session.clinicId }, consultationDate: { gte: today, lt: tomorrow } } }),
    prisma.appointment.count({ where: { patient: { clinicId: session.clinicId }, appointmentDate: { gte: today, lt: tomorrow } } }),
    prisma.invoice.aggregate({
      where: { clinicId: session.clinicId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      _sum: { balance: true },
    }),
    prisma.medicine.count({ where: { clinicId: session.clinicId, isActive: true, currentStock: { lte: 10 } } }),
    prisma.medicine.count({ where: { clinicId: session.clinicId, isActive: true, expiryDate: { lte: thirtyDays } } }),

    // Rendez-vous du jour
    prisma.appointment.findMany({
      where: { patient: { clinicId: session.clinicId }, appointmentDate: { gte: today, lt: tomorrow } },
      include: { patient: true, doctor: { include: { user: true } } },
      orderBy: { startTime: 'asc' },
      take: 8,
    }),

    // Ventes pharmacie récentes (plus nombreuses pour Admin)
    prisma.pharmacySale.findMany({
      where: { clinicId: session.clinicId },
      include: {
        items: true,
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
      },
      orderBy: { saleDate: 'desc' },
      take: isAdmin ? 120 : 6,
    }),

    // Ventes pharmacie du jour
    prisma.pharmacySale.aggregate({
      where: { clinicId: session.clinicId, saleDate: { gte: today, lt: tomorrow } },
      _sum: { total: true },
      _count: true,
    }),

    // Médicaments en alerte stock
    prisma.medicine.findMany({
      where: { clinicId: session.clinicId, isActive: true, currentStock: { lte: 10 } },
      take: 8,
      orderBy: { currentStock: 'asc' },
    }),

    // Patients récents
    prisma.patient.findMany({
      where: { clinicId: session.clinicId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: isAdmin ? 60 : 6,
    }),

    // Consultations récentes (Médecin & Admin)
    prisma.consultation.findMany({
      where: { patient: { clinicId: session.clinicId } },
      include: {
        patient: true,
        doctor: { include: { user: true, specialty: true } },
        invoice: { include: { payments: true } },
      },
      orderBy: { consultationDate: 'desc' },
      take: isAdmin ? 120 : 6,
    }),

    // Nombre de médecins actifs
    prisma.doctor.count({ where: { clinicId: session.clinicId, user: { isActive: true } } }),

    // Spécifiques au médecin connecté (si DOCTOR)
    doctorEntity
      ? prisma.appointment.findMany({
          where: { doctorId: doctorEntity.id, appointmentDate: { gte: today, lt: tomorrow } },
          include: { patient: true },
          orderBy: { startTime: 'asc' },
        })
      : Promise.resolve([]),

    doctorEntity
      ? prisma.consultation.count({
          where: { doctorId: doctorEntity.id, consultationDate: { gte: today, lt: tomorrow } },
        })
      : Promise.resolve(0),

    doctorEntity
      ? prisma.prescription.count({
          where: { doctorId: doctorEntity.id },
        })
      : Promise.resolve(0),

    // Données financières & activités quotidiennes pour l'Administrateur
    isAdmin
      ? prisma.cashTransaction.findMany({
          where: { clinicId: session.clinicId },
          include: {
            performedBy: {
              select: { id: true, firstName: true, lastName: true, role: { select: { displayName: true } } },
            },
          },
          orderBy: { transactionDate: 'desc' },
        })
      : Promise.resolve([]),

    isAdmin
      ? prisma.consumableDelivery.findMany({
          where: { clinicId: session.clinicId },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
            items: true,
          },
          orderBy: { date: 'desc' },
          take: 60,
        })
      : Promise.resolve([]),

    isAdmin
      ? prisma.auditLog.findMany({
          where: { clinicId: session.clinicId },
          include: {
            user: { select: { firstName: true, lastName: true, role: { select: { displayName: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]),

    isAdmin
      ? prisma.user.findMany({
          where: { clinicId: session.clinicId },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),

    isAdmin
      ? prisma.setting.findFirst({
          where: { clinicId: session.clinicId, key: 'bank_name' },
        })
      : Promise.resolve(null),
  ]);

  // Calcul des soldes de trésorerie réels & données graphiques pour l'Admin
  let treasuryBalances = {
    petiteCaisse: 0,
    grandeCaisse: 0,
    banque: 0,
    totalTreasury: 0,
    bankName: bankNameSetting?.value || 'Banque',
  };
  let dailyChartData: { dateKey: string; label: string; Recettes: number; Depenses: number }[] = [];
  let monthlyChartData: { month: string; Recettes: number; Depenses: number }[] = [];

  if (isAdmin) {
    // 1. Soldes exacts des 3 caisses (identique à Gestion Solde /expenses)
    const petiteList = allCashTransactions.filter((e) => (e.cashRegister || 'PETITE_CAISSE') === 'PETITE_CAISSE');
    const petitesRecettes = petiteList.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
    const petitesSorties = petiteList
      .filter((e) => e.type === 'EXPENSE' && e.category !== 'Salaires & Paie')
      .reduce((s, e) => s + e.amount, 0);
    const petiteCaisse = Math.max(0, petitesRecettes - petitesSorties);

    const grandeList = allCashTransactions.filter((e) => e.cashRegister === 'GRANDE_CAISSE');
    const grandeRecettes = grandeList
      .filter((e) => e.type === 'INCOME' || (e.category || '').toLowerCase().includes('reçu'))
      .reduce((s, e) => s + e.amount, 0);
    const grandeSorties = allCashTransactions
      .filter(
        (e) =>
          (e.cashRegister === 'GRANDE_CAISSE' || e.category === 'Salaires & Paie') &&
          e.type === 'EXPENSE' &&
          !(e.category || '').toLowerCase().includes('reçu')
      )
      .reduce((s, e) => s + e.amount, 0);
    const grandeCaisse = grandeRecettes - grandeSorties;

    const banqueList = allCashTransactions.filter((e) => e.cashRegister === 'BANQUE');
    const banqueRecettes = banqueList.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
    const banqueSorties = banqueList.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
    const banque = banqueRecettes - banqueSorties;

    treasuryBalances = {
      petiteCaisse,
      grandeCaisse,
      banque,
      totalTreasury: petiteCaisse + grandeCaisse + banque,
      bankName: bankNameSetting?.value || 'Banque',
    };

    // 2. Graphique des 14 derniers jours (données réelles)
    const realTxs = allCashTransactions.filter((tx) => !isInternalTransferTx(tx));
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = toLocalDateKey(d);
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const dayTxs = realTxs.filter((tx) => toLocalDateKey(tx.transactionDate) === key);
      const Recettes = dayTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const Depenses = dayTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      dailyChartData.push({ dateKey: key, label, Recettes, Depenses });
    }

    // 3. Graphique des 6 derniers mois (données réelles)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      const monthTxs = realTxs.filter((tx) => {
        const td = new Date(tx.transactionDate);
        return `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}` === mKey;
      });
      const Recettes = monthTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const Depenses = monthTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      monthlyChartData.push({ month: label.charAt(0).toUpperCase() + label.slice(1), Recettes, Depenses });
    }
  }

  const userNameMap: Record<string, string> = {};
  clinicUsers.forEach((u) => {
    userNameMap[u.id] = `${u.firstName.trim()} ${u.lastName.trim()}`;
  });

  const initialStats = {
    totalPatients,
    patientsToday,
    consultationsToday,
    appointmentsToday,
    unpaidAmount: unpaidSum._sum.balance || 0,
    lowStockCount,
    expiringCount,
    salesTodayAmount: salesTodayAgg._sum.total || 0,
    salesTodayCount: salesTodayAgg._count || 0,
    activeDoctorsCount,
    doctorConsultationsToday,
    doctorPrescriptionsCount,
  };

  return (
    <DashboardLayout user={session}>
      <DashboardClient
        user={session}
        initialStats={initialStats}
        recentAppointments={JSON.parse(JSON.stringify(recentAppointments))}
        recentSales={JSON.parse(JSON.stringify(recentSales))}
        lowStockMedicines={JSON.parse(JSON.stringify(lowStockMedicines))}
        recentPatients={JSON.parse(JSON.stringify(recentPatients))}
        recentConsultations={JSON.parse(JSON.stringify(recentConsultations))}
        doctorAppointments={JSON.parse(JSON.stringify(doctorAppointmentsToday))}
        treasuryBalances={treasuryBalances}
        adminCashTransactions={JSON.parse(JSON.stringify(allCashTransactions.slice(0, 250)))}
        adminConsumableDeliveries={JSON.parse(JSON.stringify(adminConsumableDeliveries))}
        adminAuditLogs={JSON.parse(JSON.stringify(adminAuditLogs))}
        dailyChartData={dailyChartData}
        monthlyChartData={monthlyChartData}
        userNameMap={userNameMap}
      />
    </DashboardLayout>
  );
}
