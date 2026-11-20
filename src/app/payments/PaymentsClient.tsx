'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Receipt,
  CreditCard,
  Pill,
  Stethoscope,
  Search,
  Calendar,
  Download,
  Printer,
  Smartphone,
  Banknote,
  Filter,
  CheckCircle2,
  TrendingUp,
  User,
  Clock,
  Layers,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Activity,
  Bed,
} from 'lucide-react';
import { AuthUser } from '@/types';
import { getRoleBadgeLabel } from '@/lib/permissions';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { generateDailyCashSheetPDF } from '@/lib/financialReportPdf';
import ConsultationDualTicketPreview from '@/components/consultations/ConsultationDualTicketPreview';
import ThermalReceiptPreview from '@/components/pharmacy/ThermalReceiptPreview';
import { ConsultationTicketData } from '@/lib/consultationReceipt';
import { ThermalReceiptData } from '@/lib/thermalReceipt';

interface CashTxItem {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  description: string;
  transactionDate: string | Date;
  performedBy?: { firstName: string; lastName: string } | null;
}

interface ConsultationFinancialItem {
  id: string;
  createdAt: string | Date;
  reason?: string | null;
  patient: {
    id: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    gender: string;
    birthDate?: string | Date | null;
  };
  doctor?: {
    user: { firstName: string; lastName: string };
    specialty: { name: string };
  } | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    status: string;
    notes?: string | null;
    payments?: Array<{
      paymentNumber: string;
      amount: number;
      paymentMethod: string;
      reference?: string | null;
      receivedBy?: { firstName: string; lastName: string } | null;
    }>;
  } | null;
  vitalSigns?: any;
}

