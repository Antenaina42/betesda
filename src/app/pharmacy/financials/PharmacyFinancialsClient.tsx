'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowDownRight,
  ArrowUpRight,
  Pill,
  CreditCard,
  ShoppingCart,
  Calendar,
  Filter,
  Download,
  Printer,
  Search,
  Package,
  Layers,
  Sparkles,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { AuthUser } from '@/types';
import { generatePharmacyFinancialReportPDF } from '@/lib/financialReportPdf';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import ThermalReceiptPreview from '@/components/pharmacy/ThermalReceiptPreview';
import { ThermalReceiptData } from '@/lib/thermalReceipt';

interface SaleItemWithMed {
  id: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  medicine?: {
    id: string;
    name: string;
    purchasePrice: number;
    sellingPrice: number;
    currentStock: number;
    category?: { name: string } | null;
  } | null;
}

interface PharmacySaleItemData {
  id: string;
  saleNumber: string;
  saleDate: string | Date;
  customerName?: string | null;
  customerPhone?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentReference?: string | null;
  patient?: { firstName: string; lastName: string; patientNumber: string } | null;
  items: SaleItemWithMed[];
}

interface MedicineData {
  id: string;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  category?: { name: string } | null;
}

interface PharmacyFinancialsClientProps {
  user: AuthUser;
  sales: PharmacySaleItemData[];
  medicines: MedicineData[];
  clinic?: any;
}

