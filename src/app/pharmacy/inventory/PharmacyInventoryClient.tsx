'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Printer,
  RefreshCw,
  FileText,
  Eye,
  ShieldCheck,
  ClipboardCheck,
  Package,
  Layers,
  ChevronDown,
  Info,
  Calendar,
  User,
  CheckSquare,
  Square,
  TrendingDown,
  TrendingUp,
  Download,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { AuthUser } from '@/types';
import {
  downloadBlankInventorySheetPdf,
  downloadInventoryBilanPdf,
} from '@/lib/inventoryReportPdf';

interface MedicineItem {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  form: string;
  location?: string | null;
  currentStock: number;
  minStockLevel: number;
  purchasePrice: number;
  sellingPrice: number;
  category?: { id: string; name: string } | null;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface PastInventoryItem {
  id: string;
  medicineId: string;
  medicineName: string;
  theoreticalStock: number;
  countedStock: number;
  difference: number;
  purchasePrice: number;
  financialImpact: number;
  reason: string | null;
  medicine?: {
    dosage?: string;
    form?: string;
    location?: string | null;
    category?: { name: string } | null;
  } | null;
}

interface PastInventory {
  id: string;
  inventoryNumber: string;
  title: string;
  status: string;
  notes: string | null;
  totalItemsCount: number;
  discrepancyCount: number;
  totalFinancialImpact: number;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string | Date;
  items: PastInventoryItem[];
}

interface PharmacyInventoryClientProps {
  currentUser: AuthUser;
  medicines: MedicineItem[];
  categories: CategoryItem[];
  initialInventories: PastInventory[];
}

export default function PharmacyInventoryClient({
  currentUser,
  medicines,
  categories,
  initialInventories,
}: PharmacyInventoryClientProps) {
  const router = useRouter();

  // Navigation par onglets principaux
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Sous-étapes de la création : 1 = Sélection des médicaments, 2 = Saisie du comptage
  const [inventoryStep, setInventoryStep] = useState<1 | 2>(1);

  // Titre & Notes de l'inventaire journalier en cours
  const [inventoryTitle, setInventoryTitle] = useState<string>(
    `Inventaire Journalier Pharmacie du ${new Date().toLocaleDateString('fr-FR')}`
  );
  const [inventoryNotes, setInventoryNotes] = useState<string>('');

  // Liste des identifiants de médicaments sélectionnés pour l'inventaire
  const [selectedMedicineIds, setSelectedMedicineIds] = useState<Set<string>>(new Set());

  // Valeurs saisies lors du comptage physique : { [medicineId]: { countedStock: number, reason: string, remark: string } }
  const [counts, setCounts] = useState<Record<string, { countedStock: number; reason: string; remark: string }>>({});

  // Helper pour séparer Motif et Remarque stockés dans reason
  const parseReasonAndRemark = (raw?: string | null) => {
    if (!raw || !raw.trim()) return { motif: 'Conforme', remark: 'Néant' };
    const idx = raw.indexOf(' | Remarque : ');
    if (idx !== -1) {
      const motif = raw.slice(0, idx).trim() || 'Écart constaté';
      const remark = raw.slice(idx + ' | Remarque : '.length).trim() || 'Néant';
      return { motif, remark };
    }
    return { motif: raw.trim(), remark: 'Néant' };
  };

  // Filtres de sélection (Étape 1)
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockLevelFilter, setStockLevelFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'NORMAL'>('ALL');

  // État de validation & enregistrement
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Modal de visualisation d'un inventaire passé
  const [selectedPastInventory, setSelectedPastInventory] = useState<PastInventory | null>(null);

  // Recherche dans l'historique
  const [historySearch, setHistorySearch] = useState('');

  // Génération PDF A4 directe (jsPDF + autoTable) — Fiche vierge, Bilan en cours, ou Procès-Verbal historique
  const handleDownloadBlankPdf = () => {
    if (selectedMedicinesList.length === 0) return;
    downloadBlankInventorySheetPdf({
      title: inventoryTitle,
      operatorName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      items: selectedMedicinesList.map((m) => ({
        name: m.name,
        genericName: m.genericName,
        dosage: m.dosage,
        form: m.form,
        location: m.location,
        currentStock: m.currentStock,
      })),
    });
  };

  const handleDownloadCurrentBilanPdf = () => {
    if (selectedMedicinesList.length === 0) return;
    downloadInventoryBilanPdf({
      title: inventoryTitle,
      date: new Date(),
      operatorName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      notes: inventoryNotes.trim() || 'Néant',
      statusLabel: 'BILAN EN COURS',
      items: selectedMedicinesList.map((m) => {
        const itemState = counts[m.id] || { countedStock: m.currentStock, reason: 'Conforme', remark: '' };
        const diff = itemState.countedStock - m.currentStock;
        return {
          name: m.name,
          dosage: m.dosage,
          form: m.form,
          location: m.location,
          theoreticalStock: m.currentStock,
          countedStock: itemState.countedStock,
          difference: diff,
          financialImpact: diff * m.purchasePrice,
          motif: itemState.reason || 'Conforme',
          remark: itemState.remark?.trim() || 'Néant',
        };
      }),
    });
  };

  const handleDownloadPastInventoryPdf = (inv: PastInventory) => {
    downloadInventoryBilanPdf({
      inventoryNumber: inv.inventoryNumber,
      title: inv.title,
      date: inv.createdAt,
      operatorName: inv.createdByName || 'Pharmacien',
      notes: inv.notes || 'Néant',
      statusLabel: 'VALIDE & REGULARISE',
      items: inv.items.map((it) => {
        const parsed = parseReasonAndRemark(it.reason);
        return {
          name: it.medicineName,
          dosage: it.medicine?.dosage,
          form: it.medicine?.form,
          location: it.medicine?.location,
          theoreticalStock: it.theoreticalStock,
          countedStock: it.countedStock,
          difference: it.difference,
          financialImpact: it.financialImpact,
          motif: parsed.motif,
          remark: parsed.remark,
        };
      }),
    });
  };

  // -------------------------------------------------------------
  // FILTRAGE DES MÉDICAMENTS (Étape 1)
  // -------------------------------------------------------------
  const filteredMedicines = useMemo(() => {
    return medicines.filter((med) => {
      // Recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = med.name.toLowerCase().includes(q);
        const matchesGeneric = med.genericName.toLowerCase().includes(q);
        const matchesForm = med.form.toLowerCase().includes(q);
        const matchesLocation = med.location?.toLowerCase().includes(q);
        if (!matchesName && !matchesGeneric && !matchesForm && !matchesLocation) {
          return false;
        }
      }

      // Filtre catégorie
      if (categoryFilter !== 'ALL' && med.category?.id !== categoryFilter) {
        return false;
      }

      // Filtre niveau de stock
      if (stockLevelFilter === 'OUT' && med.currentStock > 0) return false;
      if (stockLevelFilter === 'LOW' && (med.currentStock <= 0 || med.currentStock > med.minStockLevel)) return false;
      if (stockLevelFilter === 'NORMAL' && med.currentStock <= med.minStockLevel) return false;

      return true;
    });
  }, [medicines, searchQuery, categoryFilter, stockLevelFilter]);