interface PharmacySaleItem {
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
  items: Array<{
    medicineName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

export interface ConsumableDeliveryFinancialItem {
  id: string;
  deliveryNumber: string;
  sheetReference?: string | null;
  patientName?: string | null;
  patient?: { firstName: string; lastName: string; patientNumber: string } | null;
  fileNumber?: string | null;
  roomNumber?: string | null;
  reason?: string | null;
  date: string | Date;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  totalAmount: number;
  status: string;
  items: Array<{
    id?: string;
    category: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  createdAt: string | Date;
}

interface PaymentsClientProps {
  user: AuthUser;
  transactions: CashTxItem[];
  consultations: ConsultationFinancialItem[];
  pharmacySales: PharmacySaleItem[];
  consumableDeliveries?: ConsumableDeliveryFinancialItem[];
}

// Fonction helper de détection des actes infirmiers / soins
export function isNursingCare(reason?: string | null, notes?: string | null): boolean {
  const text = `${reason || ''} ${notes || ''}`.toLowerCase();
  return /soin|pansement|inject|perfus|infirm|bandage|suture/i.test(text);
}

export default function PaymentsClient({
  user,
  transactions,
  consultations,
  pharmacySales,
  consumableDeliveries = [],
}: PaymentsClientProps) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get('tab') as any) || 'daily-sheet';

  // Onglet actif : 'daily-sheet' | 'all' | 'pharmacy' | 'consultations' | 'infirmerie' | 'consumables'
  const [activeTab, setActiveTab] = useState<'daily-sheet' | 'all' | 'pharmacy' | 'consultations' | 'infirmerie' | 'consumables'>(
    ['daily-sheet', 'all', 'pharmacy', 'consultations', 'infirmerie', 'consumables'].includes(initialTab)
      ? initialTab
      : 'daily-sheet'
  );

  // Date sélectionnée pour la Fiche Journalière (par défaut aujourd'hui YYYY-MM-DD)
  const todayIso = new Date().toISOString().split('T')[0];
  const [dailySheetDate, setDailySheetDate] = useState<string>(todayIso);

  // Filtre de période pour les autres onglets : 'today' | '7days' | 'month' | 'all'
  const [periodFilter, setPeriodFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');

  // Recherche textuelle
  const [searchQuery, setSearchQuery] = useState('');

  // Modals de réimpression thermique 80mm
  const [selectedConsultationTicket, setSelectedConsultationTicket] = useState<ConsultationTicketData | null>(null);
  const [selectedPharmacyReceipt, setSelectedPharmacyReceipt] = useState<ThermalReceiptData | null>(null);

  // Navigation jour par jour pour la Fiche Journalière
  const handleShiftDay = (deltaDays: number) => {
    const current = new Date(dailySheetDate + 'T00:00:00');
    current.setDate(current.getDate() + deltaDays);
    const newDateStr = current.toISOString().split('T')[0];
    setDailySheetDate(newDateStr);
  };

  // -------------------------------------------------------------
  // CALCUL DES DONNÉES DE LA FICHE JOURNALIÈRE (BORDEREAU DE CAISSE)
  // 3 CATÉGORIES : Pharmacie, Consultation, Infirmerie
  // -------------------------------------------------------------
  const dailySheetData = useMemo(() => {
    // 1. Filtrer les consultations/soins de la date
    const dayConsults = consultations.filter((c) => {
      const d = new Date(c.createdAt).toISOString().split('T')[0];
      return d === dailySheetDate;
    });

    // 2. Filtrer les ventes pharmacie de la date
    const dayPharmacy = pharmacySales.filter((s) => {
      const d = new Date(s.saleDate).toISOString().split('T')[0];
      return d === dailySheetDate;
    });

    // 3. Fusionner dans une liste chronologique unique avec distinction des 3 catégories
    interface DailyUnifiedRow {
      id: string;
      timestamp: Date;
      timeStr: string;
      source: 'CONSULTATION' | 'PHARMACY' | 'INFIRMERIE' | 'HOSPITALISATION';
      refNumber: string;
      clientName: string;
      details: string;
      paymentMethod: string;
      cashier: string;
      amount: number;
      consultationRaw?: ConsultationFinancialItem;
      pharmacyRaw?: PharmacySaleItem;
    }

    const rows: DailyUnifiedRow[] = [];
    let totalConsult = 0;
    let countConsult = 0;
    let totalInfirmerie = 0;
    let countInfirmerie = 0;

    dayConsults.forEach((c) => {
      const dateObj = new Date(c.createdAt);
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const mins = String(dateObj.getMinutes()).padStart(2, '0');
      const patName = `${c.patient.lastName.toUpperCase()} ${c.patient.firstName}`;
      const docName = c.doctor?.user ? `Dr. ${c.doctor.user.lastName}` : 'Praticien';
      const isInfirm = isNursingCare(c.reason, c.invoice?.notes);
      const amt = c.invoice?.totalAmount || 0;

      if (isInfirm) {
        totalInfirmerie += amt;
        countInfirmerie++;
      } else {
        totalConsult += amt;
        countConsult++;
      }

      rows.push({
        id: `consult-${c.id}`,
        timestamp: dateObj,
        timeStr: `${hours}:${mins}`,
        source: isInfirm ? 'INFIRMERIE' : 'CONSULTATION',
        refNumber: c.invoice?.invoiceNumber || `REC-${c.id.slice(0, 8)}`,
        clientName: patName,
        details: isInfirm
          ? (c.reason || 'Soins & Pansements Infirmerie')
          : `${c.reason || 'Consultation Médecine Générale'} (${docName})`,
        paymentMethod: c.invoice?.payments?.[0]?.paymentMethod || 'CASH',
        cashier: isInfirm ? 'Infirmerie / Caisse' : 'Accueil / Caisse',
        amount: amt,
        consultationRaw: c,
      });
    });

    dayPharmacy.forEach((s) => {
      const dateObj = new Date(s.saleDate);
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const mins = String(dateObj.getMinutes()).padStart(2, '0');
      const clientName = s.patient
        ? `${s.patient.lastName.toUpperCase()} ${s.patient.firstName}`
        : s.customerName || 'Client comptoir';
      const medsDesc = s.items.map((it) => `${it.medicineName} (x${it.quantity})`).join(', ');

      rows.push({
        id: `pharma-${s.id}`,
        timestamp: dateObj,
        timeStr: `${hours}:${mins}`,
        source: 'PHARMACY',
        refNumber: s.saleNumber,
        clientName: clientName,
        details: medsDesc || 'Vente médicaments',
        paymentMethod: s.paymentMethod,
        cashier: 'Pharmacie / POS',
        amount: s.total,
        pharmacyRaw: s,
      });
    });

    // 3. Actes & Hébergements (Fiches Consommables / Soins du jour payées)
    const dayConsumables = (consumableDeliveries || []).filter((cd) => {
      if (cd.paymentStatus !== 'PAID') return false;
      const d = cd.date ? new Date(cd.date) : new Date(cd.createdAt);
      return d.toISOString().split('T')[0] === dailySheetDate;
    });

    let totalConsumables = 0;
    dayConsumables.forEach((cd) => {
      const dateObj = cd.date ? new Date(cd.date) : new Date(cd.createdAt);
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const mins = String(dateObj.getMinutes()).padStart(2, '0');
      const patName = cd.patient
        ? `${cd.patient.lastName.toUpperCase()} ${cd.patient.firstName}`
        : cd.patientName || 'Client externe';

      rows.push({
        id: `consumable-${cd.id}`,
        timestamp: dateObj,
        timeStr: `${hours}:${mins}`,
        source: 'HOSPITALISATION',
        refNumber: cd.sheetReference || cd.deliveryNumber,
        clientName: patName,
        details: `Actes & Hébergement (${cd.items.length} prestation(s))`,
        paymentMethod: cd.paymentMethod,
        cashier: 'Accueil / Caisse',
        amount: cd.totalAmount,
      });
      totalConsumables += cd.totalAmount;
    });

    // Tri chronologique croissant par défaut
    rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calcul des totaux de la fiche
    const totalPharma = dayPharmacy.reduce((sum, s) => sum + (s.total || 0), 0);
    const grandTotal = totalConsult + totalInfirmerie + totalPharma + totalConsumables;

    let totalCash = 0;
    let totalMobileMoney = 0;
    let totalOther = 0;

    rows.forEach((r) => {
      if (r.paymentMethod === 'CASH') totalCash += r.amount;
      else if (['MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY', 'MOBILE_MONEY'].includes(r.paymentMethod)) {
        totalMobileMoney += r.amount;
      } else {
        totalOther += r.amount;
      }
    });

    return {
      rows,
      countConsult,
      countPharma: dayPharmacy.length,
      countInfirmerie,
      countConsumables: dayConsumables.length,
      totalConsult,
      totalPharma,
      totalInfirmerie,
      totalConsumables,
      grandTotal,
      totalCash,
      totalMobileMoney,
      totalOther,
    };
  }, [consultations, pharmacySales, consumableDeliveries, dailySheetDate]);

  // Fonction utilitaire pour vérifier si une date correspond à la période sélectionnée
  const isDateInPeriod = (dateVal: string | Date): boolean => {
    if (periodFilter === 'all') return true;
    const d = new Date(dateVal);
    const now = new Date();

    if (periodFilter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d >= todayStart;
    }

    if (periodFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return d >= sevenDaysAgo;
    }

    if (periodFilter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= monthStart;
    }

    return true;
  };

  // Filtrage des consultations par période et recherche
  const filteredConsultations = useMemo(() => {
    return consultations.filter((c) => {
      if (!isDateInPeriod(c.createdAt)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const patName = `${c.patient.lastName} ${c.patient.firstName}`.toLowerCase();
      const num = (c.patient.patientNumber || '').toLowerCase();
      const invNum = (c.invoice?.invoiceNumber || '').toLowerCase();
      const reason = (c.reason || '').toLowerCase();
      return patName.includes(q) || num.includes(q) || invNum.includes(q) || reason.includes(q);
    });
  }, [consultations, periodFilter, searchQuery]);

  // Distinction stricte des 3 catégories d'entrées financières :
  // 1. Consultations Médicales (exclut les actes infirmiers)
  const filteredConsultationsMedical = useMemo(() => {
    return filteredConsultations.filter((c) => !isNursingCare(c.reason, c.invoice?.notes));
  }, [filteredConsultations]);

  // 2. Infirmerie & Soins (pansements, injections, sutures...)
  const filteredInfirmerie = useMemo(() => {
    return filteredConsultations.filter((c) => isNursingCare(c.reason, c.invoice?.notes));
  }, [filteredConsultations]);

  // 3. Ventes pharmacie par période et recherche
  const filteredPharmacySales = useMemo(() => {
    return pharmacySales.filter((s) => {
      if (!isDateInPeriod(s.saleDate)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const cust = (s.customerName || '').toLowerCase();
      const pat = s.patient ? `${s.patient.lastName} ${s.patient.firstName}`.toLowerCase() : '';
      const saleNum = (s.saleNumber || '').toLowerCase();
      const meds = s.items.map((i) => i.medicineName.toLowerCase()).join(' ');
      return cust.includes(q) || pat.includes(q) || saleNum.includes(q) || meds.includes(q);
    });
  }, [pharmacySales, periodFilter, searchQuery]);

  // Filtrage des transactions de caisse par période et recherche
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!isDateInPeriod(t.transactionDate)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const desc = (t.description || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const ref = (t.reference || '').toLowerCase();
      return desc.includes(q) || cat.includes(q) || ref.includes(q);
    });
  }, [transactions, periodFilter, searchQuery]);

  // 4. Actes & Hébergements (Fiches de consommables & séjour)
  const filteredConsumables = useMemo(() => {
    return (consumableDeliveries || []).filter((cd) => {
      if (!isDateInPeriod(cd.date || cd.createdAt)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const pat = (
        cd.patient ? `${cd.patient.lastName} ${cd.patient.firstName}` : cd.patientName || ''
      ).toLowerCase();
      const ref = (cd.sheetReference || cd.deliveryNumber || '').toLowerCase();
      const room = (cd.roomNumber || '').toLowerCase();
      const file = (cd.fileNumber || cd.patient?.patientNumber || '').toLowerCase();
      return pat.includes(q) || ref.includes(q) || room.includes(q) || file.includes(q);
    });
  }, [consumableDeliveries, periodFilter, searchQuery]);

  const consumablesStats = useMemo(() => {
    const totalPaid = filteredConsumables
      .filter((c) => c.paymentStatus === 'PAID')
      .reduce((sum, c) => sum + (c.totalAmount || 0), 0);
    const countPaid = filteredConsumables.filter((c) => c.paymentStatus === 'PAID').length;
    const pendingAmount = filteredConsumables
      .filter((c) => c.paymentStatus !== 'PAID' && c.status !== 'BLANK')
      .reduce((sum, c) => sum + (c.totalAmount || 0), 0);
    const countPending = filteredConsumables.filter(
      (c) => c.paymentStatus !== 'PAID' && c.status !== 'BLANK'
    ).length;
    const countBlank = filteredConsumables.filter((c) => c.status === 'BLANK').length;

    return { totalPaid, countPaid, pendingAmount, countPending, countBlank };
  }, [filteredConsumables]);

  // Totaux consolidés sur les 4 flux : Pharmacie, Consultation, Infirmerie, Actes & Hébergements
  const stats = useMemo(() => {
    const pharmaTotal = filteredPharmacySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const consultTotal = filteredConsultationsMedical.reduce(
      (sum, c) => sum + (c.invoice?.totalAmount || 0),
      0
    );
    const infirmerieTotal = filteredInfirmerie.reduce(
      (sum, c) => sum + (c.invoice?.totalAmount || 0),
      0
    );
    const consumablesTotal = filteredConsumables
      .filter((c) => c.paymentStatus === 'PAID')
      .reduce((sum, c) => sum + (c.totalAmount || 0), 0);

    const grandTotal = pharmaTotal + consultTotal + infirmerieTotal + consumablesTotal;

    let cashTotal = 0;
    let mobileTotal = 0;

    filteredConsultations.forEach((c) => {
      const method = c.invoice?.payments?.[0]?.paymentMethod || 'CASH';
      const amt = c.invoice?.totalAmount || 0;
      if (method === 'CASH') cashTotal += amt;
      else mobileTotal += amt;
    });

    filteredPharmacySales.forEach((s) => {
      const amt = s.total || 0;
      if (s.paymentMethod === 'CASH') cashTotal += amt;
      else mobileTotal += amt;
    });

    filteredConsumables.forEach((c) => {
      if (c.paymentStatus === 'PAID') {
        const amt = c.totalAmount || 0;
        if (c.paymentMethod === 'CASH') cashTotal += amt;
        else mobileTotal += amt;
      }
    });

    return {
      pharmaTotal,
      pharmaCount: filteredPharmacySales.length,
      consultTotal,
      consultCount: filteredConsultationsMedical.length,
      infirmerieTotal,
      infirmerieCount: filteredInfirmerie.length,
      consumablesTotal,
      consumablesCount: consumablesStats.countPaid,
      grandTotal,
      cashTotal,
      mobileTotal,
    };
  }, [filteredConsultations, filteredConsultationsMedical, filteredInfirmerie, filteredPharmacySales, filteredConsumables, consumablesStats]);

  // Préparation du ticket consultation pour réimpression 80mm
  const handleOpenConsultationTicket = (c: ConsultationFinancialItem) => {
    let patientAge: number | string = '-';
    if (c.patient.birthDate) {
      const diff = Date.now() - new Date(c.patient.birthDate).getTime();
      patientAge = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
    }

    const ticket: ConsultationTicketData = {
      clinic: {
        name: 'Clinique Betesda',
        slogan: 'Soins, Bienveillance & Gestion Intelligente',
        address: 'Lot IVG 35 Antananarivo, Madagascar',
        phone: '+261 20 22 123 45',
        currency: 'Ar',
      },
      receiptNumber: c.invoice?.invoiceNumber || `REC-${c.id.slice(0, 8)}`,
      orderNumber: '001',
      consultationId: c.id,
      date: new Date(c.createdAt),
      cashierName: c.invoice?.payments?.[0]?.receivedBy
        ? `${c.invoice.payments[0].receivedBy.firstName} ${c.invoice.payments[0].receivedBy.lastName}`
        : 'Accueil / Caissier',
      patient: {
        id: c.patient.id,
        patientNumber: c.patient.patientNumber,
        firstName: c.patient.firstName,
        lastName: c.patient.lastName,
        phone: c.patient.phone || undefined,
        age: patientAge,
        gender: c.patient.gender,
      },
      doctorName: c.doctor?.user ? `Dr. ${c.doctor.user.firstName} ${c.doctor.user.lastName}` : 'Médecin de garde',
      specialty: c.doctor?.specialty?.name || 'Médecine Générale',
      actName: c.reason || 'Consultation Médecine Générale',
      amount: c.invoice?.totalAmount || 15000,
      paymentMethod: c.invoice?.payments?.[0]?.paymentMethod || 'CASH',
      paymentReference: c.invoice?.payments?.[0]?.reference || null,
      reason: c.reason,
      vitals: c.vitalSigns
        ? {
            systolicBP: c.vitalSigns.systolicBP,
            diastolicBP: c.vitalSigns.diastolicBP,
            temperature: c.vitalSigns.temperature,
            weight: c.vitalSigns.weight,
            height: c.vitalSigns.height,
            heartRate: c.vitalSigns.heartRate,
            oxygenSaturation: c.vitalSigns.oxygenSaturation,
          }
        : undefined,
    };

    setSelectedConsultationTicket(ticket);
  };

  // Préparation du ticket pharmacie pour réimpression 80mm
  const handleOpenPharmacyReceipt = (sale: PharmacySaleItem) => {
    const receipt: ThermalReceiptData = {
      clinic: {
        name: 'Clinique Betesda - Pharmacie',
        slogan: 'La pharmacie au service de votre santé',
        address: 'Lot IVG 35 Antananarivo, Madagascar',
        phone: '+261 20 22 123 45',
        currency: 'Ar',
      },
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      cashierName: 'Pharmacie Betesda',
      customerName: sale.patient
        ? `${sale.patient.lastName} ${sale.patient.firstName}`
        : sale.customerName || 'Client de passage',
      customerPhone: sale.customerPhone || null,
      paymentMethod: sale.paymentMethod,
      paymentReference: sale.paymentReference || null,
      items: sale.items.map((it) => ({
        medicineName: it.medicineName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
    };

    setSelectedPharmacyReceipt(receipt);
  };

  // Génération et téléchargement officiel du Bordereau de Caisse en A4 PDF (Selon l'onglet et les filtres actifs)
  const handleExportDailyPDF = () => {
    // Si on est sur l'onglet de la feuille journalière
    if (activeTab === 'daily-sheet') {
      const doc = generateDailyCashSheetPDF({
        date: dailySheetDate,
        title: 'BORDEREAU JOURNALIER DES ENTRÉES DE CAISSE (A4)',
        periodLabel: `Journée du : ${formatDate(dailySheetDate + 'T00:00:00')}`,
        generatedBy: `${user.firstName} ${user.lastName} (${getRoleBadgeLabel(user.role).label})`,
        totalConsult: dailySheetData.totalConsult,
        countConsult: dailySheetData.countConsult,
        totalPharma: dailySheetData.totalPharma,
        countPharma: dailySheetData.countPharma,
        totalInfirmerie: dailySheetData.totalInfirmerie,
        countInfirmerie: dailySheetData.countInfirmerie,
        grandTotal: dailySheetData.grandTotal,
        totalCash: dailySheetData.totalCash,
        totalMobileMoney: dailySheetData.totalMobileMoney,
        rows: dailySheetData.rows,
      });
      doc.save(`Bordereau_Journalier_Caisse_${dailySheetDate}.pdf`);
      return;
    }

    // Sinon, on génère selon l'onglet actif et les filtres de période et recherche
    let periodText = 'Toutes les dates';
    if (periodFilter === 'today') periodText = "Aujourd'hui";
    else if (periodFilter === '7days') periodText = '7 derniers jours';
    else if (periodFilter === 'month') periodText = 'Ce mois-ci';

    if (searchQuery.trim()) {
      periodText += ` • Recherche: "${searchQuery.trim()}"`;
    }

    let rows: Array<{
      timeStr: string;
      source: string;
      refNumber: string;
      clientName: string;
      details: string;
      paymentMethod: string;
      cashier: string;
      amount: number;
    }> = [];

    let totalConsult = 0;
    let countConsult = 0;
    let totalPharma = 0;
    let countPharma = 0;
    let totalInfirmerie = 0;
    let countInfirmerie = 0;
    let totalConsumables = 0;
    let countConsumables = 0;
    let docTitle = 'BORDEREAU DES ENTRÉES DE CAISSE (A4)';
    let fileSuffix = `${activeTab}_${periodFilter}`;

    if (activeTab === 'consultations' || activeTab === 'all') {
      filteredConsultationsMedical.forEach((c) => {
        const amt = c.invoice?.totalAmount || 0;
        totalConsult += amt;
        countConsult++;
        rows.push({
          timeStr: formatDateTime(c.createdAt).split(' ')[1] || '-',
          source: 'CONSULTATION',
          refNumber: c.invoice?.invoiceNumber || '-',
          clientName: `${c.patient.lastName.toUpperCase()} ${c.patient.firstName}`,
          details: c.reason || 'Consultation médicale',
          paymentMethod: c.invoice?.payments?.[0]?.paymentMethod || 'CASH',
          cashier: c.invoice?.payments?.[0]?.receivedBy
            ? `${c.invoice.payments[0].receivedBy.firstName} ${c.invoice.payments[0].receivedBy.lastName}`
            : (c.doctor?.user ? `Dr ${c.doctor.user.lastName}` : 'Caisse'),
          amount: amt,
        });
      });
      if (activeTab === 'consultations') {
        docTitle = 'BORDEREAU DE CAISSE • CONSULTATIONS MÉDICALES';
      }
    }

    if (activeTab === 'infirmerie' || activeTab === 'all') {
      filteredInfirmerie.forEach((c) => {
        const amt = c.invoice?.totalAmount || 0;
        totalInfirmerie += amt;
        countInfirmerie++;
        rows.push({
          timeStr: formatDateTime(c.createdAt).split(' ')[1] || '-',
          source: 'INFIRMERIE',
          refNumber: c.invoice?.invoiceNumber || '-',
          clientName: `${c.patient.lastName.toUpperCase()} ${c.patient.firstName}`,
          details: c.reason || 'Soin / Acte infirmier',
          paymentMethod: c.invoice?.payments?.[0]?.paymentMethod || 'CASH',
          cashier: c.invoice?.payments?.[0]?.receivedBy
            ? `${c.invoice.payments[0].receivedBy.firstName} ${c.invoice.payments[0].receivedBy.lastName}`
            : 'Infirmerie',
          amount: amt,
        });
      });
      if (activeTab === 'infirmerie') {
        docTitle = 'BORDEREAU DE CAISSE • INFIRMERIE & SOINS';
      }
    }

    if (activeTab === 'pharmacy' || activeTab === 'all') {
      filteredPharmacySales.forEach((s) => {
        totalPharma += s.total;
        countPharma++;
        rows.push({
          timeStr: formatDateTime(s.saleDate).split(' ')[1] || '-',
          source: 'PHARMACY',
          refNumber: s.saleNumber,
          clientName: s.patient ? `${s.patient.lastName.toUpperCase()} ${s.patient.firstName}` : (s.customerName || 'Client comptoir'),
          details: s.items.map((i) => `${i.quantity}x ${i.medicineName}`).join(', '),
          paymentMethod: s.paymentMethod,
          cashier: 'Pharmacie',
          amount: s.total,
        });
      });
      if (activeTab === 'pharmacy') {
        docTitle = 'BORDEREAU DE CAISSE • VENTES PHARMACIE';
      }
    }

    if (activeTab === 'consumables' || activeTab === 'all') {
      filteredConsumables
        .filter((cd) => cd.paymentStatus === 'PAID')
        .forEach((cd) => {
          const amt = cd.totalAmount || 0;
          totalConsumables += amt;
          countConsumables++;
          rows.push({
            timeStr: formatDateTime(cd.date || cd.createdAt).split(' ')[1] || '-',
            source: 'HOSPITALISATION',
            refNumber: cd.sheetReference || cd.deliveryNumber || '-',
            clientName: cd.patient
              ? `${cd.patient.lastName.toUpperCase()} ${cd.patient.firstName}`
              : (cd.patientName || 'Patient'),
            details: `Actes & consommables (${cd.items?.length || 0} lignes)`,
            paymentMethod: cd.paymentMethod || 'CASH',
            cashier: 'Accueil / Caisse',
            amount: amt,
          });
        });
      if (activeTab === 'consumables') {
        docTitle = 'BORDEREAU DE CAISSE • ACTES & HÉBERGEMENTS';
      }
    }

    const grandTotal = totalConsult + totalPharma + totalInfirmerie + totalConsumables;
    const totalCash = rows
      .filter((r) => r.paymentMethod === 'CASH' || r.paymentMethod === 'Espèces')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalMobileMoney = grandTotal - totalCash;

    const doc = generateDailyCashSheetPDF({
      date: new Date().toISOString().split('T')[0],
      title: docTitle,
      periodLabel: `Période filtrée : ${periodText}`,
      generatedBy: `${user.firstName} ${user.lastName} (${getRoleBadgeLabel(user.role).label})`,
      totalConsult,
      countConsult,
      totalPharma,
      countPharma,
      totalInfirmerie,
      countInfirmerie,
      totalConsumables,
      countConsumables,
      grandTotal,
      totalCash,
      totalMobileMoney,
      rows,
    });

    doc.save(`Bordereau_Caisse_${fileSuffix}.pdf`);
  };

  // Export CSV général
  const handleExportCSV = () => {
    if (activeTab === 'daily-sheet') {
      handleExportDailyPDF();
      return;
    }

    let rows: string[][] = [];
    if (activeTab === 'consultations') {
      rows = [
        ['Date', 'N° Facture', 'Patient', 'N° Dossier', 'Médecin', 'Acte', 'Montant', 'Mode'],
        ...filteredConsultationsMedical.map((c) => [
          formatDateTime(c.createdAt),
          c.invoice?.invoiceNumber || '',
          `${c.patient.lastName} ${c.patient.firstName}`,
          c.patient.patientNumber,
          c.doctor?.user ? `Dr ${c.doctor.user.lastName}` : '',
          c.reason || 'Consultation',
          (c.invoice?.totalAmount || 0).toString(),
          c.invoice?.payments?.[0]?.paymentMethod || 'CASH',
        ]),
      ];
    } else if (activeTab === 'infirmerie') {
      rows = [
        ['Date', 'N° Facture', 'Patient', 'N° Dossier', 'Soin / Acte Infirmerie', 'Montant', 'Mode'],
        ...filteredInfirmerie.map((c) => [
          formatDateTime(c.createdAt),
          c.invoice?.invoiceNumber || '',
          `${c.patient.lastName} ${c.patient.firstName}`,
          c.patient.patientNumber,
          c.reason || 'Soin & Pansement',
          (c.invoice?.totalAmount || 0).toString(),
          c.invoice?.payments?.[0]?.paymentMethod || 'CASH',
        ]),
      ];
    } else if (activeTab === 'pharmacy') {
      rows = [
        ['Date', 'N° Vente', 'Client/Patient', 'Articles', 'Total', 'Mode'],
        ...filteredPharmacySales.map((s) => [
          formatDateTime(s.saleDate),
          s.saleNumber,
          s.customerName || '',
          s.items.map((i) => `${i.medicineName} (x${i.quantity})`).join('; '),
          s.total.toString(),
          s.paymentMethod,
        ]),
      ];
    } else if (activeTab === 'consumables') {
      rows = [
        ['Date', 'Réf. Fiche', 'Patient', 'N° Dossier', 'Chambre', 'Statut', 'Montant', 'Mode'],
        ...filteredConsumables.map((d) => [
          formatDateTime(d.date || d.createdAt),
          d.sheetReference || d.deliveryNumber,
          d.patientName || (d.patient ? `${d.patient.lastName} ${d.patient.firstName}` : 'Client'),
          d.fileNumber || d.patient?.patientNumber || '',
          d.roomNumber || '',
          d.paymentStatus,
          d.totalAmount.toString(),
          d.paymentMethod || 'CASH',
        ]),
      ];
    } else {
      rows = [
        ['Date', 'Type', 'Catégorie', 'Description', 'Mode', 'Montant'],
        ...filteredTransactions.map((t) => [
          formatDateTime(t.transactionDate),
          t.type,
          t.category,
          t.description,
          t.paymentMethod,
          t.amount.toString(),
        ]),
      ];
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((e) => e.map((val) => `"${(val || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mouvements_financiers_betesda_${activeTab}_${periodFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Styles spécifiques d'impression A4 pour la Fiche Journalière */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print,
          aside,
          header,
          nav,
          [role="navigation"],
          .sidebar,
          .topbar,
          button,
          input,
          select {
            display: none !important;
          }
          #printable-daily-sheet,
          #printable-daily-sheet * {
            visibility: visible;
          }
          #printable-daily-sheet {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 198mm !important;
            margin: 0 auto !important;
            padding: 8mm 10mm !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: none !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Top Banner & Header */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">Supervision Financière</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight flex items-center gap-2.5 flex-wrap">
            <span>Flux de Caisse &amp; Recettes</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              💊 Pharmacie
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              🩺 Consultation
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
              🩹 Infirmerie
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Supervision stricte des 3 catégories d'entrées d'argent et suivi des décaissements.
          </p>
        </div>

        {/* Boutons d'action : Encaissement, Impression & Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {activeTab === 'daily-sheet' && (
            <button
              type="button"
              onClick={() => {
                const originalTitle = document.title;
                document.title = `Bordereau_Journalier_Caisse_${dailySheetDate}_Clinique_Betesda`;
                window.print();
                setTimeout(() => {
                  document.title = originalTitle;
                }, 1200);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Imprimer / Télécharger PDF A4</span>
            </button>
          )}

          <Link
            href="/expenses"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors shadow-2xs"
            title="Sorties de caisse, salaires de tous les employés et prélèvements de pharmacie"
          >
            <CreditCard className="w-4 h-4 text-rose-600" />
            <span>Sorties de Caisse &amp; Dépenses</span>
          </Link>

          <Link
            href="/consultations/caisse"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all"
          >
            <Receipt className="w-4 h-4" />
            <span>Encaisser Consultation / Soin</span>
          </Link>

          <Link
            href="/pharmacy/sales"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
          >
            <Pill className="w-4 h-4" />
            <span>Caisse Pharmacie</span>
          </Link>

          <button
            type="button"
            onClick={handleExportDailyPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
            title="Télécharger le bordereau officiel de caisse au format A4 PDF"
          >
            <FileText className="w-4 h-4" />
            <span>Bordereau A4 PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards : Les 3 Catégories d'Entrées d'Argent + Total Général */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Général */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Recettes Globales ({periodFilter === 'today' ? "Aujourd'hui" : periodFilter})
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
              {formatCurrency(stats.grandTotal)}
            </div>
            <span className="text-[11px] text-slate-300 font-medium">
              Pharmacie + Consult. + Infirm.
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* 1. Recettes Pharmacie */}
        <div className="p-4 bg-white rounded-2xl border border-indigo-200/80 bg-indigo-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
              <span>1. Pharmacie (POS)</span>
            </span>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">
              {formatCurrency(stats.pharmaTotal)}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-indigo-600 font-medium">
                {stats.pharmaCount} vente(s)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                {stats.grandTotal > 0 ? Math.round((stats.pharmaTotal / stats.grandTotal) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Pill className="w-5 h-5" />
          </div>
        </div>

        {/* 2. Recettes Consultations Médicales */}
        <div className="p-4 bg-white rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
              <span>2. Consultations</span>
            </span>
            <div className="text-xl sm:text-2xl font-black text-blue-700 mt-1">
              {formatCurrency(stats.consultTotal)}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-blue-600 font-medium">
                {stats.consultCount} consultation(s)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                {stats.grandTotal > 0 ? Math.round((stats.consultTotal / stats.grandTotal) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Recettes Infirmerie & Soins */}
        <div className="p-4 bg-white rounded-2xl border border-teal-200/80 bg-teal-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1">
              <span>3. Infirmerie &amp; Soins</span>
            </span>
            <div className="text-xl sm:text-2xl font-black text-teal-700 mt-1">
              {formatCurrency(stats.infirmerieTotal)}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-teal-700 font-medium">
                {stats.infirmerieCount} acte(s) &amp; soin(s)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800">
                {stats.grandTotal > 0 ? Math.round((stats.infirmerieTotal / stats.grandTotal) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Mini-barre de synthèse : Espèces vs Mobile Money & Lien Dépenses */}
      <div className="no-print bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
            Mode d'Encaissement :
          </span>
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>💵 Espèces en caisse :</span>
            <span className="text-emerald-700 font-black">{formatCurrency(stats.cashTotal)}</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>📱 Mobile Money (Mvola, Orange, Airtel) :</span>
            <span className="text-amber-700 font-black">{formatCurrency(stats.mobileTotal)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/expenses"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <span>Sorties de Caisse, Salaires &amp; Dépenses</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>

      {/* Barre d'outils : Onglets de Navigation & Filtres */}
      <div className="no-print bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Onglets de vue */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          {/* ONGLET VEDETTE : FICHE JOURNALIÈRE */}
          <button
            type="button"
            onClick={() => setActiveTab('daily-sheet')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'daily-sheet'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fiche Journalière des Entrées</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tous les Flux ({filteredTransactions.length})</span>
          </button>

          {/* CATÉGORIE 1 : PHARMACIE */}
          <button
            type="button"
            onClick={() => setActiveTab('pharmacy')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'pharmacy'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>1. Pharmacie ({filteredPharmacySales.length})</span>
          </button>

          {/* CATÉGORIE 2 : CONSULTATIONS */}
          <button
            type="button"
            onClick={() => setActiveTab('consultations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'consultations'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>2. Consultations ({filteredConsultationsMedical.length})</span>
          </button>

          {/* CATÉGORIE 3 : INFIRMERIE */}
          <button
            type="button"
            onClick={() => setActiveTab('infirmerie')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'infirmerie'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>3. Infirmerie &amp; Soins ({filteredInfirmerie.length})</span>
          </button>

          {/* CATÉGORIE 4 : ACTES & HÉBERGEMENTS */}
          <button
            type="button"
            onClick={() => setActiveTab('consumables')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'consumables'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>4. Actes &amp; Hébergements ({filteredConsumables.length})</span>
          </button>

          <Link
            href="/pharmacy/financials"
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 text-indigo-800 bg-indigo-100/80 hover:bg-indigo-200 border border-indigo-300 shadow-2xs"
            title="Consulter les bénéfices nets et la rentabilité détaillée de la pharmacie"
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            <span>Marges Pharmacie ↗</span>
          </Link>
        </div>

        {/* Contrôles de filtrage */}
        {activeTab === 'daily-sheet' ? (
          /* Sélecteur de date pour la Fiche Journalière */
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => handleShiftDay(-1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
              title="Jour précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative">
              <input
                type="date"
                value={dailySheetDate}
                onChange={(e) => setDailySheetDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold text-slate-800 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() => handleShiftDay(1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
              title="Jour suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {dailySheetDate !== todayIso && (
              <button
                type="button"
                onClick={() => setDailySheetDate(todayIso)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Aujourd'hui
              </button>
            )}
          </div>
        ) : (
          /* Filtres de Période & Recherche pour les autres onglets */
          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
            <div className="flex items-center gap-1 text-xs font-bold bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'today', label: "Aujourd'hui" },
                { id: '7days', label: '7 jours' },
                { id: 'month', label: 'Ce mois' },
                { id: 'all', label: 'Tout' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodFilter(p.id as any)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    periodFilter === p.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[180px] flex-1 md:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* CONTENU DE L'ONGLET SÉLECTIONNÉ */}

      {/* ============================================================== */}
      {/* 1. ONGLET VEDETTE : FICHE JOURNALIÈRE DES ENTRÉES (BORDEREAU) */}
      {/* ============================================================== */}
      {activeTab === 'daily-sheet' && (
        <div id="printable-daily-sheet" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          {/* En-tête officiel du bordereau journalier */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white print:bg-white print:text-slate-900 print:border print:border-slate-800 flex items-center justify-center font-black text-xl shrink-0">
                  CB
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                    CLINIQUE BETESDA
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Lot IVG 35 Rue Pasteur, Antananarivo • Tél : +261 20 22 123 45
                  </p>
                  <p className="text-[10px] text-slate-400">
                    NIF: 3000123456 / STAT: 85111 11 2015 0 00123
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-slate-900 text-white print:bg-white print:text-slate-900 print:border print:border-slate-800 uppercase tracking-wider mb-1">
                  BORDEREAU JOURNALIER DE CAISSE
                </span>
                <div className="text-base font-extrabold text-blue-700">
                  Date : {formatDate(dailySheetDate + 'T00:00:00')}
                </div>
                <div className="text-[11px] text-slate-400">
                  Généré le {formatDateTime(new Date())} par {user.firstName} {user.lastName}
                </div>
              </div>
            </div>
          </div>

          {/* Grille de synthèse financière de la journée : Les 3 Catégories d'Entrées */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 print:bg-white p-4 rounded-xl border border-slate-200">
            <div className="p-3 bg-white rounded-lg border border-indigo-200 shadow-xs">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">1. Pharmacie (POS)</span>
              <div className="text-lg font-black text-indigo-700 mt-0.5">
                {formatCurrency(dailySheetData.totalPharma)}
              </div>
              <span className="text-[10px] text-slate-400">{dailySheetData.countPharma} vente(s)</span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-blue-200 shadow-xs">
              <span className="text-[10px] font-bold text-blue-600 uppercase">2. Consultations</span>
              <div className="text-lg font-black text-blue-700 mt-0.5">
                {formatCurrency(dailySheetData.totalConsult)}
              </div>
              <span className="text-[10px] text-slate-400">{dailySheetData.countConsult} ticket(s)</span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-teal-200 shadow-xs">
              <span className="text-[10px] font-bold text-teal-600 uppercase">3. Infirmerie &amp; Soins</span>
              <div className="text-lg font-black text-teal-700 mt-0.5">
                {formatCurrency(dailySheetData.totalInfirmerie)}
              </div>
              <span className="text-[10px] text-slate-400">{dailySheetData.countInfirmerie} acte(s)</span>
            </div>

            <div className="p-3 bg-slate-900 text-white print:bg-white print:text-slate-900 print:border-2 print:border-slate-800 rounded-lg shadow-xs">
              <span className="text-[10px] font-bold text-emerald-400 print:text-slate-700 uppercase tracking-wider">TOTAL ENTRÉES DU JOUR</span>
              <div className="text-xl font-black text-white print:text-emerald-800 mt-0.5">
                {formatCurrency(dailySheetData.grandTotal)}
              </div>
              <span className="text-[10px] text-slate-300 print:text-slate-600">
                Cash: {formatCurrency(dailySheetData.totalCash)} | Mob: {formatCurrency(dailySheetData.totalMobileMoney)}
              </span>
            </div>
          </div>

          {/* Tableau détaillé de toutes les entrées de la journée */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-300 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">N°</th>
                  <th className="py-2.5 px-3 w-16">Heure</th>
                  <th className="py-2.5 px-3 w-28">Pôle / Catégorie</th>
                  <th className="py-2.5 px-3 w-36">N° Pièce / Ticket</th>
                  <th className="py-2.5 px-3">Bénéficiaire / Patient</th>
                  <th className="py-2.5 px-3">Détail de l'acte / Produits</th>
                  <th className="py-2.5 px-3 w-28">Mode Règlement</th>
                  <th className="py-2.5 px-3 text-right w-32">Montant Encaissé</th>
                  <th className="py-2.5 px-3 text-center w-24 no-print">Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dailySheetData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                      Aucun encaissement enregistré à la date du {formatDate(dailySheetDate + 'T00:00:00')}.
                    </td>
                  </tr>
                ) : (
                  dailySheetData.rows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-600">
                        {row.timeStr}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.source === 'PHARMACY'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : row.source === 'INFIRMERIE'
                              ? 'bg-teal-100 text-teal-800 border border-teal-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {row.source === 'PHARMACY'
                            ? '💊 1. Pharmacie'
                            : row.source === 'INFIRMERIE'
                            ? '🩹 3. Infirmerie'
                            : '🩺 2. Consultation'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">
                        {row.refNumber}
                      </td>
                      <td className="py-2 px-3 font-extrabold text-slate-900">
                        {row.clientName}
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-xs" title={row.details}>
                        {row.details}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-700 text-[11px]">
                          {row.paymentMethod === 'CASH' ? '💵 Espèces' : '📱 ' + row.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-black text-slate-900 text-sm">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="py-2 px-3 text-center no-print">
                        {(row.source === 'CONSULTATION' || row.source === 'INFIRMERIE') && row.consultationRaw && (
                          <button
                            type="button"
                            onClick={() => handleOpenConsultationTicket(row.consultationRaw!)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                              row.source === 'INFIRMERIE'
                                ? 'text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200'
                                : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200'
                            }`}
                            title="Réimprimer le ticket"
                          >
                            <Printer className="w-3 h-3" />
                            <span>80mm</span>
                          </button>
                        )}
                        {row.source === 'PHARMACY' && row.pharmacyRaw && (
                          <button
                            type="button"
                            onClick={() => handleOpenPharmacyReceipt(row.pharmacyRaw!)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                            title="Réimprimer le ticket pharmacie"
                          >
                            <Printer className="w-3 h-3" />
                            <span>POS</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {dailySheetData.rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black text-sm">
                    <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider">
                      TOTAL ENCAISSÉ DE LA JOURNÉE :
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 text-base">
                      {formatCurrency(dailySheetData.grandTotal)}
                    </td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Section officielle de clôture de caisse & visas */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 min-h-[110px] flex flex-col justify-between">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Visa &amp; Signature du Caissier de service :
              </span>
              <div className="text-[11px] text-slate-400 italic">
                Signature : .....................................................
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 min-h-[110px] flex flex-col justify-between">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Visa &amp; Approbation de l'Administrateur / Direction :
              </span>
              <div className="text-[11px] text-slate-400 italic">
                Signature &amp; Cachet : .....................................................
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. ONGLET : TOUS LES FLUX CONSOLIDÉS (HISTORIQUE DE CAISSE)   */}
      {/* ============================================================== */}
      {activeTab === 'all' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Journal Général des Mouvements de Caisse ({filteredTransactions.length})</span>
            </h3>
            <span className="text-xs text-slate-400">Flux horodatés en continu</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date &amp; Heure</th>
                  <th className="py-3 px-4">Pôle / Catégorie</th>
                  <th className="py-3 px-4">Description de l'acte</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Opérateur</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Aucun mouvement de caisse enregistré pour cette période.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isPharma = tx.category.toLowerCase().includes('pharm');
                    const isInfirm = tx.category.toLowerCase().includes('infirm');
                    const isConsult = tx.category.toLowerCase().includes('consult');
                    const isSalary = tx.category.toLowerCase().includes('salaire') || tx.category.toLowerCase().includes('paie');
                    const isClinicMed = tx.category.toLowerCase().includes('clinique');
                    const isVersementIn = tx.category.toLowerCase().includes('versement') && (tx.type === 'INCOME' || tx.category.toLowerCase().includes('reçu'));
                    const isVersementOut = tx.category.toLowerCase().includes('versement') && tx.type === 'EXPENSE';
                    const isExpense = tx.type === 'EXPENSE';

                    let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
                    let badgeLabel = tx.category;

                    if (isVersementIn) {
                      badgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black';
                      badgeLabel = '📥 Versement Reçu (Grande Caisse)';
                    } else if (isVersementOut) {
                      badgeColor = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
                      badgeLabel = '📤 Versement Sortant (Vers Admin)';
                    } else if (isPharma && !isExpense) {
                      badgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                      badgeLabel = '💊 1. Pharmacie';
                    } else if (isConsult) {
                      badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                      badgeLabel = '🩺 2. Consultation';
                    } else if (isInfirm) {
                      badgeColor = 'bg-teal-100 text-teal-800 border-teal-200';
                      badgeLabel = '🩹 3. Infirmerie';
                    } else if (isSalary) {
                      badgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
                      badgeLabel = '👥 Salaires & Paie';
                    } else if (isClinicMed) {
                      badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                      badgeLabel = '🏥 Dépense Clinique (Pharm.)';
                    } else if (isExpense) {
                      badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                      badgeLabel = '💸 Décaissement';
                    }

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {formatDateTime(tx.transactionDate)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}
                          >
                            {badgeLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-900 font-semibold">
                          {tx.description}
                          {tx.reference && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              Réf : {tx.reference}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-600">
                            {tx.paymentMethod === 'CASH' ? '💵 Espèces' : '📱 Mobile'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {tx.performedBy
                            ? `${tx.performedBy.firstName} ${tx.performedBy.lastName}`
                            : 'Caisse'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-black text-sm ${
                              tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {tx.type === 'INCOME' ? '+' : '-'} {formatCurrency(tx.amount)}
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

      {/* ============================================================== */}
      {/* 3. ONGLET : RECETTES CONSULTATIONS                            */}
      {/* ============================================================== */}
      {activeTab === 'consultations' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-blue-600" />
                <span>Encaissements 2. Consultations Médicales ({filteredConsultationsMedical.length})</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Consultations Généralistes &amp; Spécialistes • Tickets 2 volets imprimables
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-bold uppercase">Total Encaissé :</span>
              <div className="text-lg font-black text-blue-700">
                {formatCurrency(stats.consultTotal)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date &amp; Heure</th>
                  <th className="py-3 px-4">N° Facture/Reçu</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Acte / Praticien</th>
                  <th className="py-3 px-4">Règlement</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredConsultationsMedical.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Aucune consultation médicale payée pour cette période.
                    </td>
                  </tr>
                ) : (
                  filteredConsultationsMedical.map((c) => {
                    const patName = `${c.patient.lastName.toUpperCase()} ${c.patient.firstName}`;
                    const docName = c.doctor?.user ? `Dr. ${c.doctor.user.lastName}` : 'Médecin';
                    const payAmt = c.invoice?.totalAmount || 15000;
                    const method = c.invoice?.payments?.[0]?.paymentMethod || 'CASH';

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {formatDateTime(c.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {c.invoice?.invoiceNumber || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-slate-900 block">{patName}</span>
                          <span className="text-[10px] text-slate-400">{c.patient.patientNumber}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 block">
                            {c.reason || 'Consultation Médecine Générale'}
                          </span>
                          <span className="text-[10px] text-blue-600 font-medium">{docName}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {method === 'CASH' ? '💵 Espèces' : '📱 Mobile Money'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-black text-sm text-blue-700">
                            {formatCurrency(payAmt)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenConsultationTicket(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                            title="Voir et imprimer le ticket 2 volets"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Ticket 80mm</span>
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

      {/* ============================================================== */}
      {/* 4. ONGLET : RECETTES INFIRMERIE & SOINS                       */}
      {/* ============================================================== */}
      {activeTab === 'infirmerie' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" />
                <span>Encaissements 3. Infirmerie &amp; Soins Ambulatoires ({filteredInfirmerie.length})</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Pansements, injections, perfusions, sutures et soins infirmiers
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-bold uppercase">Total Encaissé :</span>
              <div className="text-lg font-black text-teal-700">
                {formatCurrency(stats.infirmerieTotal)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date &amp; Heure</th>
                  <th className="py-3 px-4">N° Facture/Reçu</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Soin Infirmier / Acte</th>
                  <th className="py-3 px-4">Règlement</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInfirmerie.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Aucun soin ou acte infirmier payé pour cette période.
                    </td>
                  </tr>
                ) : (
                  filteredInfirmerie.map((c) => {
                    const patName = `${c.patient.lastName.toUpperCase()} ${c.patient.firstName}`;
                    const payAmt = c.invoice?.totalAmount || 10000;
                    const method = c.invoice?.payments?.[0]?.paymentMethod || 'CASH';

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {formatDateTime(c.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {c.invoice?.invoiceNumber || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-slate-900 block">{patName}</span>
                          <span className="text-[10px] text-slate-400">{c.patient.patientNumber}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-teal-900 block">
                            {c.reason || 'Soin & Pansement Infirmier'}
                          </span>
                          <span className="text-[10px] text-slate-400">Pôle Soins Ambulatoires</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {method === 'CASH' ? '💵 Espèces' : '📱 Mobile Money'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-black text-sm text-teal-700">
                            {formatCurrency(payAmt)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenConsultationTicket(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors"
                            title="Voir et imprimer le ticket de soin"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Ticket 80mm</span>
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

      {/* ============================================================== */}
      {/* 5. ONGLET : RECETTES PHARMACIE                                */}
      {/* ============================================================== */}
      {activeTab === 'pharmacy' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Pill className="w-4 h-4 text-indigo-600" />
                <span>Ventes de Médicaments 1. Pharmacie POS ({filteredPharmacySales.length})</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Encaissements réalisés au comptoir de la pharmacie
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-bold uppercase">Total Ventes :</span>
              <div className="text-lg font-black text-indigo-700">
                {formatCurrency(stats.pharmaTotal)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date &amp; Heure</th>
                  <th className="py-3 px-4">N° Ticket Vente</th>
                  <th className="py-3 px-4">Client / Patient</th>
                  <th className="py-3 px-4">Médicaments vendus</th>
                  <th className="py-3 px-4">Règlement</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPharmacySales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Aucune vente de pharmacie enregistrée pour cette période.
                    </td>
                  </tr>
                ) : (
                  filteredPharmacySales.map((s) => {
                    const clientName = s.patient
                      ? `${s.patient.lastName.toUpperCase()} ${s.patient.firstName}`
                      : s.customerName || 'Client de passage';

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {formatDateTime(s.saleDate)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {s.saleNumber}
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-900">
                          {clientName}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <span className="font-semibold block truncate max-w-xs" title={s.items.map((i) => `${i.medicineName} (x${i.quantity})`).join(', ')}>
                            {s.items.map((i) => `${i.medicineName} (x${i.quantity})`).join(', ')}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {s.items.length} produit(s)
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {s.paymentMethod === 'CASH' ? '💵 Espèces' : '📱 Mobile Money'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-black text-sm text-indigo-700">
                            {formatCurrency(s.total)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenPharmacyReceipt(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                            title="Voir et réimprimer le reçu pharmacie"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Reçu POS</span>
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

      {/* ============================================================== */}
      {/* 6. ONGLET : SUIVI PAIEMENT ACTES & HÉBERGEMENTS                */}
      {/* ============================================================== */}
      {activeTab === 'consumables' && (
        <div className="space-y-4">
          {/* Cartes de statistiques rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Encaissé</span>
              <span className="text-xl font-black text-amber-700 font-mono mt-1 block">
                {formatCurrency(consumablesStats.totalPaid)}
              </span>
              <span className="text-[11px] text-emerald-600 font-medium">
                {consumablesStats.countPaid} fiche(s) réglée(s)
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">En attente d'encaissement</span>
              <span className="text-xl font-black text-rose-600 font-mono mt-1 block">
                {formatCurrency(consumablesStats.pendingAmount)}
              </span>
              <span className="text-[11px] text-rose-500 font-medium">
                {consumablesStats.countPending} fiche(s) en attente
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Fiches Vierges Émises</span>
              <span className="text-xl font-black text-slate-800 font-mono mt-1 block">
                {consumablesStats.countBlank}
              </span>
              <span className="text-[11px] text-slate-400">À compléter manuellement</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Fiches</span>
              <span className="text-xl font-black text-blue-700 font-mono mt-1 block">
                {filteredConsumables.length}
              </span>
              <span className="text-[11px] text-slate-400">Période sélectionnée</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  <span>Suivi des Paiements : 4. Actes &amp; Hébergements ({filteredConsumables.length})</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Règlements des consommables, actes infirmiers et frais de séjour hospitalier
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-bold uppercase">Total Réglé :</span>
                <div className="text-lg font-black text-amber-700">
                  {formatCurrency(consumablesStats.totalPaid)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Réf. Fiche</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Patient / Client</th>
                    <th className="py-3 px-4">Chambre</th>
                    <th className="py-3 px-4">Détail des Prestations</th>
                    <th className="py-3 px-4">Mode de Règlement</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Montant Total</th>
                    <th className="py-3 px-4 text-center">Facture A4</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredConsumables.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">Aucun mouvement pour cette période</p>
                      </td>
                    </tr>
                  ) : (
                    filteredConsumables.map((cd) => {
                      const dateStr = cd.date ? formatDateTime(cd.date) : formatDateTime(cd.createdAt);
                      const patName = cd.patient
                        ? `${cd.patient.lastName.toUpperCase()} ${cd.patient.firstName}`
                        : cd.patientName || 'Client externe';

                      return (
                        <tr key={cd.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-blue-700">
                            {cd.sheetReference || cd.deliveryNumber}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {dateStr}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{patName}</span>
                            {(cd.fileNumber || cd.patient?.patientNumber) && (
                              <span className="text-[10px] text-slate-400">
                                Dossier : {cd.fileNumber || cd.patient?.patientNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {cd.roomNumber ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Bed className="w-3 h-3 text-amber-600" />
                                {cd.roomNumber}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-700 block">
                              {cd.items.length} prestation(s)
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-xs block">
                              {cd.items.map((i) => i.itemName).slice(0, 3).join(', ')}
                              {cd.items.length > 3 ? '...' : ''}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {cd.paymentMethod === 'CASH'
                                ? '💵 Espèces'
                                : ['MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY'].includes(cd.paymentMethod)
                                ? '📱 Mobile Money'
                                : cd.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {cd.status === 'BLANK' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Vierge (À saisir)</span>
                              </span>
                            ) : cd.paymentStatus === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Encaissé</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <Clock className="w-3 h-3 text-rose-600" />
                                <span>En attente</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-black text-sm text-slate-900 font-mono">
                              {cd.status === 'BLANK' ? '—' : formatCurrency(cd.totalAmount)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Link
                              href="/pharmacy/consumables"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                              title="Accéder à la fiche et imprimer la facture A4"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Facture A4</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Réimpression Ticket Consultation 2 Volets */}
      {selectedConsultationTicket && (
        <ConsultationDualTicketPreview
          ticketData={selectedConsultationTicket}
          onClose={() => setSelectedConsultationTicket(null)}
          isNewPayment={false}
        />
      )}

      {/* Modal Réimpression Ticket Pharmacie */}
      {selectedPharmacyReceipt && (
        <ThermalReceiptPreview
          receiptData={selectedPharmacyReceipt}
          onClose={() => setSelectedPharmacyReceipt(null)}
          isNewSale={false}
        />
      )}
    </div>
  );
}