export default function PharmacyFinancialsClient({
  user,
  sales,
  medicines,
  clinic,
}: PharmacyFinancialsClientProps) {
  // Filtre temporel : 'today' | '7days' | 'month' | 'all' | 'custom'
  const [periodFilter, setPeriodFilter] = useState<'today' | '7days' | 'month' | 'all' | 'custom'>('today');
  const todayIso = new Date().toISOString().split('T')[0];
  const [customDate, setCustomDate] = useState<string>(todayIso);

  // Recherche textuelle
  const [searchQuery, setSearchQuery] = useState('');

  // Modal de réimpression de ticket thermique 80mm
  const [selectedReceipt, setSelectedReceipt] = useState<ThermalReceiptData | null>(null);

  // Onglet sous-vue : 'overview' (palmarès & grand livre) | 'medicines' (top rentabilité) | 'sales' (détail tickets)
  const [subView, setSubView] = useState<'overview' | 'medicines' | 'sales'>('overview');

  // -------------------------------------------------------------
  // 1. FILTRAGE DES VENTES SELON LA PÉRIODE CHOISIE
  // -------------------------------------------------------------
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    return sales.filter((s) => {
      const sDate = new Date(s.saleDate);

      // Filtre de date
      if (periodFilter === 'today') {
        if (sDate < todayStart) return false;
      } else if (periodFilter === '7days') {
        if (sDate < sevenDaysAgo) return false;
      } else if (periodFilter === 'month') {
        if (sDate < firstDayOfMonth) return false;
      } else if (periodFilter === 'custom') {
        const sDateIso = sDate.toISOString().split('T')[0];
        if (sDateIso !== customDate) return false;
      }

      // Filtre de recherche texte
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNumber = s.saleNumber.toLowerCase().includes(q);
        const matchCustomer = (s.customerName || '').toLowerCase().includes(q);
        const matchPatient = s.patient
          ? `${s.patient.lastName} ${s.patient.firstName} ${s.patient.patientNumber}`.toLowerCase().includes(q)
          : false;
        const matchItem = s.items.some((it) => it.medicineName.toLowerCase().includes(q));

        if (!matchNumber && !matchCustomer && !matchPatient && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [sales, periodFilter, customDate, searchQuery]);

  // -------------------------------------------------------------
  // 2. CALCULS DE RENTABILITÉ & ÉTAT FINANCIER SUR LES VENTES FILTRÉES
  // -------------------------------------------------------------
  const financialMetrics = useMemo(() => {
    let totalRevenue = 0; // Chiffre d'affaires
    let totalCostOfGoods = 0; // Coût d'achat total des médicaments vendus
    let totalItemsCount = 0; // Quantité totale de boîtes/médicaments vendus
    let cashRevenue = 0;
    let mobileMoneyRevenue = 0;

    filteredSales.forEach((s) => {
      totalRevenue += s.total;

      if (s.paymentMethod === 'CASH') {
        cashRevenue += s.total;
      } else {
        mobileMoneyRevenue += s.total;
      }

      s.items.forEach((it) => {
        totalItemsCount += it.quantity;
        const costPrice = it.medicine?.purchasePrice || (it.unitPrice * 0.7); // Fallback standard si achat non renseigné
        totalCostOfGoods += costPrice * it.quantity;
      });
    });

    const grossProfit = totalRevenue - totalCostOfGoods; // Bénéfice brut
    const marginRate = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0; // Taux de marge en %

    return {
      salesCount: filteredSales.length,
      totalItemsCount,
      totalRevenue,
      totalCostOfGoods,
      grossProfit,
      marginRate,
      cashRevenue,
      mobileMoneyRevenue,
    };
  }, [filteredSales]);

  // -------------------------------------------------------------
  // 3. VALORISATION DU STOCK PHARMACIE (ACTUELLEMENT EN RAYON)
  // -------------------------------------------------------------
  const stockValuation = useMemo(() => {
    let stockCostValue = 0; // Valeur d'achat totale
    let stockRetailValue = 0; // Valeur marchande totale (au prix de vente)
    let totalUnitsInStock = 0;

    medicines.forEach((m) => {
      const qty = Math.max(0, m.currentStock);
      totalUnitsInStock += qty;
      stockCostValue += qty * m.purchasePrice;
      stockRetailValue += qty * m.sellingPrice;
    });

    const potentialStockProfit = stockRetailValue - stockCostValue;

    return {
      totalUnitsInStock,
      stockCostValue,
      stockRetailValue,
      potentialStockProfit,
    };
  }, [medicines]);

  // -------------------------------------------------------------
  // 4. PALMARÈS DES MÉDICAMENTS LES PLUS RENTABLES (PAR MARGE BRUTE DÉGAGÉE)
  // -------------------------------------------------------------
  const medicineProfitability = useMemo(() => {
    const medMap = new Map<string, {
      id: string;
      name: string;
      category?: string;
      quantitySold: number;
      revenue: number;
      cost: number;
      profit: number;
      purchasePrice: number;
      sellingPrice: number;
    }>();

    filteredSales.forEach((s) => {
      s.items.forEach((it) => {
        const medId = it.medicineId || it.medicineName;
        const existing = medMap.get(medId);

        const pPrice = it.medicine?.purchasePrice || (it.unitPrice * 0.7);
        const sPrice = it.unitPrice;
        const itemRevenue = it.totalPrice;
        const itemCost = pPrice * it.quantity;
        const itemProfit = itemRevenue - itemCost;

        if (existing) {
          existing.quantitySold += it.quantity;
          existing.revenue += itemRevenue;
          existing.cost += itemCost;
          existing.profit += itemProfit;
        } else {
          medMap.set(medId, {
            id: medId,
            name: it.medicineName,
            category: it.medicine?.category?.name || 'Général',
            quantitySold: it.quantity,
            revenue: itemRevenue,
            cost: itemCost,
            profit: itemProfit,
            purchasePrice: pPrice,
            sellingPrice: sPrice,
          });
        }
      });
    });

    // Trier par bénéfice décroissant
    return Array.from(medMap.values()).sort((a, b) => b.profit - a.profit);
  }, [filteredSales]);

  // Réimprimer un ticket thermique 80mm
  const handleReprintTicket = (sale: PharmacySaleItemData) => {
    const receiptData: ThermalReceiptData = {
      clinic: {
        name: clinic?.name || 'CLINIQUE BETESDA',
        slogan: clinic?.slogan || 'Soins, Bienveillance & Pharmacie',
        address: clinic?.address || 'Lot IVG 35 Antananarivo, Madagascar',
        phone: clinic?.phone || '+261 20 22 123 45',
        currency: clinic?.currency || 'Ar',
      },
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      cashierName: `${user.firstName} ${user.lastName}`,
      customerName: sale.patient
        ? `${sale.patient.lastName.toUpperCase()} ${sale.patient.firstName} (${sale.patient.patientNumber})`
        : sale.customerName || 'Client de passage',
      customerPhone: sale.customerPhone || null,
      items: sale.items.map((it) => ({
        medicineName: it.medicineName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      paymentReference: sale.paymentReference || null,
    };

    setSelectedReceipt(receiptData);
  };

  // Télécharger le rapport financier A4 en PDF haute fidélité
  const handleExportPDF = () => {
    const periodStr =
      periodFilter === '7days'
        ? '7 derniers jours'
        : periodFilter === 'month'
        ? 'Ce mois-ci'
        : periodFilter === 'custom'
        ? 'Période personnalisée'
        : 'Toutes les dates';

    const formattedSales = filteredSales.map((s) => {
      let saleCost = 0;
      s.items.forEach((it) => {
        const c = it.medicine?.purchasePrice || it.unitPrice * 0.7;
        saleCost += c * it.quantity;
      });
      return {
        saleDate: s.saleDate,
        saleNumber: s.saleNumber,
        clientName: s.patient ? `${s.patient.lastName} ${s.patient.firstName}` : s.customerName || 'Client comptoir',
        total: s.total,
        cost: saleCost,
        profit: s.total - saleCost,
        paymentMethod: s.paymentMethod,
      };
    });

    const doc = generatePharmacyFinancialReportPDF({
      periodLabel: periodStr,
      totalRevenue: financialMetrics.totalRevenue,
      totalCost: financialMetrics.totalCostOfGoods,
      netProfit: financialMetrics.grossProfit,
      averageMargin: financialMetrics.marginRate,
      salesCount: financialMetrics.salesCount,
      sales: formattedSales,
    });

    doc.save(`Rapport_Financier_Pharmacie_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
            <span>/</span>
            <Link href="/pharmacy" className="hover:text-blue-600">Pharmacie</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">États Financiers &amp; Bénéfices</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight flex items-center gap-2.5">
            <span>États Financiers &amp; Bénéfices de la Pharmacie</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Rentabilité &amp; Marges
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Analyse des marges bénéficiaires, chiffre d'affaires des ventes, valorisation des stocks et palmarès de rentabilité.
          </p>
        </div>

        {/* Boutons d'actions rapides */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/pharmacy/sales"
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Caisse POS Ventes</span>
          </Link>

          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Télécharger l'état financier officiel au format A4 PDF"
          >
            <FileText className="w-4 h-4" />
            <span>Rapport A4 PDF</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 transition-colors shadow-2xs flex items-center gap-1.5"
            title="Imprimer le rapport financier au format A4"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Imprimer Rapport A4</span>
          </button>
        </div>
      </div>

      {/* EN-TÊTE D'IMPRESSION OFFICIEL A4 (VISIBLE UNIQUEMENT À L'IMPRESSION) */}
      <div className="hidden print:block bg-white p-4 border-b-2 border-slate-900 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
              {clinic?.name || 'CLINIQUE BETESDA'}
            </h1>
            <p className="text-xs text-slate-600 italic">
              {clinic?.slogan || 'Soins, Bienveillance & Pharmacie Intelligente'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Lot IVG 35 Antananarivo • Tél : +261 20 22 123 45
            </p>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-slate-100 border border-slate-300 font-extrabold text-xs uppercase tracking-wide">
              RAPPORT FINANCIER PHARMACIE
            </span>
            <p className="text-xs text-slate-500 mt-2">
              Édité le {formatDateTime(new Date())}
            </p>
            <p className="text-xs font-semibold text-slate-700">
              Direction &amp; Administration Clinique
            </p>
          </div>
        </div>
      </div>

      {/* BARRE DE FILTRES DE PÉRIODE & RECHERCHE */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        {/* Sélecteur de période */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setPeriodFilter('today')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodFilter === 'today'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter('7days')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodFilter === '7days'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 derniers jours
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter('month')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodFilter === 'month'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ce mois-ci
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodFilter === 'all'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tout l'historique
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter('custom')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodFilter === 'custom'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Date précise
          </button>
        </div>

        {/* Date personnalisée si sélectionnée */}
        {periodFilter === 'custom' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Date :</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white"
            />
          </div>
        )}

        {/* Recherche libre */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher ticket, médicament, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* 6 CARTES KPI : RENTABILITÉ, BÉNÉFICES & VALORISATION DES STOCKS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        {/* 1. Chiffre d'Affaires Ventes */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Chiffre d'Affaires</span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900">
              {formatCurrency(financialMetrics.totalRevenue)}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">
              {financialMetrics.salesCount} ventes ({financialMetrics.totalItemsCount} unités)
            </div>
          </div>
        </div>

        {/* 2. Coût d'Achat Fournisseurs */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Coût d'Achat (Achats)</span>
            <ArrowDownRight className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-amber-700">
              {formatCurrency(financialMetrics.totalCostOfGoods)}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">
              Prix d'achat fournisseurs des ventes
            </div>
          </div>
        </div>

        {/* 3. BÉNÉFICE BRUT RÉALISÉ (MARGE NETTE) ⭐ */}
        <div className="p-4 rounded-2xl bg-emerald-50/80 border-2 border-emerald-300 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-black uppercase tracking-wider">Bénéfice Réalisé</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-700 tracking-tight">
              +{formatCurrency(financialMetrics.grossProfit)}
            </div>
            <div className="text-[10.5px] font-bold text-emerald-800 mt-0.5 flex items-center gap-1">
              <span>Marge nette dégagée</span>
            </div>
          </div>
        </div>

        {/* 4. Taux de Marge Réalisé */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Taux de Marge</span>
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-indigo-700">
              {financialMetrics.marginRate.toFixed(1)}%
            </div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">
              Rendement sur chiffre d'affaires
            </div>
          </div>
        </div>

        {/* 5. Valeur Stock au Coût d'Achat */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Stock au Coût d'Achat</span>
            <Package className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-slate-800">
              {formatCurrency(stockValuation.stockCostValue)}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">
              {stockValuation.totalUnitsInStock} boîtes en réserve
            </div>
          </div>
        </div>

        {/* 6. Bénéfice Potentiel en Rayon */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Bénéfice en Rayon</span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-teal-700">
              +{formatCurrency(stockValuation.potentialStockProfit)}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">
              Marge latente en stock
            </div>
          </div>
        </div>

      </div>

      {/* BOUTONS D'ONGLETS INTÉRIEURS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
        <button
          type="button"
          onClick={() => setSubView('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subView === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Vue Complète &amp; Synthèse
        </button>
        <button
          type="button"
          onClick={() => setSubView('medicines')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subView === 'medicines'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Top Médicaments les Plus Rentables ({medicineProfitability.length})
        </button>
        <button
          type="button"
          onClick={() => setSubView('sales')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subView === 'sales'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Grand Livre des Ventes &amp; Tickets ({filteredSales.length})
        </button>
      </div>

      {/* SECTION 1 : PALMARÈS DE RENTABILITÉ PAR MÉDICAMENT */}
      {(subView === 'overview' || subView === 'medicines') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Pill className="w-5 h-5 text-emerald-600" />
                <span>Palmarès de Rentabilité des Médicaments (Générateurs de Marge)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Classement des médicaments selon le bénéfice net total généré (Prix de vente − Prix d'achat)
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {medicineProfitability.length} références vendues
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Rang</th>
                  <th className="py-3 px-4">Médicament</th>
                  <th className="py-3 px-4 text-center">Quantité Vendue</th>
                  <th className="py-3 px-4 text-right">Prix d'Achat</th>
                  <th className="py-3 px-4 text-right">Prix de Vente</th>
                  <th className="py-3 px-4 text-right">Marge Unitaire</th>
                  <th className="py-3 px-4 text-right">Chiffre d'Affaires</th>
                  <th className="py-3 px-4 text-right text-emerald-800 font-extrabold">Bénéfice Net Réalisé</th>
                  <th className="py-3 px-4 text-center">Taux Marge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicineProfitability.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Aucune vente enregistrée sur cette période.
                    </td>
                  </tr>
                ) : (
                  medicineProfitability.map((item, idx) => {
                    const unitMargin = item.sellingPrice - item.purchasePrice;
                    const marginPct = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : '0';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-black text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="text-base">💊</span>
                            <div>
                              <span>{item.name}</span>
                              <span className="text-[10px] text-slate-400 block font-normal">
                                {item.category}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-black text-slate-800">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                            {item.quantitySold}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-500">
                          {formatCurrency(item.purchasePrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(item.sellingPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-700">
                          +{formatCurrency(unitMargin)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-800">
                          {formatCurrency(item.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                          +{formatCurrency(item.profit)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {marginPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2 : GRAND LIVRE DÉTAILLÉ DES VENTES & BÉNÉFICES PAR TICKET */}
      {(subView === 'overview' || subView === 'sales') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <span>Grand Livre Détaillé des Ventes &amp; Marges par Ticket</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Chaque ticket de caisse délivré avec son chiffre d'affaires, son coût fournisseur et le bénéfice net dégagé.
              </p>
            </div>
            <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              Total Bénéfice : +{formatCurrency(financialMetrics.grossProfit)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date &amp; Heure</th>
                  <th className="py-3 px-4">N° Ticket</th>
                  <th className="py-3 px-4">Client / Patient</th>
                  <th className="py-3 px-4">Médicaments Délivrés</th>
                  <th className="py-3 px-4 text-right">Vente (CA)</th>
                  <th className="py-3 px-4 text-right">Coût Achat</th>
                  <th className="py-3 px-4 text-right font-black text-emerald-800">Bénéfice Net</th>
                  <th className="py-3 px-4 text-center">Paiement</th>
                  <th className="py-3 px-4 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Aucune vente trouvée pour cette sélection.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    let saleCost = 0;
                    sale.items.forEach((it) => {
                      const cost = it.medicine?.purchasePrice || (it.unitPrice * 0.7);
                      saleCost += cost * it.quantity;
                    });
                    const saleProfit = sale.total - saleCost;
                    const clientName = sale.patient
                      ? `${sale.patient.lastName.toUpperCase()} ${sale.patient.firstName}`
                      : sale.customerName || 'Client de passage';

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                          {formatDateTime(sale.saleDate)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-blue-700">
                          {sale.saleNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-900 block">
                            {clientName}
                          </span>
                          {sale.patient && (
                            <span className="text-[10px] text-slate-400">
                              {sale.patient.patientNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5 max-w-xs">
                            {sale.items.map((it, idx) => (
                              <div key={idx} className="text-[11px] text-slate-700 truncate">
                                • {it.medicineName} <span className="font-bold text-slate-900">(x{it.quantity})</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(sale.total)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-500">
                          {formatCurrency(saleCost)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-sm">
                          +{formatCurrency(saleProfit)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right print:hidden">
                          <button
                            type="button"
                            onClick={() => handleReprintTicket(sale)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                            title="Réimprimer le ticket de vente 80mm"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE RÉIMPRESSION THERMIQUE 80MM */}
      {selectedReceipt && (
        <ThermalReceiptPreview
          receiptData={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          isNewSale={false}
        />
      )}
    </div>
  );
}