  // -------------------------------------------------------------
  // GESTION DE LA SÉLECTION PERSONNALISÉE
  // -------------------------------------------------------------
  const toggleSelectMedicine = (id: string) => {
    setSelectedMedicineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedMedicineIds((prev) => {
      const next = new Set(prev);
      filteredMedicines.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedMedicineIds((prev) => {
      const next = new Set(prev);
      filteredMedicines.forEach((m) => next.delete(m.id));
      return next;
    });
  };

  const selectLowAndOutOfStock = () => {
    setSelectedMedicineIds((prev) => {
      const next = new Set(prev);
      medicines.forEach((m) => {
        if (m.currentStock <= m.minStockLevel) {
          next.add(m.id);
        }
      });
      return next;
    });
  };

  const selectAllCatalogue = () => {
    setSelectedMedicineIds(new Set(medicines.map((m) => m.id)));
  };

  const clearAllSelection = () => {
    setSelectedMedicineIds(new Set());
  };

  // Liste ordonnée des médicaments sélectionnés pour le comptage
  const selectedMedicinesList = useMemo(() => {
    return medicines.filter((m) => selectedMedicineIds.has(m.id));
  }, [medicines, selectedMedicineIds]);

  // Initialisation des données de comptage lors du passage à l'étape 2
  const handleProceedToCount = () => {
    if (selectedMedicineIds.size === 0) return;
    const initialCounts: Record<string, { countedStock: number; reason: string; remark: string }> = {};
    selectedMedicinesList.forEach((m) => {
      initialCounts[m.id] = {
        countedStock: counts[m.id]?.countedStock !== undefined ? counts[m.id].countedStock : m.currentStock,
        reason: counts[m.id]?.reason || 'Conforme',
        remark: counts[m.id]?.remark || '',
      };
    });
    setCounts(initialCounts);
    setInventoryStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Mise à jour de la saisie physique
  const handleCountChange = (medicineId: string, val: number) => {
    const safeVal = Math.max(0, val);
    setCounts((prev) => ({
      ...prev,
      [medicineId]: {
        countedStock: safeVal,
        reason: prev[medicineId]?.reason || 'Conforme',
        remark: prev[medicineId]?.remark || '',
      },
    }));
  };

  const handleReasonChange = (medicineId: string, reason: string) => {
    setCounts((prev) => ({
      ...prev,
      [medicineId]: {
        countedStock: prev[medicineId]?.countedStock ?? 0,
        reason,
        remark: prev[medicineId]?.remark || '',
      },
    }));
  };

  const handleRemarkChange = (medicineId: string, remark: string) => {
    setCounts((prev) => ({
      ...prev,
      [medicineId]: {
        countedStock: prev[medicineId]?.countedStock ?? 0,
        reason: prev[medicineId]?.reason || 'Conforme',
        remark,
      },
    }));
  };

  // -------------------------------------------------------------
  // CALCULS STATISTIQUES EN TEMPS RÉEL (Étape 2)
  // -------------------------------------------------------------
  const countingStats = useMemo(() => {
    let perfectCount = 0;
    let discrepancyCount = 0;
    let missingUnits = 0;
    let surplusUnits = 0;
    let totalFinancialImpact = 0;

    selectedMedicinesList.forEach((m) => {
      const counted = counts[m.id]?.countedStock ?? m.currentStock;
      const diff = counted - m.currentStock;
      const financialImpact = diff * m.purchasePrice;

      totalFinancialImpact += financialImpact;

      if (diff === 0) {
        perfectCount++;
      } else {
        discrepancyCount++;
        if (diff < 0) {
          missingUnits += Math.abs(diff);
        } else {
          surplusUnits += diff;
        }
      }
    });

    return {
      totalItems: selectedMedicinesList.length,
      perfectCount,
      discrepancyCount,
      missingUnits,
      surplusUnits,
      totalFinancialImpact,
    };
  }, [selectedMedicinesList, counts]);

  // -------------------------------------------------------------
  // VALIDATION & ENREGISTREMENT DE L'INVENTAIRE
  // -------------------------------------------------------------
  const handleSubmitInventory = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const itemsPayload = selectedMedicinesList.map((m) => {
        const itemData = counts[m.id] || { countedStock: m.currentStock, reason: 'Conforme', remark: '' };
        return {
          medicineId: m.id,
          countedStock: itemData.countedStock,
          reason: itemData.reason,
          remark: itemData.remark?.trim() || 'Néant',
        };
      });

      const response = await fetch('/api/pharmacy/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: inventoryTitle,
          notes: inventoryNotes.trim() || 'Néant',
          items: itemsPayload,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la validation de l\'inventaire');
      }

      setShowConfirmModal(false);
      setSubmitSuccess(
        `L'inventaire ${data.inventory.inventoryNumber} a été validé avec succès ! Les stocks physiques ont été mis à jour et régularisés.`
      );

      // Réinitialiser les champs et basculer sur l'historique
      setSelectedMedicineIds(new Set());
      setCounts({});
      setInventoryStep(1);
      router.refresh();
      setTimeout(() => {
        setActiveTab('history');
      }, 1200);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrage de l'historique des inventaires
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return initialInventories;
    const q = historySearch.toLowerCase();
    return initialInventories.filter(
      (inv) =>
        inv.inventoryNumber.toLowerCase().includes(q) ||
        inv.title.toLowerCase().includes(q) ||
        (inv.createdByName && inv.createdByName.toLowerCase().includes(q))
    );
  }, [initialInventories, historySearch]);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* ONGLETS PRINCIPAUX */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-slate-200 gap-4 no-print">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2.5 pb-3 px-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'create'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Nouvel Inventaire Personnalisé</span>
          <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            Sur-Mesure
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2.5 pb-3 px-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Historique des Inventaires & Procès-Verbaux</span>
          <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-100 text-slate-600">
            {initialInventories.length}
          </span>
        </button>
      </div>

