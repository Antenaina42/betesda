'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Users,
  Pill,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Receipt,
  UserCheck,
  Stethoscope,
  ClipboardList,
  ShoppingBag,
  PackagePlus,
  Wallet,
  Landmark,
  ArrowRightLeft,
  Calendar,
  Clock,
  ShieldCheck,
  History,
  FileCheck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { AuthUser } from '@/types';
import { getRoleBadgeLabel } from '@/lib/permissions';

interface TreasuryBalances {
  petiteCaisse: number;
  grandeCaisse: number;
  banque: number;
  totalTreasury: number;
  bankName: string;
}

interface DashboardClientProps {
  user: AuthUser;
  initialStats: any;
  recentAppointments?: any[];
  recentSales?: any[];
  lowStockMedicines?: any[];
  recentPatients?: any[];
  recentConsultations?: any[];
  doctorAppointments?: any[];
  treasuryBalances?: TreasuryBalances;
  adminCashTransactions?: any[];
  adminConsumableDeliveries?: any[];
  adminAuditLogs?: any[];
  dailyChartData?: { dateKey: string; label: string; Recettes: number; Depenses: number }[];
  monthlyChartData?: { month: string; Recettes: number; Depenses: number }[];
  userNameMap?: Record<string, string>;
}

function toLocalDateKey(dateInput: Date | string) {
  const d = new Date(dateInput);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

function formatTimeOnly(dateInput: Date | string) {
  return new Date(dateInput).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRegisterBadge(cashRegister?: string) {
  if (cashRegister === 'BANQUE') return { label: 'Banque', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  if (cashRegister === 'GRANDE_CAISSE') return { label: 'Grande Caisse', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  return { label: 'Petite Caisse', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

export default function DashboardClient({
  user,
  initialStats,
  recentSales = [],
  lowStockMedicines = [],
  recentPatients = [],
  recentConsultations = [],
  doctorAppointments = [],
  treasuryBalances = { petiteCaisse: 0, grandeCaisse: 0, banque: 0, totalTreasury: 0, bankName: 'Banque' },
  adminCashTransactions = [],
  adminConsumableDeliveries = [],
  adminAuditLogs = [],
  dailyChartData = [],
  monthlyChartData = [],
  userNameMap = {},
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const [showUnauthorizedAlert, setShowUnauthorizedAlert] = useState(
    searchParams?.get('unauthorized') === '1'
  );

  const roleInfo = getRoleBadgeLabel(user.role);
  const isReceptionist = user.role === 'RECEPTIONIST';
  const isPharmacist = user.role === 'PHARMACIST';
  const isDoctor = user.role === 'DOCTOR';
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'CLINIC_ADMIN';

  // Contrôles interactifs du tableau de bord Administrateur
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const yesterdayKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateKey(d);
  }, []);

  const [activityMode, setActivityMode] = useState<'TODAY' | 'YESTERDAY' | 'LAST_7' | 'CUSTOM'>('TODAY');
  const [customDate, setCustomDate] = useState<string>(todayKey);
  const [activityTab, setActivityTab] = useState<'ALL' | 'CASH' | 'CLINIC' | 'PHARMACY' | 'AUDIT'>('ALL');
  const [chartPeriod, setChartPeriod] = useState<'DAILY' | 'MONTHLY'>('DAILY');

  const activeDateKey = activityMode === 'TODAY' ? todayKey : activityMode === 'YESTERDAY' ? yesterdayKey : customDate;

  const isInSelectedPeriod = (dateInput: Date | string) => {
    const key = toLocalDateKey(dateInput);
    if (activityMode === 'LAST_7') {
      const target = new Date(dateInput).getTime();
      const limit = new Date();
      limit.setHours(0, 0, 0, 0);
      limit.setDate(limit.getDate() - 6);
      return target >= limit.getTime();
    }
    return key === activeDateKey;
  };

  // Agrégation des statistiques et activités quotidiennes pour l'Admin
  const periodStats = useMemo(() => {
    if (!isAdmin) return null;

    const cashList = adminCashTransactions.filter((t) => isInSelectedPeriod(t.transactionDate));
    const realCashList = cashList.filter((t) => !isInternalTransferTx(t));

    const totalIncomes = realCashList
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const totalExpenses = realCashList
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const transfersCount = cashList.filter((t) => isInternalTransferTx(t)).length;

    const consultIncome = realCashList
      .filter((t) => t.type === 'INCOME' && (t.category || '').toLowerCase().includes('consult'))
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const pharmaIncome = realCashList
      .filter((t) => t.type === 'INCOME' && (t.category || '').toLowerCase().includes('pharm'))
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const careIncome = Math.max(0, totalIncomes - consultIncome - pharmaIncome);

    const consultList = recentConsultations.filter((c) => isInSelectedPeriod(c.consultationDate));
    const salesList = recentSales.filter((s) => isInSelectedPeriod(s.saleDate));
    const deliveryList = adminConsumableDeliveries.filter((d) => isInSelectedPeriod(d.date));
    const newPatientsList = recentPatients.filter((p) => isInSelectedPeriod(p.createdAt));
    const auditList = adminAuditLogs.filter((a) => isInSelectedPeriod(a.createdAt));

    const salesAmount = salesList.reduce((s, item) => s + Number(item.total || 0), 0);

    return {
      cashList,
      realCashList,
      totalIncomes,
      totalExpenses,
      transfersCount,
      consultIncome,
      pharmaIncome,
      careIncome,
      consultList,
      salesList,
      salesAmount,
      deliveryList,
      newPatientsList,
      auditList,
    };
  }, [
    isAdmin,
    adminCashTransactions,
    recentConsultations,
    recentSales,
    adminConsumableDeliveries,
    recentPatients,
    adminAuditLogs,
    activityMode,
    activeDateKey,
  ]);

  // Flux unifié chronologique des activités de la journée / période
  const unifiedFeed = useMemo(() => {
    if (!periodStats) return [];

    type FeedItem = {
      id: string;
      timestamp: string;
      kind: 'CASH_IN' | 'CASH_OUT' | 'TRANSFER' | 'CONSULTATION' | 'PHARMACY' | 'CARE' | 'PATIENT' | 'AUDIT';
      badge: string;
      badgeCls: string;
      title: string;
      subtitle: string;
      actor: string;
      registerLabel?: string;
      registerCls?: string;
      amount?: number;
      amountType?: 'IN' | 'OUT' | 'TRANSFER' | 'NEUTRAL';
    };

    const items: FeedItem[] = [];

    // 1. Mouvements de caisses (Encaissements, Dépenses, Salaires, Transferts)
    periodStats.cashList.forEach((tx: any) => {
      const isTransfer = isInternalTransferTx(tx);
      const reg = getRegisterBadge(tx.cashRegister);
      const actor = tx.performedBy
        ? `${tx.performedBy.firstName} ${tx.performedBy.lastName}`.trim()
        : 'Système / Direction';

      if (isTransfer) {
        items.push({
          id: `tx-${tx.id}`,
          timestamp: tx.transactionDate,
          kind: 'TRANSFER',
          badge: 'Transfert Caisse',
          badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
          title: tx.category || 'Mouvement inter-caisses',
          subtitle: tx.description || tx.reference || 'Transfert de fonds',
          actor,
          registerLabel: reg.label,
          registerCls: reg.cls,
          amount: tx.amount,
          amountType: 'TRANSFER',
        });
      } else if (tx.type === 'INCOME') {
        items.push({
          id: `tx-${tx.id}`,
          timestamp: tx.transactionDate,
          kind: 'CASH_IN',
          badge: `Encaissement • ${tx.category}`,
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: tx.description || tx.category,
          subtitle: tx.reference ? `Réf : ${tx.reference} • ${tx.paymentMethod || 'CASH'}` : tx.paymentMethod || 'CASH',
          actor,
          registerLabel: reg.label,
          registerCls: reg.cls,
          amount: tx.amount,
          amountType: 'IN',
        });
      } else {
        items.push({
          id: `tx-${tx.id}`,
          timestamp: tx.transactionDate,
          kind: 'CASH_OUT',
          badge: `Sortie • ${tx.category}`,
          badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
          title: tx.description || tx.category,
          subtitle: tx.reference ? `Réf : ${tx.reference} • ${tx.paymentMethod || 'CASH'}` : tx.paymentMethod || 'CASH',
          actor,
          registerLabel: reg.label,
          registerCls: reg.cls,
          amount: tx.amount,
          amountType: 'OUT',
        });
      }
    });

    // 2. Consultations médicales / dentaires
    periodStats.consultList.forEach((c: any) => {
      const doctorName = c.doctor?.user
        ? `Dr ${c.doctor.user.firstName} ${c.doctor.user.lastName}`
        : 'Praticien clinique';
      const patientName = c.patient ? `${c.patient.lastName} ${c.patient.firstName}`.trim() : 'Patient';
      const invAmount = c.invoice?.totalAmount;
      items.push({
        id: `cons-${c.id}`,
        timestamp: c.consultationDate,
        kind: 'CONSULTATION',
        badge: 'Consultation',
        badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
        title: `${patientName} — ${c.reason || 'Consultation générale'}`,
        subtitle: `${c.doctor?.specialty?.name || 'Médecine'} • Statut : ${c.invoice?.status === 'PAID' ? 'Payée' : 'En attente'}`,
        actor: doctorName,
        amount: invAmount,
        amountType: invAmount ? 'NEUTRAL' : undefined,
      });
    });

    // 3. Commandes & Ventes Pharmacie POS
    periodStats.salesList.forEach((sale: any) => {
      const cashierName = sale.cashierId && userNameMap[sale.cashierId]
        ? userNameMap[sale.cashierId]
        : 'Accueil / Pharmacie';
      items.push({
        id: `sale-${sale.id}`,
        timestamp: sale.saleDate,
        kind: 'PHARMACY',
        badge: 'Pharmacie POS',
        badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        title: `${sale.saleNumber} • ${sale.customerName || 'Client de passage'}`,
        subtitle: `${sale.items?.length || 0} produit(s) délivré(s) • ${sale.paymentMethod} • ${sale.status === 'PAID' ? 'Encaissé' : sale.status}`,
        actor: cashierName,
        amount: sale.total,
        amountType: 'NEUTRAL',
      });
    });

    // 4. Actes infirmiers, soins & hébergements
    periodStats.deliveryList.forEach((del: any) => {
      items.push({
        id: `del-${del.id}`,
        timestamp: del.date,
        kind: 'CARE',
        badge: 'Actes & Soins',
        badgeCls: 'bg-teal-50 text-teal-700 border-teal-200',
        title: `${del.deliveryNumber} • ${del.patientName || del.recipientName}`,
        subtitle: `${del.reason || 'Soins & consommables'} • ${del.items?.length || 0} acte(s)/article(s)`,
        actor: del.deliveredByName || 'Équipe Soins',
        amount: del.totalAmount,
        amountType: 'NEUTRAL',
      });
    });

    // 5. Nouveaux patients enregistrés
    periodStats.newPatientsList.forEach((p: any) => {
      items.push({
        id: `pat-${p.id}`,
        timestamp: p.createdAt,
        kind: 'PATIENT',
        badge: 'Nouveau Patient',
        badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
        title: `${p.lastName} ${p.firstName} (${p.patientNumber})`,
        subtitle: `Tél : ${p.phone || 'Non renseigné'} • Dossier créé`,
        actor: 'Accueil',
      });
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [periodStats, userNameMap]);

  const filteredFeed = useMemo(() => {
    if (activityTab === 'CASH') {
      return unifiedFeed.filter((i) => i.kind === 'CASH_IN' || i.kind === 'CASH_OUT' || i.kind === 'TRANSFER');
    }
    if (activityTab === 'CLINIC') {
      return unifiedFeed.filter((i) => i.kind === 'CONSULTATION' || i.kind === 'CARE' || i.kind === 'PATIENT');
    }
    if (activityTab === 'PHARMACY') {
      return unifiedFeed.filter((i) => i.kind === 'PHARMACY');
    }
    return unifiedFeed;
  }, [unifiedFeed, activityTab]);

  const todayDisplayLabel = useMemo(() => {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Alerte Accès Protégé */}
      {showUnauthorizedAlert && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Espace de travail protégé</p>
              <p className="text-[11px] text-amber-800">
                Votre profil <strong>{roleInfo.label}</strong> a été redirigé vers votre espace dédié.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUnauthorizedAlert(false)}
            className="text-amber-700 hover:text-amber-900 font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner / Welcome adapté au rôle */}
      <div
        className={`p-6 rounded-2xl text-white shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          isReceptionist
            ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600'
            : isPharmacist
            ? 'bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-700'
            : 'bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900'
        }`}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-white/15 uppercase tracking-wider backdrop-blur-xs">
              {roleInfo.label} • {user.clinicName || 'Clinique Betesda'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/10 text-blue-100 capitalize">
              <Calendar className="w-3.5 h-3.5" />
              {todayDisplayLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">
            Bonjour, {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-white/90 mt-1 max-w-2xl">
            {isReceptionist ? (
              <>
                Espace Accueil &amp; Caisse de Consultation. Vous avez{' '}
                <span className="font-bold underline">{initialStats.consultationsToday} consultations</span> encaissées aujourd'hui et{' '}
                <span className="font-bold underline">{initialStats.patientsToday} nouveaux patients</span> accueillis.
              </>
            ) : isPharmacist ? (
              <>
                Espace Pharmacie &amp; Demandes de Caisse. Aujourd'hui :{' '}
                <span className="font-bold underline">{formatCurrency(initialStats.salesTodayAmount)}</span> de ventes ({initialStats.salesTodayCount} tickets) et{' '}
                <span className="font-bold underline">{initialStats.lowStockCount} alertes de stock</span>.
              </>
            ) : isDoctor ? (
              <>
                Espace Praticien : vous avez{' '}
                <span className="font-bold underline">{doctorAppointments.length} rendez-vous</span> prévus aujourd'hui et{' '}
                <span className="font-bold underline">{initialStats.doctorConsultationsToday} consultations</span> réalisées ce jour.
              </>
            ) : (
              <>
                Vue de supervision quotidienne de la clinique :{' '}
                <span className="font-bold underline">{initialStats.consultationsToday} consultation(s)</span>,{' '}
                <span className="font-bold underline">{initialStats.salesTodayCount} vente(s) pharmacie</span> et suivi en temps réel des soldes et opérations du jour.
              </>
            )}
          </p>
        </div>

        {/* Boutons d'Action Rapide Ciblés */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isReceptionist && (
            <>
              <Link
                href="/consultations/caisse"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white text-amber-800 hover:bg-amber-50 shadow-sm transition-colors"
              >
                <Stethoscope className="w-4 h-4 text-amber-600" />
                <span>Caisse consultation</span>
              </Link>
              <Link
                href="/pharmacy/sales"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white text-blue-700 hover:bg-blue-50 shadow-sm transition-colors"
              >
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                <span>Commande de paiement</span>
              </Link>
            </>
          )}

          {isPharmacist && (
            <>
              <Link
                href="/pharmacy/sales"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 shadow-sm transition-colors"
              >
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                <span>Demande de Caisse</span>
              </Link>
              <Link
                href="/pharmacy/stock"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-indigo-900/30 hover:bg-indigo-900/40 text-white border border-white/30 backdrop-blur-xs transition-colors"
              >
                <PackagePlus className="w-4 h-4" />
                <span>Gestion Stock</span>
              </Link>
            </>
          )}

          {isAdmin && (
            <>
              <Link
                href="/expenses"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors"
              >
                <Wallet className="w-4 h-4" />
                <span>Gestion Solde</span>
              </Link>
              <Link
                href="/payments?tab=daily-sheet"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-sm transition-colors"
              >
                <ClipboardList className="w-4 h-4 text-blue-600" />
                <span>Bordereau Journalier</span>
              </Link>
              <Link
                href="/payments?tab=all"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/25 backdrop-blur-xs transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                <span>Flux Financiers</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VUE 1 : ACCUEIL                                                           */}
      {/* ========================================================================= */}
      {isReceptionist && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Consultations du jour</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-800">{initialStats.consultationsToday}</span>
                  <span className="text-xs text-amber-600 font-bold">Encaissées</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Receipt className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nouveaux Patients</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-800">{initialStats.patientsToday}</span>
                  <span className="text-xs text-emerald-600 font-bold">Aujourd'hui</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Patients</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-800">{initialStats.totalPatients}</span>
                  <span className="text-xs text-slate-400">Dossiers</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-white rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Module Caisse</p>
                <Link href="/consultations/caisse" className="inline-block mt-1 text-xs font-extrabold text-amber-700 hover:underline">
                  Ouvrir l'encaissement →
                </Link>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <Stethoscope className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Dernières Consultations Encaissées</h3>
                </div>
                <Link href="/consultations/caisse" className="text-xs text-amber-600 hover:underline font-bold">
                  + Nouvel Encaissement (Double Ticket)
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {recentConsultations.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">Aucune consultation enregistrée récemment.</p>
                ) : (
                  recentConsultations.map((c: any) => (
                    <div key={c.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{c.patient?.lastName} {c.patient?.firstName}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatDateTime(c.consultationDate)} • {c.reason || 'Consultation Médecine Générale'}
                        </p>
                      </div>
                      <Link
                        href="/consultations/caisse"
                        className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold hover:bg-amber-100 transition-colors"
                      >
                        Voir Caisse
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-4 p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Patients Récents</h3>
                </div>
                <Link href="/patients/new" className="text-xs text-blue-600 hover:underline font-bold">+ Ajouter</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {recentPatients.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">Aucun patient récent.</p>
                ) : (
                  recentPatients.map((p: any) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-800">{p.lastName} {p.firstName}</p>
                        <p className="text-[11px] text-slate-400">{p.patientNumber} • {p.phone || 'Pas de tél'}</p>
                      </div>
                      <Link
                        href="/consultations/caisse"
                        className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold"
                      >
                        Encaisser
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VUE 2 : PHARMACIE                                                         */}
      {/* ========================================================================= */}
      {isPharmacist && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recettes Pharmacie</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-extrabold text-slate-800">{formatCurrency(initialStats.salesTodayAmount)}</span>
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold">Aujourd'hui</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ventes du jour</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-800">{initialStats.salesTodayCount}</span>
                  <span className="text-xs text-indigo-600 font-bold">Tickets délivrés</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Receipt className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ruptures &amp; Stocks Bas</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-rose-600">{initialStats.lowStockCount}</span>
                  <span className="text-xs text-rose-600 font-semibold">À réapprovisionner</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Périmés / &lt; 30j</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-amber-600">{initialStats.expiringCount}</span>
                  <span className="text-xs text-amber-600 font-semibold">À surveiller</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Pill className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Dernières Demandes de Caisse &amp; Délivrances</h3>
                </div>
                <Link href="/pharmacy/sales" className="text-xs text-indigo-600 hover:underline font-bold">
                  Demandes de Caisse →
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {recentSales.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">Aucune vente enregistrée.</p>
                ) : (
                  recentSales.slice(0, 6).map((sale: any) => (
                    <div key={sale.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-600">{sale.saleNumber}</span>
                          <span className="text-slate-700 font-semibold">{sale.customerName}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatDateTime(sale.saleDate)} • {sale.items?.length || 0} produit(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-slate-900">{formatCurrency(sale.total)}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {sale.paymentMethod}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-5 p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  <h3 className="font-bold text-slate-800 text-sm">Médicaments en Alerte Stock</h3>
                </div>
                <Link href="/pharmacy/stock" className="text-xs text-rose-600 hover:underline font-bold">Gérer les stocks →</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {lowStockMedicines.length === 0 ? (
                  <p className="py-8 text-center text-xs text-emerald-600 font-semibold">
                    ✓ Tous les stocks sont au-dessus du seuil d'alerte.
                  </p>
                ) : (
                  lowStockMedicines.slice(0, 5).map((med: any) => (
                    <div key={med.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{med.name}</p>
                        <p className="text-[11px] text-slate-400">{med.dosage} • {med.form}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          med.currentStock <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {med.currentStock <= 0 ? 'Rupture' : `${med.currentStock} restant(s)`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VUE 3 : ADMINISTRATEUR (BIEN PRÉSENTÉ + SOLDES + ACTIVITÉS QUOTIDIENNES)  */}
      {/* ========================================================================= */}
      {!isReceptionist && !isPharmacist && (
        <div className="space-y-6">
          {/* 1. ÉTAT DES SOLDES EN TEMPS RÉEL (PETITE CAISSE, GRANDE CAISSE, BANQUE, TRÉSORERIE) */}
          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/expenses"
                className="group p-4 rounded-2xl bg-gradient-to-br from-white to-emerald-50/70 border border-emerald-200 hover:border-emerald-400 shadow-xs transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Petite Caisse (Accueil)
                  </span>
                  <Wallet className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-900 tracking-tight">
                    {formatCurrency(treasuryBalances.petiteCaisse)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                    <span>Caisse de réception</span>
                    <span className="text-emerald-700 font-bold group-hover:underline">Gérer →</span>
                  </div>
                </div>
              </Link>

              <Link
                href="/expenses"
                className="group p-4 rounded-2xl bg-gradient-to-br from-white to-blue-50/70 border border-blue-200 hover:border-blue-400 shadow-xs transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-900 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Grande Caisse (Direction)
                  </span>
                  <CreditCard className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <div className="text-2xl font-black text-blue-900 tracking-tight">
                    {formatCurrency(treasuryBalances.grandeCaisse)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                    <span>Coffre administrateur</span>
                    <span className="text-blue-700 font-bold group-hover:underline">Gérer →</span>
                  </div>
                </div>
              </Link>

              <Link
                href="/expenses"
                className="group p-4 rounded-2xl bg-gradient-to-br from-white to-indigo-50/70 border border-indigo-200 hover:border-indigo-400 shadow-xs transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    {treasuryBalances.bankName || 'Banque'}
                  </span>
                  <Landmark className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <div className="text-2xl font-black text-indigo-900 tracking-tight">
                    {formatCurrency(treasuryBalances.banque)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                    <span>Solde bancaire disponible</span>
                    <span className="text-indigo-700 font-bold group-hover:underline">Gérer →</span>
                  </div>
                </div>
              </Link>

              <Link
                href="/expenses"
                className="group p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 shadow-sm transition-all space-y-2 text-white"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/15 text-emerald-300 uppercase tracking-wider">
                    Trésorerie Totale
                  </span>
                  <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <div className="text-2xl font-black text-white tracking-tight">
                    {formatCurrency(treasuryBalances.totalTreasury)}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 flex items-center justify-between">
                    <span>Cumul des 3 comptes</span>
                    <span className="text-emerald-300 font-bold group-hover:underline">Gestion Solde →</span>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* 2. BARRE DE PÉRIODE & KPIs DE L'ACTIVITÉ QUOTIDIENNE */}
          {isAdmin && periodStats && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span>Activités Quotidiennes de la Clinique</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Suivi en direct des encaissements, dépenses, consultations, ventes pharmacie et soins infirmiers.
                  </p>
                </div>

                {/* Sélecteur de journée / période */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActivityMode('TODAY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activityMode === 'TODAY'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Aujourd'hui
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityMode('YESTERDAY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activityMode === 'YESTERDAY'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Hier
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityMode('LAST_7')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activityMode === 'LAST_7'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    7 derniers jours
                  </button>
                  <input
                    type="date"
                    value={activeDateKey}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCustomDate(e.target.value);
                        setActivityMode('CUSTOM');
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-hidden focus:border-blue-500"
                    title="Choisir une date précise"
                  />
                </div>
              </div>

              {/* 4 KPIs de la journée sélectionnée */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Recettes encaissées</p>
                    <p className="text-xl font-black text-emerald-700 mt-1">{formatCurrency(periodStats.totalIncomes)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {periodStats.realCashList.filter((t) => t.type === 'INCOME').length} entrée(s) • hors transferts
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Dépenses &amp; Sorties</p>
                    <p className="text-xl font-black text-rose-700 mt-1">{formatCurrency(periodStats.totalExpenses)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {periodStats.realCashList.filter((t) => t.type === 'EXPENSE').length} sortie(s) • {periodStats.transfersCount} transfert(s)
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                    <ArrowDownRight className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Consultations &amp; Soins</p>
                    <p className="text-xl font-black text-blue-800 mt-1">
                      {periodStats.consultList.length} <span className="text-xs font-bold">consult.</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {periodStats.deliveryList.length} acte(s)/soin(s) • {periodStats.newPatientsList.length} nouveau(x) patient(s)
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Ventes Pharmacie</p>
                    <p className="text-xl font-black text-indigo-800 mt-1">
                      {formatCurrency(periodStats.salesAmount)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {periodStats.salesList.length} ticket(s) POS • {initialStats.lowStockCount} alerte(s) stock
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                    <Pill className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* 3. JOURNAL DÉTAILLÉ DES ACTIVITÉS QUOTIDIENNES + PANNEAU SYNTHÈSE */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Flux chronologique des opérations */}
                <div className="lg:col-span-8 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActivityTab('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          activityTab === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tout ({unifiedFeed.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivityTab('CASH')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          activityTab === 'CASH' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Caisses &amp; Dépenses ({periodStats.cashList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivityTab('CLINIC')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          activityTab === 'CLINIC'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Consultations &amp; Soins ({periodStats.consultList.length + periodStats.deliveryList.length + periodStats.newPatientsList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivityTab('PHARMACY')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          activityTab === 'PHARMACY'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Pharmacie ({periodStats.salesList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivityTab('AUDIT')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          activityTab === 'AUDIT' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Journal Audit ({periodStats.auditList.length})
                      </button>
                    </div>
                  </div>

                  {/* Liste chronologique */}
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[520px] overflow-y-auto bg-slate-50/30">
                    {activityTab === 'AUDIT' ? (
                      periodStats.auditList.length === 0 ? (
                        <div className="py-12 text-center space-y-2">
                          <p className="text-xs text-slate-400">Aucune trace système enregistrée sur cette période.</p>
                          {activityMode !== 'LAST_7' && (
                            <button
                              type="button"
                              onClick={() => setActivityMode('LAST_7')}
                              className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              Voir les 7 derniers jours
                            </button>
                          )}
                        </div>
                      ) : (
                        periodStats.auditList.map((log: any) => (
                          <div key={log.id} className="p-3.5 bg-white hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 text-xs">
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[11px] font-bold text-slate-500">
                                  {activityMode === 'LAST_7' ? formatDateTime(log.createdAt) : formatTimeOnly(log.createdAt)}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  {log.action} • {log.entity}
                                </span>
                                <span className="text-[11px] font-bold text-slate-700 inline-flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-purple-500" />
                                  {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système'}
                                </span>
                              </div>
                              <p className="text-slate-700 font-medium break-words">
                                {log.details || `${log.action} sur ${log.entity}`}
                              </p>
                            </div>
                          </div>
                        ))
                      )
                    ) : filteredFeed.length === 0 ? (
                      <div className="py-12 text-center space-y-2">
                        <p className="text-xs text-slate-500 font-medium">
                          Aucune activité enregistrée pour cette journée.
                        </p>
                        {activityMode !== 'LAST_7' && (
                          <button
                            type="button"
                            onClick={() => setActivityMode('LAST_7')}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                          >
                            Afficher les 7 derniers jours
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredFeed.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 bg-white hover:bg-slate-50/90 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {activityMode === 'LAST_7' ? formatDateTime(item.timestamp) : formatTimeOnly(item.timestamp)}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${item.badgeCls}`}>
                                {item.badge}
                              </span>
                              {item.registerLabel && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${item.registerCls}`}>
                                  {item.registerLabel}
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-slate-900 truncate" title={item.title}>
                              {item.title}
                            </p>
                            <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                              <span>{item.subtitle}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700 inline-flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-blue-500" />
                                {item.actor}
                              </span>
                            </p>
                          </div>

                          {item.amount !== undefined && (
                            <div className="text-left sm:text-right shrink-0">
                              <span
                                className={`font-black font-mono text-sm ${
                                  item.amountType === 'IN'
                                    ? 'text-emerald-700'
                                    : item.amountType === 'OUT'
                                    ? 'text-rose-600'
                                    : item.amountType === 'TRANSFER'
                                    ? 'text-amber-700'
                                    : 'text-slate-800'
                                }`}
                              >
                                {item.amountType === 'IN'
                                  ? `+${formatCurrency(item.amount)}`
                                  : item.amountType === 'OUT'
                                  ? `-${formatCurrency(item.amount)}`
                                  : formatCurrency(item.amount)}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Panneau droit : Répartition des recettes du jour + Alertes Stock */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Synthèse financière & Accès direct */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-blue-600" />
                        <span>Répartition Financière</span>
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        {activityMode === 'TODAY'
                          ? "Aujourd'hui"
                          : activityMode === 'YESTERDAY'
                          ? 'Hier'
                          : activityMode === 'LAST_7'
                          ? '7 jours'
                          : activeDateKey}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center p-2.5 rounded-lg bg-white border border-slate-200/70">
                        <span className="text-slate-600 font-medium">Consultations</span>
                        <strong className="text-blue-700 font-extrabold">{formatCurrency(periodStats.consultIncome)}</strong>
                      </div>
                      <div className="flex justify-between items-center p-2.5 rounded-lg bg-white border border-slate-200/70">
                        <span className="text-slate-600 font-medium">Pharmacie</span>
                        <strong className="text-indigo-700 font-extrabold">{formatCurrency(periodStats.pharmaIncome)}</strong>
                      </div>
                      <div className="flex justify-between items-center p-2.5 rounded-lg bg-white border border-slate-200/70">
                        <span className="text-slate-600 font-medium">Soins, Dentisterie &amp; Autres</span>
                        <strong className="text-emerald-700 font-extrabold">{formatCurrency(periodStats.careIncome)}</strong>
                      </div>
                      <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-900 text-white">
                        <span className="font-semibold">Solde Net de la Période</span>
                        <strong className="font-black text-emerald-300">
                          {formatCurrency(periodStats.totalIncomes - periodStats.totalExpenses)}
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <Link
                        href="/payments?tab=daily-sheet"
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
                      >
                        <ClipboardList className="w-4 h-4 text-emerald-400" />
                        <span>Ouvrir le Bordereau Journalier</span>
                      </Link>
                      <Link
                        href="/expenses"
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Ouvrir Gestion Solde &amp; Caisses</span>
                      </Link>
                    </div>
                  </div>

                  {/* Alertes Stock & Patients */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <span>Alertes Stock ({initialStats.lowStockCount})</span>
                      </h3>
                      <Link href="/pharmacy/stock" className="text-[11px] font-bold text-blue-600 hover:underline">
                        Voir Stock →
                      </Link>
                    </div>

                    {lowStockMedicines.length === 0 ? (
                      <p className="text-xs text-emerald-600 font-semibold py-2">
                        ✓ Tous les stocks de pharmacie sont conformes.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-[190px] overflow-y-auto">
                        {lowStockMedicines.slice(0, 6).map((med: any) => (
                          <div key={med.id} className="py-2 flex items-center justify-between text-xs gap-2">
                            <span className="font-semibold text-slate-800 truncate">{med.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                med.currentStock <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {med.currentStock <= 0 ? 'Rupture' : `${med.currentStock} u.`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Péremptions &lt; 30 jours :</span>
                      <strong className="text-amber-700 font-bold">{initialStats.expiringCount} produit(s)</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. GRAPHIQUE RÉEL D'ÉVOLUTION FINANCIÈRE (14 JOURS OU 6 MOIS) */}
          {isAdmin && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-600" />
                    <span>Évolution Réelle des Recettes &amp; Dépenses</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Données réelles issues de la trésorerie clinique en Ariary (hors transferts inter-caisses)
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start">
                  <button
                    type="button"
                    onClick={() => setChartPeriod('DAILY')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      chartPeriod === 'DAILY' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    14 derniers jours
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartPeriod('MONTHLY')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      chartPeriod === 'MONTHLY' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    6 derniers mois
                  </button>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartPeriod === 'DAILY' ? dailyChartData : monthlyChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="recettesRealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1677FF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1677FF" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="depensesRealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey={chartPeriod === 'DAILY' ? 'label' : 'month'}
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      formatter={(val: any) => formatCurrency(Number(val))}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Area
                      type="monotone"
                      dataKey="Recettes"
                      name="Recettes (Ar)"
                      stroke="#1677FF"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#recettesRealGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Depenses"
                      name="Dépenses (Ar)"
                      stroke="#F43F5E"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#depensesRealGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Vue de secours pour rôles non-admin / médecin / comptable / infirmier */}
          {!isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Consultations du jour</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-blue-700">{initialStats.consultationsToday}</span>
                    <span className="text-xs text-blue-600 font-bold">Aujourd'hui</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Receipt className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rendez-vous du jour</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-indigo-700">{initialStats.appointmentsToday}</span>
                    <span className="text-xs text-indigo-600 font-bold">Planifiés</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Calendar className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nouveaux Patients</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-emerald-700">{initialStats.patientsToday}</span>
                    <span className="text-xs text-emerald-600 font-bold">Aujourd'hui</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Patients</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-slate-800">{initialStats.totalPatients}</span>
                    <span className="text-xs text-slate-400">Dossiers</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <UserCheck className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