      {/* Messages d'alerte / feedback */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm no-print shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1 font-medium">{submitSuccess}</div>
          <button onClick={() => setSubmitSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {submitError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm no-print shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{submitError}</div>
          <button onClick={() => setSubmitError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CONTENU ONGLET 1 : NOUVEL INVENTAIRE PERSONNALISÉ */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Indicateur d'étape */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 no-print shadow-xs">
            <div className="flex items-center gap-6">
              <div
                onClick={() => setInventoryStep(1)}
                className={`flex items-center gap-3 cursor-pointer ${
                  inventoryStep === 1 ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    inventoryStep === 1
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  1
                </div>
                <span className="text-xs sm:text-sm">Sélection Personnalisée des Produits</span>
              </div>

              <div className="w-8 h-px bg-slate-200"></div>

              <div
                onClick={() => {
                  if (selectedMedicineIds.size > 0) handleProceedToCount();
                }}
                className={`flex items-center gap-3 ${
                  selectedMedicineIds.size > 0 ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                } ${
                  inventoryStep === 2 ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    inventoryStep === 2
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  2
                </div>
                <span className="text-xs sm:text-sm">Comptage Physique & Régularisation</span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-slate-500">Sélectionnés :</span>
              <span className="px-2.5 py-1 text-xs font-extrabold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                {selectedMedicineIds.size} / {medicines.length}
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* ÉTAPE 1 : SÉLECTION PERSONNALISÉE DES MÉDICAMENTS */}
          {/* ========================================================= */}
          {inventoryStep === 1 && (
            <div className="space-y-5">
              {/* Filtres & Recherche */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3 no-print">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Recherche texte */}
                  <div className="md:col-span-2 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher par nom commercial, DCI, forme ou rayon..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Filtre catégorie */}
                  <div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-700"
                    >
                      <option value="ALL">Toutes les catégories ({categories.length})</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtre niveau de stock */}
                  <div>
                    <select
                      value={stockLevelFilter}
                      onChange={(e) => setStockLevelFilter(e.target.value as any)}
                      className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-700"
                    >
                      <option value="ALL">Tous les niveaux de stock</option>
                      <option value="LOW">Stock Faible (&le; seuil min)</option>
                      <option value="OUT">Rupture de Stock (0 unité)</option>
                      <option value="NORMAL">Stock Normal (&gt; seuil)</option>
                    </select>
                  </div>
                </div>

                {/* Boutons d'actions rapides de sélection */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllCatalogue}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Tout le Catalogue • Inventaire Journalier ({medicines.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Sélectionner affichés ({filteredMedicines.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={selectLowAndOutOfStock}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Sélectionner Stock Faible & Ruptures</span>
                    </button>

                    <button
                      type="button"
                      onClick={deselectAllFiltered}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      <span>Désélectionner affichés</span>
                    </button>

                    {selectedMedicineIds.size > 0 && (
                      <button
                        type="button"
                        onClick={clearAllSelection}
                        className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        Tout effacer ({selectedMedicineIds.size})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadBlankPdf}
                      disabled={selectedMedicineIds.size === 0}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-colors ${
                        selectedMedicineIds.size > 0
                          ? 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer'
                          : 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                      }`}
                      title="Télécharger la fiche de comptage vierge en PDF A4 pour contrôle en rayon"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Télécharger Fiche Vierge PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleProceedToCount}
                      disabled={selectedMedicineIds.size === 0}
                      className={`px-4 py-1.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors ${
                        selectedMedicineIds.size > 0
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span>Passer au Comptage ({selectedMedicineIds.size})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tableau de sélection des médicaments */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden no-print">
                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                  <div className="flex items-center gap-2">
                    <span>Catalogue Pharmacie ({filteredMedicines.length} affichés / {medicines.length} total)</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    Cochez les produits que vous souhaitez inclure dans cette session d'inventaire
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredMedicines.length > 0 &&
                              filteredMedicines.every((m) => selectedMedicineIds.has(m.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) selectAllFiltered();
                              else deselectAllFiltered();
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">Médicament & Dosage</th>
                        <th className="py-2.5 px-3">Catégorie</th>
                        <th className="py-2.5 px-3">Emplacement</th>
                        <th className="py-2.5 px-3 text-right">Prix Achat</th>
                        <th className="py-2.5 px-3 text-center">Stock Théorique</th>
                        <th className="py-2.5 px-3 text-center">État</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMedicines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Aucun médicament ne correspond aux critères de recherche.
                          </td>
                        </tr>
                      ) : (
                        filteredMedicines.map((med) => {
                          const isSelected = selectedMedicineIds.has(med.id);
                          const isLow = med.currentStock <= med.minStockLevel && med.currentStock > 0;
                          const isOut = med.currentStock <= 0;

                          return (
                            <tr
                              key={med.id}
                              onClick={() => toggleSelectMedicine(med.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-indigo-50/60 hover:bg-indigo-50' : 'hover:bg-slate-50/60'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectMedicine(med.id)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{med.name}</div>
                                <div className="text-[11px] text-slate-500">
                                  {med.genericName} • {med.dosage} • {med.form}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                                  {med.category?.name || 'Général'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                {med.location || 'Rayon général'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                                {formatCurrency(med.purchasePrice)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="font-extrabold text-slate-900 text-sm">
                                  {med.currentStock}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isOut ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                                    Rupture (0)
                                  </span>
                                ) : isLow ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
                                    Faible (&le;{med.minStockLevel})
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    Normal
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Barre de bas de page de sélection */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-bold text-slate-900">{selectedMedicineIds.size}</span> médicament(s)
                    sélectionné(s) pour cet inventaire personnalisé.
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadBlankPdf}
                      disabled={selectedMedicineIds.size === 0}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Télécharger Fiche PDF A4</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleProceedToCount}
                      disabled={selectedMedicineIds.size === 0}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Passer au Comptage Physique ({selectedMedicineIds.size})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Fiche imprimable vierge (visible uniquement lors du print @media print) */}
              <div className="hidden print:block print-section space-y-4">
                <div className="border-b-2 border-slate-900 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                        CLINIQUE BETESDA • OFFICINE PHARMACEUTIQUE
                      </h1>
                      <p className="text-xs font-semibold text-slate-600">
                        FICHE DE COMPTAGE PHYSIQUE POUR INVENTAIRE TOURNANT / PERSONNALISÉ
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-bold">Date : {new Date().toLocaleDateString('fr-FR')}</p>
                      <p className="text-slate-500">Heure : {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="font-bold">Titre session :</span> {inventoryTitle} •{' '}
                    <span className="font-bold">Total articles :</span> {selectedMedicineIds.size}
                  </div>
                </div>

                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                      <th className="border border-slate-300 p-2 w-10 text-center">N°</th>
                      <th className="border border-slate-300 p-2 text-left">Désignation Médicament / Forme / Dosage</th>
                      <th className="border border-slate-300 p-2 text-left">Emplacement</th>
                      <th className="border border-slate-300 p-2 text-center w-24">Stock Théorique</th>
                      <th className="border border-slate-300 p-2 text-center w-32 bg-slate-50 font-black">
                        COMPTAGE RÉEL
                      </th>
                      <th className="border border-slate-300 p-2 text-left">Observations / N° Lot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMedicinesList.map((m, idx) => (
                      <tr key={m.id} className="border-b border-slate-300">
                        <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-bold">
                          {m.name}
                          <span className="font-normal text-slate-600 text-[11px] block">
                            {m.genericName} • {m.dosage} • {m.form}
                          </span>
                        </td>
                        <td className="border border-slate-300 p-2">{m.location || 'Rayon A'}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold text-slate-700">
                          {m.currentStock}
                        </td>
                        <td className="border-2 border-indigo-500 p-2 text-center bg-white h-8">
                          {/* Ligne vide pour écriture manuscrite au stylo */}
                        </td>
                        <td className="border border-slate-300 p-2"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="pt-6 grid grid-cols-2 gap-8 text-xs">
                  <div className="border border-slate-300 p-4 rounded h-24">
                    <p className="font-bold">Pharmacien / Agent de comptage :</p>
                    <p className="text-slate-500 mt-1">Nom & Signature :</p>
                  </div>
                  <div className="border border-slate-300 p-4 rounded h-24">
                    <p className="font-bold">Contrôle / Visa de la Direction :</p>
                    <p className="text-slate-500 mt-1">Date & Cachet :</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* ÉTAPE 2 : SAISIE DU COMPTAGE PHYSIQUE & RÉGULARISATION */}
          {/* ========================================================= */}
          {inventoryStep === 2 && (
            <div className="space-y-6">
              {/* Entête de session */}
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4 no-print">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                      Étape 2 / 2 • Prise d'Inventaire
                    </span>
                    <h2 className="text-lg font-black text-slate-900 mt-0.5">
                      Saisie du Stock Réel & Calcul des Écarts
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setInventoryStep(1)}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 self-start"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Modifier la sélection des médicaments</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Titre / Référence de l'inventaire <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={inventoryTitle}
                      onChange={(e) => setInventoryTitle(e.target.value)}
                      placeholder="Ex: Inventaire Mensuel Antibiotiques et Sirop"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Notes / Observations générales (Optionnel — Néant par défaut)
                    </label>
                    <input
                      type="text"
                      value={inventoryNotes}
                      onChange={(e) => setInventoryNotes(e.target.value)}
                      placeholder="Néant (ou saisir une observation générale du jour...)"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cartes KPI en temps réel de la session */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Références Contrôlées</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{countingStats.totalItems}</p>
                  <p className="text-[11px] text-slate-500">Articles sélectionnés</p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-[11px] font-semibold text-emerald-600 uppercase">Articles Conformes</p>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">{countingStats.perfectCount}</p>
                  <p className="text-[11px] text-emerald-700 font-medium">Zéro écart de stock</p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-[11px] font-semibold text-amber-600 uppercase">Articles avec Écart</p>
                  <p className="text-2xl font-extrabold text-amber-600 mt-1">{countingStats.discrepancyCount}</p>
                  <p className="text-[11px] text-amber-700 font-medium">
                    -{countingStats.missingUnits} manquants / +{countingStats.surplusUnits} surplus
                  </p>
                </div>

                <div
                  className={`p-4 rounded-xl border shadow-xs ${
                    countingStats.totalFinancialImpact < 0
                      ? 'bg-rose-50/70 border-rose-200'
                      : countingStats.totalFinancialImpact > 0
                      ? 'bg-blue-50/70 border-blue-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Impact Financier Net</p>
                  <p
                    className={`text-xl font-extrabold mt-1 ${
                      countingStats.totalFinancialImpact < 0
                        ? 'text-rose-700'
                        : countingStats.totalFinancialImpact > 0
                        ? 'text-blue-700'
                        : 'text-slate-800'
                    }`}
                  >
                    {countingStats.totalFinancialImpact > 0 ? '+' : ''}
                    {formatCurrency(countingStats.totalFinancialImpact)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {countingStats.totalFinancialImpact < 0
                      ? 'Perte financière nette'
                      : countingStats.totalFinancialImpact > 0
                      ? 'Excédent valorisé'
                      : 'Équilibre parfait'}
                  </p>
                </div>
              </div>

              {/* Tableau de saisie physique interactive */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden no-print">
                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700">
                    Feuille de saisie des comptages réels ({selectedMedicinesList.length} articles)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Saisissez le nombre physique réel ou cliquez sur les boutons rapides
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Médicament</th>
                        <th className="py-2.5 px-3">Rayon</th>
                        <th className="py-2.5 px-3 text-center w-28">Stock Système</th>
                        <th className="py-2.5 px-3 text-center w-52 bg-indigo-50/40">
                          Stock Réel Compté
                        </th>
                        <th className="py-2.5 px-3 text-center w-24">Écart</th>
                        <th className="py-2.5 px-3 text-right w-28">Impact (Ar)</th>
                        <th className="py-2.5 px-3 w-44">Motif / Justification</th>
                        <th className="py-2.5 px-3 min-w-[210px]">Remarque sur l'écart (Journalier)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedMedicinesList.map((m) => {
                        const itemState = counts[m.id] || { countedStock: m.currentStock, reason: 'Conforme', remark: '' };
                        const theoretical = m.currentStock;
                        const counted = itemState.countedStock;
                        const diff = counted - theoretical;
                        const impact = diff * m.purchasePrice;

                        return (
                          <tr
                            key={m.id}
                            className={`transition-colors ${
                              diff !== 0 ? 'bg-amber-50/20' : 'hover:bg-slate-50/60'
                            }`}
                          >
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{m.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {m.genericName} • {m.dosage}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                              {m.location || 'A1'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="font-extrabold text-slate-700 text-sm">{theoretical}</span>
                            </td>
                            <td className="py-3 px-3 text-center bg-indigo-50/20">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCountChange(m.id, counted - 1)}
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                                  title="Diminuer de 1"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={counted}
                                  onChange={(e) => handleCountChange(m.id, parseInt(e.target.value, 10) || 0)}
                                  className="w-16 px-2 py-1 text-center font-extrabold text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleCountChange(m.id, counted + 1)}
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                                  title="Augmenter de 1"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCountChange(m.id, theoretical)}
                                  className="px-1.5 py-1 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                  title="Réinitialiser au stock théorique"
                                >
                                  =
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {diff === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-700">
                                  <Check className="w-3 h-3" />
                                  0
                                </span>
                              ) : diff < 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                                  <TrendingDown className="w-3 h-3" />
                                  {diff}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-700 border border-blue-200">
                                  <TrendingUp className="w-3 h-3" />
                                  +{diff}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span
                                className={`font-bold ${
                                  impact < 0 ? 'text-rose-600' : impact > 0 ? 'text-blue-600' : 'text-slate-400'
                                }`}
                              >
                                {impact > 0 ? '+' : ''}
                                {formatCurrency(impact)}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={itemState.reason}
                                onChange={(e) => handleReasonChange(m.id, e.target.value)}
                                className={`w-full py-1 px-2 text-xs rounded-lg border focus:outline-hidden ${
                                  diff !== 0
                                    ? 'border-amber-300 bg-amber-50/50 text-slate-800 font-medium'
                                    : 'border-slate-200 text-slate-500'
                                }`}
                              >
                                <option value="Conforme">Conforme (Zéro écart)</option>
                                <option value="Périmé / Avarie">Périmé / Avarie</option>
                                <option value="Casse / Flacon brisé">Casse / Flacon brisé</option>
                                <option value="Erreur de saisie antérieure">Erreur de saisie antérieure</option>
                                <option value="Vol / Disparition inexpliquée">Vol / Disparition inexpliquée</option>
                                <option value="Échantillon / Don offert">Échantillon / Don offert</option>
                                <option value="Autre motif">Autre motif</option>
                              </select>
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={itemState.remark || ''}
                                onChange={(e) => handleRemarkChange(m.id, e.target.value)}
                                placeholder={
                                  diff !== 0
                                    ? "Précisez la remarque sur cet écart du jour..."
                                    : "Néant"
                                }
                                className={`w-full py-1.5 px-2.5 text-xs rounded-lg border focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                                  diff !== 0
                                    ? 'border-amber-400 bg-amber-50/70 text-slate-900 font-medium placeholder:text-amber-700/70'
                                    : 'border-slate-200 bg-white text-slate-600 placeholder:text-slate-400'
                                }`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer d'action et de validation */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500">Bilan :</span>
                    <span className="font-bold text-slate-800">
                      {countingStats.discrepancyCount} écart(s) constaté(s)
                    </span>
                    <span>•</span>
                    <span
                      className={`font-black ${
                        countingStats.totalFinancialImpact < 0
                          ? 'text-rose-600'
                          : countingStats.totalFinancialImpact > 0
                          ? 'text-blue-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      Impact net : {countingStats.totalFinancialImpact > 0 ? '+' : ''}
                      {formatCurrency(countingStats.totalFinancialImpact)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadCurrentBilanPdf}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger Bilan PDF A4</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(true)}
                      className="px-5 py-2.5 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Valider & Régulariser le Stock</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Fiche imprimable du Bilan de comptage (visible uniquement lors du print @media print) */}
              <div className="hidden print:block print-section space-y-4">
                <div className="border-b-2 border-slate-900 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                        CLINIQUE BETESDA • OFFICINE PHARMACEUTIQUE
                      </h1>
                      <p className="text-xs font-semibold text-slate-600">
                        PROCÈS-VERBAL DE CONTRÔLE D'INVENTAIRE & CALCUL DES ÉCARTS
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-bold">Date : {new Date().toLocaleDateString('fr-FR')}</p>
                      <p className="text-slate-500">Heure : {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-200 grid grid-cols-3 gap-2">
                    <div><span className="font-bold">Titre :</span> {inventoryTitle}</div>
                    <div><span className="font-bold">Articles contrôlés :</span> {selectedMedicinesList.length}</div>
                    <div><span className="font-bold">Écarts constatés :</span> {countingStats.discrepancyCount}</div>
                  </div>
                </div>

                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                      <th className="border border-slate-300 p-2 text-left">Médicament</th>
                      <th className="border border-slate-300 p-2 text-center w-20">Stock Système</th>
                      <th className="border border-slate-300 p-2 text-center w-20">Compté Réel</th>
                      <th className="border border-slate-300 p-2 text-center w-20">Écart</th>
                      <th className="border border-slate-300 p-2 text-right w-24">Impact (Ar)</th>
                      <th className="border border-slate-300 p-2 text-left">Motif</th>
                      <th className="border border-slate-300 p-2 text-left">Remarque sur l'écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMedicinesList.map((m) => {
                      const itemState = counts[m.id] || { countedStock: m.currentStock, reason: 'Conforme', remark: '' };
                      const diff = itemState.countedStock - m.currentStock;
                      const impact = diff * m.purchasePrice;
                      return (
                        <tr key={m.id} className="border-b border-slate-300">
                          <td className="border border-slate-300 p-2 font-bold">
                            {m.name}
                            <span className="font-normal text-slate-500 text-[10px] block">{m.dosage} • {m.form}</span>
                          </td>
                          <td className="border border-slate-300 p-2 text-center">{m.currentStock}</td>
                          <td className="border border-slate-300 p-2 text-center font-bold">{itemState.countedStock}</td>
                          <td className="border border-slate-300 p-2 text-center font-bold">
                            {diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`}
                          </td>
                          <td className="border border-slate-300 p-2 text-right font-bold">
                            {impact !== 0 ? formatCurrency(impact) : '-'}
                          </td>
                          <td className="border border-slate-300 p-2">{itemState.reason || 'Conforme'}</td>
                          <td className="border border-slate-300 p-2">{itemState.remark?.trim() || 'Néant'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="pt-4 grid grid-cols-2 gap-8 text-xs">
                  <div className="border border-slate-300 p-4 rounded h-24">
                    <p className="font-bold">Pharmacien Responsable :</p>
                    <p className="text-slate-500 mt-1">Signature & Cachet :</p>
                  </div>
                  <div className="border border-slate-300 p-4 rounded h-24">
                    <p className="font-bold">Visa de la Direction Médicale :</p>
                    <p className="text-slate-500 mt-1">Date & Visa :</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CONTENU ONGLET 2 : HISTORIQUE DES INVENTAIRES RÉALISÉS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Rechercher par N° référence (INV-...), titre, ou responsable..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="text-xs text-slate-500">
              Total : <span className="font-bold text-slate-800">{filteredHistory.length}</span> inventaire(s)
              enregistré(s)
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Réf. & Date</th>
                    <th className="py-3 px-4">Titre de l'Inventaire</th>
                    <th className="py-3 px-4">Responsable</th>
                    <th className="py-3 px-4 text-center">Articles Contrôlés</th>
                    <th className="py-3 px-4 text-center">Écarts</th>
                    <th className="py-3 px-4 text-right">Impact Financier</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        Aucun inventaire n'a encore été réalisé.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                            {inv.inventoryNumber}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {formatDateTime(inv.createdAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{inv.title}</div>
                          {inv.notes && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{inv.notes}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {inv.createdByName || 'Pharmacien'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {inv.totalItemsCount}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {inv.discrepancyCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
                              {inv.discrepancyCount} écarts
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Conforme
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          <span
                            className={
                              inv.totalFinancialImpact < 0
                                ? 'text-rose-600'
                                : inv.totalFinancialImpact > 0
                                ? 'text-blue-600'
                                : 'text-slate-500'
                            }
                          >
                            {inv.totalFinancialImpact > 0 ? '+' : ''}
                            {formatCurrency(inv.totalFinancialImpact)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Validé & Régularisé
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedPastInventory(inv)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Détail</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPastInventoryPdf(inv)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Télécharger le Procès-Verbal d'inventaire au format PDF A4"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF A4</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE CONFIRMATION AVANT VALIDATION ET RÉGULARISATION */}
      {/* ------------------------------------------------------------- */}
      {showConfirmModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirmModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in cursor-pointer"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Confirmation de la Régularisation du Stock
                </h3>
                <p className="text-xs text-slate-500">Mise à jour définitive des stocks physiques</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-700">
              <p>
                Vous êtes sur le point de valider la session :{' '}
                <strong className="text-slate-900">"{inventoryTitle}"</strong>.
              </p>
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Articles contrôlés :</span>{' '}
                  <strong>{countingStats.totalItems}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Écarts constatés :</span>{' '}
                  <strong className="text-amber-600">{countingStats.discrepancyCount}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Impact financier :</span>{' '}
                  <strong
                    className={
                      countingStats.totalFinancialImpact < 0
                        ? 'text-rose-600'
                        : countingStats.totalFinancialImpact > 0
                        ? 'text-blue-600'
                        : 'text-emerald-600'
                    }
                  >
                    {countingStats.totalFinancialImpact > 0 ? '+' : ''}
                    {formatCurrency(countingStats.totalFinancialImpact)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Opérateur :</span>{' '}
                  <strong>{currentUser.firstName} {currentUser.lastName}</strong>
                </div>
              </div>
              <p className="pt-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                ⚠️ Les stocks actuels en base de données seront automatiquement ajustés pour correspondre exactement aux comptages réels, et les mouvements d'entrées/sorties de régularisation seront inscrits dans le registre d'audit.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleSubmitInventory}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enregistrement en cours...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmer & Appliquer la Régularisation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL / VUE DÉTAILLÉE D'UN INVENTAIRE HISTORIQUE */}
      {/* ------------------------------------------------------------- */}
      {selectedPastInventory && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPastInventory(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in cursor-pointer"
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                    {selectedPastInventory.inventoryNumber}
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    {selectedPastInventory.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Enregistré le {formatDateTime(selectedPastInventory.createdAt)} par{' '}
                  <span className="font-semibold text-slate-700">
                    {selectedPastInventory.createdByName || 'Pharmacien'}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPastInventoryPdf(selectedPastInventory)}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger Procès-Verbal PDF A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPastInventory(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Bilan résumé */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="text-slate-500">Articles contrôlés :</span>{' '}
                <strong className="text-slate-900">{selectedPastInventory.totalItemsCount}</strong>
              </div>
              <div>
                <span className="text-slate-500">Écarts régularisés :</span>{' '}
                <strong className="text-amber-600">{selectedPastInventory.discrepancyCount}</strong>
              </div>
              <div>
                <span className="text-slate-500">Impact financier net :</span>{' '}
                <strong
                  className={
                    selectedPastInventory.totalFinancialImpact < 0
                      ? 'text-rose-600'
                      : selectedPastInventory.totalFinancialImpact > 0
                      ? 'text-blue-600'
                      : 'text-emerald-600'
                  }
                >
                  {selectedPastInventory.totalFinancialImpact > 0 ? '+' : ''}
                  {formatCurrency(selectedPastInventory.totalFinancialImpact)}
                </strong>
              </div>
            </div>

            {/* Liste des lignes d'articles */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Médicament</th>
                    <th className="py-2.5 px-3 text-center">Stock Avant</th>
                    <th className="py-2.5 px-3 text-center">Comptage Réel</th>
                    <th className="py-2.5 px-3 text-center">Écart</th>
                    <th className="py-2.5 px-3 text-right">Impact Financier</th>
                    <th className="py-2.5 px-3">Motif Justifié</th>
                    <th className="py-2.5 px-3">Remarque sur l'écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPastInventory.items.map((it) => {
                    const parsed = parseReasonAndRemark(it.reason);
                    return (
                    <tr
                      key={it.id}
                      className={it.difference !== 0 ? 'bg-amber-50/20' : 'hover:bg-slate-50/50'}
                    >
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {it.medicineName}
                        {it.medicine?.dosage && (
                          <span className="text-[11px] text-slate-500 font-normal block">
                            {it.medicine.dosage} • {it.medicine.form}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600">{it.theoreticalStock}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-900">{it.countedStock}</td>
                      <td className="py-2 px-3 text-center">
                        {it.difference === 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            0
                          </span>
                        ) : it.difference < 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            {it.difference}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                            +{it.difference}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">
                        <span
                          className={
                            it.financialImpact < 0
                              ? 'text-rose-600'
                              : it.financialImpact > 0
                              ? 'text-blue-600'
                              : 'text-slate-400'
                          }
                        >
                          {it.financialImpact > 0 ? '+' : ''}
                          {formatCurrency(it.financialImpact)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium">{parsed.motif}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {parsed.remark !== 'Néant' ? (
                          <span className="font-medium text-amber-800">{parsed.remark}</span>
                        ) : (
                          <span className="text-slate-400 italic">Néant</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedPastInventory(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
