'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Trash2,
  Printer,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Phone,
  Layers,
  ShoppingBag,
  CreditCard,
  X,
  Eye,
  Check,
  Calendar,
  ShieldCheck,
  RefreshCw,
  TrendingDown,
  Info,
  Edit2,
  Bed,
  Stethoscope,
  Pill,
  Sliders,
  DollarSign,
  PlusCircle,
  MinusCircle,
  Building,
  ClipboardList,
  Clock,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { AuthUser } from '@/types';

export interface MedicineItem {
  id: string;
  name: string;
  genericName?: string | null;
  dosage?: string | null;
  form?: string | null;
  packaging?: string | null;
  currentStock: number;
  minStockLevel?: number;
  purchasePrice?: number;
  sellingPrice: number;
  location?: string | null;
  category?: { name: string } | null;
}

export interface CatalogItem {
  id: string;
  category: 'MEDICAMENT' | 'ACTE_INFIRMIER' | 'HEBERGEMENT' | 'AUTRE' | string;
  name: string;
  description?: string | null;
  unit?: string | null;
  price: number;
  medicineId?: string | null;
  isActive: boolean;
  orderIndex: number;
}

export interface DeliveryItemRow {
  id?: string;
  category: 'MEDICAMENT' | 'ACTE_INFIRMIER' | 'HEBERGEMENT' | 'AUTRE';
  medicineId?: string | null;
  itemName: string;
  itemDate: string; // YYYY-MM-DD
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PastDeliveryItem {
  id: string;
  category?: string;
  medicineId?: string | null;
  itemName: string;
  itemDate?: string | Date | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  orderIndex?: number;
  medicine?: MedicineItem | null;
}

export interface PastDelivery {
  id: string;
  deliveryNumber: string;
  sheetReference?: string | null;
  roomNumber?: string | null;
  fileNumber?: string | null;
  patientId?: string | null;
  recipientName: string;
  recipientPhone?: string | null;
  patientName?: string | null;
  reason?: string | null;
  date?: string | Date;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  notes?: string | null;
  deliveredById?: string | null;
  deliveredByName?: string | null;
  status?: string;
  createdAt: string | Date;
  patient?: {
    id: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
  } | null;
  items: PastDeliveryItem[];
}

export interface PatientOption {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

interface ClinicInfo {
  name: string;
  email: string;
  phone: string;
  taxId: string;
  address: string;
  currency: string;
}

interface ConsumablesClientProps {
  currentUser: AuthUser;
  clinicInfo: ClinicInfo;
  allMedicines: MedicineItem[];
  initialDeliveries: PastDelivery[];
  patients: PatientOption[];
  initialCatalogItems: CatalogItem[];
}

interface SearchablePickerItem {
  id: string;
  name: string;
  subText?: string;
  badge?: string;
  price: number;
  unit?: string;
  stock?: number;
}

function SearchableCategoryPicker({
  placeholder,
  items,
  onSelect,
}: {
  placeholder: string;
  items: SearchablePickerItem[];
  onSelect: (item: SearchablePickerItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase().trim();
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.subText && it.subText.toLowerCase().includes(q)) ||
        (it.badge && it.badge.toLowerCase().includes(q))
    );
  }, [items, query]);

  return (
    <div ref={wrapperRef} className="relative w-full sm:w-[440px] lg:w-[540px]">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-2xs"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
            ▾
          </span>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 sm:right-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 min-w-[340px] sm:min-w-[540px] lg:min-w-[620px] max-h-[440px] overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider flex justify-between items-center sticky top-0 z-10 border-b border-slate-200">
            <span>{filtered.length} élément{filtered.length > 1 ? 's' : ''} disponible{filtered.length > 1 ? 's' : ''}</span>
            <span className="text-[11px] font-medium text-slate-400 normal-case">Cliquer sur une ligne pour ajouter</span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-5 text-center text-sm text-slate-400 italic">
              Aucun résultat pour « {query} ».
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item);
                  setQuery('');
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-3 hover:bg-blue-50/80 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-blue-700">
                      {item.name}
                    </span>
                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        item.badge === 'Plaquette'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : item.badge === 'Boîte'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.subText && (
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {item.subText}
                    </span>
                  )}
                </div>

                <div className="text-right shrink-0 pl-2">
                  <div className="font-black text-sm text-blue-700 font-mono">
                    {formatCurrency(item.price)}
                  </div>
                  {item.stock !== undefined && (
                    <span className={`text-xs font-bold block mt-0.5 ${
                      item.stock <= 5 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      Stock : {item.stock} {item.unit || ''}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ConsumablesClient({
  currentUser,
  clinicInfo,
  allMedicines,
  initialDeliveries,
  patients,
  initialCatalogItems,
}: ConsumablesClientProps) {
  // Navigation Tabs: 'list' (historique), 'entry' (saisie/modification), 'catalog' (gestion du catalogue)
  const [activeTab, setActiveTab] = useState<'list' | 'entry' | 'catalog'>('list');

  // State des fiches et du catalogue
  const [deliveries, setDeliveries] = useState<PastDelivery[]>(initialDeliveries);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(initialCatalogItems);

  // Filtres et recherche dans la liste
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Formulaire de saisie / modification
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [sheetReference, setSheetReference] = useState<string>('');
  const [patientNameCustom, setPatientNameCustom] = useState<string>('');
  const [fileNumber, setFileNumber] = useState<string>('');
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [sheetDate, setSheetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [recipientName, setRecipientName] = useState<string>('Infirmière de garde');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [reason, setReason] = useState<string>('Hospitalisation & Soins infirmiers');
  const [notes, setNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  // Cible d'impression A4 : 'BLANK' (Fiche vierge calibrée 1 page) ou 'DELIVERY' (Fiche remplie / Facture globale)
  const [printTarget, setPrintTarget] = useState<'BLANK' | 'DELIVERY'>('DELIVERY');

  // Lignes d'articles dans la fiche en cours de saisie
  const [currentItems, setCurrentItems] = useState<DeliveryItemRow[]>([]);

  // Feedback notifications
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Modale d'aperçu d'une fiche remplie A4
  const [previewDelivery, setPreviewDelivery] = useState<PastDelivery | null>(null);

  // Modale Fiche Vierge A4 (Configuration des lignes par catégorie - calibré pour 1 page A4 stricte)
  const [blankModalOpen, setBlankModalOpen] = useState<boolean>(false);
  const [blankReference, setBlankReference] = useState<string>('');
  const [blankLinesConfig, setBlankLinesConfig] = useState({
    MEDICAMENT: 12,
    ACTE_INFIRMIER: 4,
    HEBERGEMENT: 3,
    AUTRE: 3,
  });

  // Modale d'encaissement direct d'une fiche (Accueil)
  const [cashingModalDelivery, setCashingModalDelivery] = useState<PastDelivery | null>(null);
  const [cashingPaymentMethod, setCashingPaymentMethod] = useState<string>('CASH');

  // Modale CRUD Catalogue
  const [catalogModalOpen, setCatalogModalOpen] = useState<boolean>(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null);
  const [catalogFilterCategory, setCatalogFilterCategory] = useState<string>('ALL');
  const [catalogFormData, setCatalogFormData] = useState({
    category: 'ACTE_INFIRMIER',
    name: '',
    description: '',
    unit: 'Acte',
    price: 5000,
  });

  // Modale de confirmation de suppression
  const [deleteConfirmDelivery, setDeleteConfirmDelivery] = useState<PastDelivery | null>(null);
  const [deleteConfirmCatalog, setDeleteConfirmCatalog] = useState<CatalogItem | null>(null);

  // Fonction d'impression A4 / Téléchargement PDF avec nom de document soigné
  const handlePrintCleanA4 = (customTitle?: string | React.MouseEvent) => {
    const originalTitle = document.title;
    const title =
      typeof customTitle === 'string'
        ? customTitle
        : printTarget === 'BLANK'
        ? `Fiche_Vierge_${blankReference || 'PF'}_Betesda`
        : `Facture_Globale_${previewDelivery?.sheetReference || previewDelivery?.deliveryNumber || 'PF'}_Betesda`;
    document.title = title;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1200);
  };

  // Helper pour initialiser la référence suivante de fiche vierge
  const handleOpenBlankModal = async () => {
    try {
      const res = await fetch('/api/pharmacy/consumables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-blank-ref' }),
      });
      const data = await res.json();
      if (data?.sheetReference) {
        setBlankReference(data.sheetReference);
      } else {
        const nextNum = deliveries.length + 1;
        setBlankReference(`PF - ${String(nextNum).padStart(4, '0')}`);
      }
    } catch {
      const nextNum = deliveries.length + 1;
      setBlankReference(`PF - ${String(nextNum).padStart(4, '0')}`);
    }
    setBlankModalOpen(true);
  };

  // Impression d'une fiche vierge avec numérotation automatique et enregistrement dans l'historique
  const handlePrintBlankSheetAutoIncrement = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pharmacy/consumables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-blank',
          recipientName: recipientName || 'Infirmière / Service de soins',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération de la fiche vierge.');

      // Ajouter la fiche vierge créée dans l'état local (apparaît instantanément dans Fiches & Historique)
      setDeliveries((prev) => [data.delivery, ...prev]);
      setBlankReference(data.sheetReference);
      setSuccessMsg(`Fiche vierge n° ${data.sheetReference} enregistrée dans l'historique avec succès.`);

      // Enregistrer la cible d'impression sur BLANK
      setPrintTarget('BLANK');

      // Déclencher l'impression navigateur
      setTimeout(() => {
        handlePrintCleanA4(`Fiche_Vierge_${data.sheetReference}_Betesda`);
      }, 250);
      setBlankModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur génération fiche vierge.');
    } finally {
      setLoading(false);
    }
  };

  // Ajout d'une ligne d'article dans la catégorie souhaitée
  const handleAddItemToCategory = (
    category: 'MEDICAMENT' | 'ACTE_INFIRMIER' | 'HEBERGEMENT' | 'AUTRE',
    presetItem?: { name: string; price: number; unit?: string; medicineId?: string }
  ) => {
    const newItem: DeliveryItemRow = {
      category,
      medicineId: presetItem?.medicineId || null,
      itemName: presetItem?.name || (category === 'MEDICAMENT' ? 'Médicament' : category === 'ACTE_INFIRMIER' ? 'Acte infirmier' : category === 'HEBERGEMENT' ? 'Hébergement' : 'Fourniture'),
      itemDate: sheetDate,
      unit: presetItem?.unit || (category === 'HEBERGEMENT' ? 'Jour' : category === 'ACTE_INFIRMIER' ? 'Acte' : 'Pièce'),
      quantity: 1,
      unitPrice: presetItem?.price || 0,
      totalPrice: presetItem?.price || 0,
    };
    setCurrentItems((prev) => [...prev, newItem]);
  };

  // Mise à jour d'une ligne d'article
  const handleUpdateItemRow = (
    index: number,
    field: keyof DeliveryItemRow,
    value: any
  ) => {
    setCurrentItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      if (field === 'quantity' || field === 'unitPrice') {
        const q = field === 'quantity' ? parseInt(value, 10) || 0 : target.quantity;
        const p = field === 'unitPrice' ? parseFloat(value) || 0 : target.unitPrice;
        target.totalPrice = q * p;
      }

      updated[index] = target;
      return updated;
    });
  };

  // Suppression d'une ligne d'article
  const handleRemoveItemRow = (index: number) => {
    setCurrentItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculs totaux par catégorie
  const subtotalsByCategory = useMemo(() => {
    const subs = {
      MEDICAMENT: 0,
      ACTE_INFIRMIER: 0,
      HEBERGEMENT: 0,
      AUTRE: 0,
    };
    currentItems.forEach((it) => {
      if (subs[it.category] !== undefined) {
        subs[it.category] += it.totalPrice;
      }
    });
    return subs;
  }, [currentItems]);

  const grandTotal = useMemo(() => {
    return currentItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
  }, [currentItems]);

  // Initialiser la saisie d'une nouvelle fiche (avec préfixe PF - )
  const handleStartNewEntry = (refToUse?: string) => {
    setEditingDeliveryId(null);
    const nextNum = deliveries.length + 1;
    setSheetReference(refToUse || `PF - ${String(nextNum).padStart(4, '0')}`);
    setPatientNameCustom('');
    setFileNumber('');
    setRoomNumber('');
    setSheetDate(new Date().toISOString().split('T')[0]);
    setRecipientName('Infirmière de garde');
    setRecipientPhone('');
    setReason('Hospitalisation & Soins infirmiers');
    setNotes('');
    setCurrentItems([]);
    setErrorMsg('');
    setSuccessMsg('');
    setActiveTab('entry');
  };

  // Charger une fiche existante pour modification
  const handleStartEditDelivery = (del: PastDelivery) => {
    setEditingDeliveryId(del.id);
    setSheetReference(del.sheetReference || del.deliveryNumber);
    setPatientNameCustom(del.patientName || (del.patient ? `${del.patient.firstName} ${del.patient.lastName}` : ''));
    setFileNumber(del.fileNumber || del.patient?.patientNumber || '');
    setRoomNumber(del.roomNumber || '');
    const dStr = del.date ? new Date(del.date).toISOString().split('T')[0] : new Date(del.createdAt).toISOString().split('T')[0];
    setSheetDate(dStr);
    setRecipientName(del.recipientName || 'Infirmière de garde');
    setRecipientPhone(del.recipientPhone || '');
    setReason(del.reason || 'Hospitalisation & Soins infirmiers');
    setNotes(del.notes || '');
    setPaymentMethod(del.paymentMethod || 'CASH');

    // Transformer les items existants
    const mappedItems: DeliveryItemRow[] = del.items.map((it) => ({
      id: it.id,
      category: (it.category as any) || (it.medicineId ? 'MEDICAMENT' : 'ACTE_INFIRMIER'),
      medicineId: it.medicineId,
      itemName: it.itemName,
      itemDate: it.itemDate ? new Date(it.itemDate).toISOString().split('T')[0] : dStr,
      unit: it.unit || 'Pièce',
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
    }));
    setCurrentItems(mappedItems);

    setErrorMsg('');
    setSuccessMsg('');
    setActiveTab('entry');
  };

  // Enregistrement de la fiche (création ou mise à jour avec choix du statut)
  const handleSaveDeliveryWithMode = async (
    e: React.FormEvent,
    targetPaymentStatus: 'PAID' | 'UNPAID' = 'PAID'
  ) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // S'assurer que la référence commence par PF -
    let finalRef = sheetReference.trim();
    if (!finalRef.toUpperCase().startsWith('PF -')) {
      finalRef = `PF - ${finalRef.replace(/^PF\s*-?\s*/i, '')}`;
    }

    if (currentItems.length === 0) {
      setErrorMsg('Veuillez ajouter au moins un produit, acte ou hébergement dans la fiche.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        sheetReference: finalRef,
        patientId: null,
        patientName: patientNameCustom.trim() || 'Client externe',
        fileNumber: fileNumber.trim() || null,
        roomNumber: roomNumber.trim() || null,
        date: sheetDate,
        recipientName: recipientName.trim() || 'Infirmière',
        recipientPhone: recipientPhone.trim() || null,
        reason: reason.trim(),
        notes: notes.trim() || null,
        paymentMethod,
        paymentStatus: targetPaymentStatus,
        status: targetPaymentStatus === 'PAID' ? 'COMPLETED' : 'VALIDATED',
        items: currentItems.map((it, idx) => ({
          category: it.category,
          medicineId: it.medicineId || null,
          itemName: it.itemName,
          itemDate: it.itemDate,
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          orderIndex: idx,
        })),
      };

      const isEdit = !!editingDeliveryId;
      const url = isEdit ? `/api/pharmacy/consumables/${editingDeliveryId}` : '/api/pharmacy/consumables';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l’enregistrement de la fiche.');
      }

      setSuccessMsg(
        targetPaymentStatus === 'PAID'
          ? `La fiche #${data.delivery.sheetReference || data.delivery.deliveryNumber} a été validée, encaissée et archivée. Facture globale prête.`
          : `La fiche #${data.delivery.sheetReference || data.delivery.deliveryNumber} a été validée (En attente d'encaissement).`
      );

      // Mettre à jour l'état local
      if (isEdit) {
        setDeliveries((prev) =>
          prev.map((d) => (d.id === data.delivery.id ? data.delivery : d))
        );
      } else {
        setDeliveries([data.delivery, ...deliveries]);
      }

      // Proposer immédiatement l'aperçu/impression A4 de la fiche
      setPrintTarget('DELIVERY');
      setPreviewDelivery(data.delivery);
      setActiveTab('list');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDelivery = (e: React.FormEvent) => handleSaveDeliveryWithMode(e, 'PAID');

  // Suppression d'une fiche
  const handleConfirmDeleteDelivery = async () => {
    if (!deleteConfirmDelivery) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pharmacy/consumables/${deleteConfirmDelivery.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression.');

      setDeliveries((prev) => prev.filter((d) => d.id !== deleteConfirmDelivery.id));
      setDeleteConfirmDelivery(null);
      setSuccessMsg('Fiche supprimée avec succès.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur de suppression.');
    } finally {
      setLoading(false);
    }
  };

  // Enregistrement d'un item de catalogue (CRUD)
  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogFormData.name.trim()) return;

    setLoading(true);
    try {
      const isEdit = !!editingCatalogItem;
      const url = isEdit
        ? `/api/pharmacy/consumables/catalog/${editingCatalogItem.id}`
        : '/api/pharmacy/consumables/catalog';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catalogFormData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l’enregistrement du catalogue.');

      if (isEdit) {
        setCatalogItems((prev) =>
          prev.map((it) => (it.id === data.item.id ? data.item : it))
        );
      } else {
        setCatalogItems([...catalogItems, data.item]);
      }

      setCatalogModalOpen(false);
      setEditingCatalogItem(null);
      setSuccessMsg('Élément de catalogue enregistré avec succès.');
    } catch (err: any) {
      alert(err.message || 'Erreur catalogue');
    } finally {
      setLoading(false);
    }
  };

  // Suppression d'un item de catalogue
  const handleConfirmDeleteCatalogItem = async () => {
    if (!deleteConfirmCatalog) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pharmacy/consumables/catalog/${deleteConfirmCatalog.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression.');

      setCatalogItems((prev) => prev.filter((it) => it.id !== deleteConfirmCatalog.id));
      setDeleteConfirmCatalog(null);
      setSuccessMsg('Élément supprimé du catalogue.');
    } catch (err: any) {
      alert(err.message || 'Erreur catalogue');
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les fiches historiques
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((del) => {
      const matchSearch =
        (del.sheetReference && del.sheetReference.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (del.deliveryNumber && del.deliveryNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (del.patientName && del.patientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (del.recipientName && del.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (del.roomNumber && del.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (del.fileNumber && del.fileNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchSearch;
    });
  }, [deliveries, searchTerm]);

  // Filtrer les items du catalogue
  const filteredCatalogItems = useMemo(() => {
    if (catalogFilterCategory === 'ALL') return catalogItems;
    return catalogItems.filter((it) => it.category === catalogFilterCategory);
  }, [catalogItems, catalogFilterCategory]);

  return (
    <div className="space-y-6">
      {/* Messages de feedback */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BARRE D'ONGLETS ET ACTIONS PRINCIPALES (Masquée à l'impression) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 sm:p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs no-print">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Fiches &amp; Historique ({deliveries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleStartNewEntry()}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'entry'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{editingDeliveryId ? '✏️ Modifier la Fiche' : '+ Saisie / Remplissage'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Catalogue des 4 Catégories</span>
          </button>
        </div>

        {/* Bouton d'impression de fiche vierge */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenBlankModal}
            className="w-full md:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <Printer className="w-4 h-4 text-amber-700" />
            <span>📄 Imprimer Fiche Vierge A4 (1 page)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : HISTORIQUE & LISTE DES FICHES DE CONSOMMABLES                    */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <div className="space-y-4 no-print">
          {/* Recherche & Filtres */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par référence (PF - ...), patient, chambre, N° dossier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {filteredDeliveries.length} fiche(s) enregistrée(s)
            </div>
          </div>

          {/* Table des fiches */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Réf. Fiche (PF - ...)</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Patient / Dossier</th>
                    <th className="py-3 px-4">Chambre</th>
                    <th className="py-3 px-4">Articles &amp; Actes</th>
                    <th className="py-3 px-4">Statut Règlement</th>
                    <th className="py-3 px-4 text-right">Total Général</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                        <p className="font-semibold">Aucune fiche de consommables trouvée</p>
                        <p className="text-[11px] mt-1">Imprimez une fiche vierge ou effectuez une recherche différente.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDeliveries.map((del) => {
                      const displayDate = del.date
                        ? formatDate(del.date)
                        : formatDate(del.createdAt);
                      const patientDisplay = del.patientName || (del.patient ? `${del.patient.firstName} ${del.patient.lastName}` : 'Client externe');

                      return (
                        <tr key={del.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                            {del.sheetReference || del.deliveryNumber}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {displayDate}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{patientDisplay}</div>
                            {del.fileNumber && (
                              <div className="text-[10px] text-slate-400">Dossier : {del.fileNumber}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {del.roomNumber ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                <Bed className="w-3 h-3 text-amber-600" />
                                {del.roomNumber}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {del.status === 'BLANK' ? (
                              <span className="text-slate-400 italic text-[11px]">En attente inscription manuelle</span>
                            ) : (
                              <>
                                <span className="font-semibold text-slate-700">
                                  {del.items.length} ligne(s)
                                </span>
                                <div className="text-[10px] text-slate-400 truncate max-w-xs">
                                  {del.items.map((i) => i.itemName).slice(0, 3).join(', ')}
                                  {del.items.length > 3 ? '...' : ''}
                                </div>
                              </>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {del.status === 'BLANK' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Vierge (À saisir)</span>
                              </span>
                            ) : del.paymentStatus === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Encaissé ({del.paymentMethod || 'Espèces'})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <Clock className="w-3 h-3 text-rose-600" />
                                <span>En attente règlement</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                            {del.status === 'BLANK' ? '—' : formatCurrency(del.totalAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Si fiche vierge : Bouton Saisir */}
                              {del.status === 'BLANK' && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditDelivery(del)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 flex items-center gap-1 shadow-2xs"
                                  title="Remplir la fiche selon les inscriptions manuscrites"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Saisir / Remplir</span>
                                </button>
                              )}

                              {/* Si fiche non payée : Bouton Encaisser */}
                              {del.paymentStatus !== 'PAID' && del.status !== 'BLANK' && (
                                <button
                                  type="button"
                                  onClick={() => setCashingModalDelivery(del)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs flex items-center gap-1"
                                  title="Encaisser la fiche et sortir la facture A4"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Encaisser</span>
                                </button>
                              )}

                              {/* Voir / Imprimer A4 */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPrintTarget('DELIVERY');
                                  setPreviewDelivery(del);
                                }}
                                title="Aperçu & Impression A4"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                              >
                                <Printer className="w-4 h-4 text-blue-600" />
                              </button>

                              {/* Modifier la fiche */}
                              {del.status !== 'BLANK' && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditDelivery(del)}
                                  title="Modifier la fiche"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}

                              {/* Supprimer la fiche */}
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmDelivery(del)}
                                title="Supprimer la fiche"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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

      {/* ========================================================================= */}
      {/* ONGLET 2 : SAISIE & MODIFICATION D'UNE FICHE DE CONSOMMABLES                */}
      {/* ========================================================================= */}
      {activeTab === 'entry' && (
        <form onSubmit={handleSaveDelivery} className="space-y-6 no-print">
          {/* Bannière Mode Modification si actif */}
          {editingDeliveryId && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-700" />
                <span className="font-bold">
                  Vous modifiez actuellement la fiche {sheetReference}. Toutes vos modifications seront enregistrées et répercutées sur la facture A4.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleStartNewEntry()}
                className="px-3 py-1 rounded-lg bg-white border border-amber-300 font-semibold text-amber-800 hover:bg-amber-100"
              >
                Annuler et créer une nouvelle fiche
              </button>
            </div>
          )}

          {/* Informations Générales de la Fiche */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>1. Informations d'Entête de la Fiche (Réf. PF - ...)</span>
              </h2>
              <span className="text-xs text-blue-700 font-mono font-bold">
                {sheetReference || 'PF - ....'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Référence Papier (PF - ...) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Référence Fiche Papier (PF - ...) *
                </label>
                <input
                  type="text"
                  required
                  value={sheetReference}
                  onChange={(e) => setSheetReference(e.target.value)}
                  placeholder="Ex: PF - 0001"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-blue-700 focus:outline-hidden focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Doit débuter par le préfixe <strong className="text-slate-600">PF - </strong>
                </span>
              </div>

              {/* Nom complet du patient libre */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nom complet du Patient / Client *
                </label>
                <input
                  type="text"
                  required
                  value={patientNameCustom}
                  onChange={(e) => setPatientNameCustom(e.target.value)}
                  placeholder="Ex: Rakoto Jean ou Ravelomanana Aina"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-white font-medium"
                />
              </div>

              {/* N° Dossier */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  N° Dossier Patient
                </label>
                <input
                  type="text"
                  value={fileNumber}
                  onChange={(e) => setFileNumber(e.target.value)}
                  placeholder="Ex: DOS-2026-0042"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* N° Chambre */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Bed className="w-3.5 h-3.5 text-amber-600" />
                  <span>N° Chambre / Lit</span>
                </label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Ex: Chambre 104 / Lit A"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Date de la Fiche / Soins
                </label>
                <input
                  type="date"
                  value={sheetDate}
                  onChange={(e) => setSheetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Infirmière / Bénéficiaire */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Infirmière / Soignant responsable
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ex: Infirmière Rova"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Mode de règlement */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mode de règlement
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="CASH">Espèces</option>
                  <option value="MVOLA">MVola</option>
                  <option value="ORANGE_MONEY">Orange Money</option>
                  <option value="AIRTEL_MONEY">Airtel Money</option>
                  <option value="CARD">Carte Bancaire / Chèque</option>
                </select>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SAISIE DES ARTICLES RÉPARTIS EN 4 CATÉGORIES                             */}
          {/* ========================================================================= */}
          <div className="space-y-6">
            {(
              [
                {
                  key: 'MEDICAMENT' as const,
                  title: '1. Médicaments (Pharmacie)',
                  icon: Pill,
                  color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
                  help: 'Sélectionnez depuis le stock de la pharmacie pour décompte automatique et tarification exacte.',
                },
                {
                  key: 'ACTE_INFIRMIER' as const,
                  title: '2. Actes Infirmiers',
                  icon: Stethoscope,
                  color: 'text-teal-600 bg-teal-50 border-teal-200',
                  help: 'Injections, pansements, perfusions, prélèvements sanguins...',
                },
                {
                  key: 'HEBERGEMENT' as const,
                  title: '3. Hébergement & Séjour',
                  icon: Bed,
                  color: 'text-amber-600 bg-amber-50 border-amber-200',
                  help: 'Chambres VIP, individuelles, lit d’observation, forfaits de surveillance...',
                },
                {
                  key: 'AUTRE' as const,
                  title: '4. Autres & Fournitures Diverses',
                  icon: Package,
                  color: 'text-purple-600 bg-purple-50 border-purple-200',
                  help: 'Oxygénothérapie, kits stériles, matériel jetable, frais de dossier...',
                },
              ] as const
            ).map((section) => {
              const Icon = section.icon;
              const sectionItems = currentItems.map((it, idx) => ({ ...it, originalIndex: idx })).filter((it) => it.category === section.key);
              const sectionSubtotal = subtotalsByCategory[section.key];

              // Éléments du catalogue correspondant pour ajout rapide
              const availableInCatalog = catalogItems.filter((c) => c.category === section.key);

              return (
                <div key={section.key} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  {/* Entête de catégorie */}
                  <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold border ${section.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{section.title}</h3>
                        <p className="text-[11px] text-slate-500">{section.help}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Sélecteur d'ajout rapide avec recherche intégrée en direct */}
                      {section.key === 'MEDICAMENT' ? (
                        <SearchableCategoryPicker
                          placeholder="🔍 Rechercher médicament (nom, DCI, forme)..."
                          items={allMedicines.map((m) => ({
                            id: m.id,
                            name: m.name,
                            subText: m.dosage ? `${m.dosage}${m.genericName ? ` • ${m.genericName}` : ''}` : m.genericName || undefined,
                            badge: m.packaging || m.form || 'Boîte',
                            price: m.sellingPrice,
                            unit: m.packaging || 'Boîte',
                            stock: m.currentStock,
                          }))}
                          onSelect={(item) => {
                            const med = allMedicines.find((m) => m.id === item.id);
                            handleAddItemToCategory('MEDICAMENT', {
                              name: `${item.name} ${med?.dosage || ''} (${med?.packaging || med?.form || ''})`.trim(),
                              price: item.price,
                              unit: item.unit || 'Pièce',
                              medicineId: item.id,
                            });
                          }}
                        />
                      ) : (
                        <SearchableCategoryPicker
                          placeholder={
                            section.key === 'ACTE_INFIRMIER'
                              ? '🔍 Rechercher acte infirmier (soin, pansement)...'
                              : section.key === 'HEBERGEMENT'
                              ? '🔍 Rechercher hébergement (chambre, séjour)...'
                              : '🔍 Rechercher fourniture diverse...'
                          }
                          items={availableInCatalog.map((c) => ({
                            id: c.id,
                            name: c.name,
                            subText: c.description || undefined,
                            badge: c.unit || (section.key === 'HEBERGEMENT' ? 'Jour' : 'Acte'),
                            price: c.price,
                            unit: c.unit || undefined,
                          }))}
                          onSelect={(item) => {
                            handleAddItemToCategory(section.key, {
                              name: item.name,
                              price: item.price,
                              unit: item.unit || undefined,
                            });
                          }}
                        />
                      )}

                      {/* Bouton ajouter ligne libre */}
                      <button
                        type="button"
                        onClick={() => handleAddItemToCategory(section.key)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ligne libre</span>
                      </button>

                      {/* Sous-total affiché */}
                      <div className="text-right pl-3 border-l border-slate-200">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Sous-total</span>
                        <span className="text-xs font-extrabold text-slate-900">{formatCurrency(sectionSubtotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tableau des lignes de cette catégorie */}
                  <div className="p-3">
                    {sectionItems.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs italic">
                        Aucune ligne saisie dans cette catégorie pour le moment.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
                              <th className="py-1.5 px-2 w-8 text-center">N°</th>
                              <th className="py-1.5 px-2 w-28">Date</th>
                              <th className="py-1.5 px-2">Désignation</th>
                              <th className="py-1.5 px-2 w-20">Unité</th>
                              <th className="py-1.5 px-2 w-20 text-center">Qté</th>
                              <th className="py-1.5 px-2 w-28 text-right">P.U (Ar)</th>
                              <th className="py-1.5 px-2 w-28 text-right">Montant Total</th>
                              <th className="py-1.5 px-2 w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sectionItems.map((item, localIdx) => (
                              <tr key={item.originalIndex} className="hover:bg-slate-50/50">
                                <td className="py-2 px-2 text-center font-bold text-slate-400">
                                  {localIdx + 1}
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="date"
                                    value={item.itemDate}
                                    onChange={(e) => handleUpdateItemRow(item.originalIndex, 'itemDate', e.target.value)}
                                    className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-white"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="text"
                                    value={item.itemName}
                                    onChange={(e) => handleUpdateItemRow(item.originalIndex, 'itemName', e.target.value)}
                                    placeholder="Désignation..."
                                    className="w-full px-2 py-1 text-xs rounded border border-slate-200 font-semibold text-slate-800"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="text"
                                    value={item.unit}
                                    onChange={(e) => handleUpdateItemRow(item.originalIndex, 'unit', e.target.value)}
                                    placeholder="Unité"
                                    className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-slate-600"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItemRow(item.originalIndex, 'quantity', e.target.value)}
                                    className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-center font-bold"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    step="100"
                                    min="0"
                                    value={item.unitPrice}
                                    onChange={(e) => handleUpdateItemRow(item.originalIndex, 'unitPrice', e.target.value)}
                                    className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-right font-mono"
                                  />
                                </td>
                                <td className="py-2 px-2 text-right font-extrabold text-slate-900 font-mono">
                                  {formatCurrency(item.totalPrice)}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItemRow(item.originalIndex)}
                                    className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
                                    title="Supprimer la ligne"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RÉCAPITULATIF FINANCIER & BOUTON D'ENREGISTREMENT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Médicaments</span>
                <span className="font-extrabold text-slate-800 text-sm">{formatCurrency(subtotalsByCategory.MEDICAMENT)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Actes Infirmiers</span>
                <span className="font-extrabold text-slate-800 text-sm">{formatCurrency(subtotalsByCategory.ACTE_INFIRMIER)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Hébergement</span>
                <span className="font-extrabold text-slate-800 text-sm">{formatCurrency(subtotalsByCategory.HEBERGEMENT)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Autres</span>
                <span className="font-extrabold text-slate-800 text-sm">{formatCurrency(subtotalsByCategory.AUTRE)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-right">
              <div>
                <span className="text-xs text-slate-400 uppercase font-bold block">Montant Total de la Fiche</span>
                <span className="text-2xl font-black text-blue-700 tracking-tight">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-3 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={(e) => handleSaveDeliveryWithMode(e, 'UNPAID')}
                  className="px-4 py-3 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Valider (En attente de paiement)</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={(e) => handleSaveDeliveryWithMode(e, 'PAID')}
                  className="px-6 py-3 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Valider &amp; Encaisser (Facture A4)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : GESTION DU CONTENU DES CATÉGORIES (CRUD)                        */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-4 no-print">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filtres par catégorie */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'ALL', label: 'Toutes les catégories' },
                { id: 'ACTE_INFIRMIER', label: 'Actes Infirmiers' },
                { id: 'HEBERGEMENT', label: 'Hébergement' },
                { id: 'AUTRE', label: 'Autres & Fournitures' },
                { id: 'MEDICAMENT', label: 'Médicaments (Pharmacie)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCatalogFilterCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    catalogFilterCategory === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Bouton Ajouter au catalogue */}
            <button
              type="button"
              onClick={() => {
                setEditingCatalogItem(null);
                setCatalogFormData({
                  category: catalogFilterCategory !== 'ALL' && catalogFilterCategory !== 'MEDICAMENT' ? catalogFilterCategory : 'ACTE_INFIRMIER',
                  name: '',
                  description: '',
                  unit: 'Acte',
                  price: 5000,
                });
                setCatalogModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Ajouter un élément au catalogue</span>
            </button>
          </div>

          {/* Si Médicaments sélectionné : afficher les médicaments officiels de la pharmacie */}
          {catalogFilterCategory === 'MEDICAMENT' ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-indigo-600" />
                    <span>Médicaments issus de la Pharmacie ({allMedicines.length})</span>
                  </h3>
                  <p className="text-[11px] text-indigo-700">
                    Ces médicaments sont automatiquement rattachés à la pharmacie avec suivi des stocks et prix de vente.
                  </p>
                </div>
                <Link
                  href="/pharmacy/medicines"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 shadow-xs"
                >
                  Gérer le Catalogue Pharmacie →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-4">Nom du Médicament</th>
                      <th className="py-2.5 px-4">Dosage / Forme</th>
                      <th className="py-2.5 px-4">Conditionnement</th>
                      <th className="py-2.5 px-4">Stock en Officine</th>
                      <th className="py-2.5 px-4 text-right">Prix Unitaire (P.U)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allMedicines.slice(0, 50).map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-bold text-slate-800">{m.name}</td>
                        <td className="py-2.5 px-4 text-slate-500">{m.dosage || '—'} • {m.form || '—'}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.packaging === 'Plaquette' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {m.packaging || 'Boîte'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.currentStock > 10 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {m.currentStock} {m.packaging === 'Plaquette' ? (m.currentStock > 1 ? 'plaquettes' : 'plaquette') : (m.currentStock > 1 ? 'boîtes' : 'boîte')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-extrabold text-slate-900 font-mono">
                          {formatCurrency(m.sellingPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Table des éléments du catalogue (Actes, Hébergement, Autre) */
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">Catégorie</th>
                      <th className="py-3 px-4">Désignation</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Unité</th>
                      <th className="py-3 px-4 text-right">Prix Unitaire (P.U)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCatalogItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Aucun élément dans cette catégorie du catalogue.
                        </td>
                      </tr>
                    ) : (
                      filteredCatalogItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              item.category === 'ACTE_INFIRMIER'
                                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                : item.category === 'HEBERGEMENT'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}>
                              {item.category === 'ACTE_INFIRMIER' ? 'Acte Infirmier' : item.category === 'HEBERGEMENT' ? 'Hébergement' : 'Autre'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {item.name}
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                            {item.description || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {item.unit || '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900 font-mono text-sm">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatalogItem(item);
                                  setCatalogFormData({
                                    category: item.category,
                                    name: item.name,
                                    description: item.description || '',
                                    unit: item.unit || 'Acte',
                                    price: item.price,
                                  });
                                  setCatalogModalOpen(true);
                                }}
                                title="Modifier"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeleteConfirmCatalog(item)}
                                title="Supprimer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
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
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE CRUD CATALOGUE (Ajout / Modification d'un acte / hébergement / autre) */}
      {/* ========================================================================= */}
      {catalogModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCatalogModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs no-print"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCatalogItem ? 'Modifier l’élément de catalogue' : 'Ajouter un élément au catalogue'}
              </h3>
              <button onClick={() => setCatalogModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catégorie *</label>
                <select
                  value={catalogFormData.category}
                  onChange={(e) => setCatalogFormData({ ...catalogFormData, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="ACTE_INFIRMIER">Acte Infirmier</option>
                  <option value="HEBERGEMENT">Hébergement</option>
                  <option value="AUTRE">Autre &amp; Fournitures</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Désignation / Nom *</label>
                <input
                  type="text"
                  required
                  value={catalogFormData.name}
                  onChange={(e) => setCatalogFormData({ ...catalogFormData, name: e.target.value })}
                  placeholder="Ex: Pansement spécial, Chambre VIP..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unité</label>
                  <input
                    type="text"
                    value={catalogFormData.unit}
                    onChange={(e) => setCatalogFormData({ ...catalogFormData, unit: e.target.value })}
                    placeholder="Ex: Acte, Jour, Séance..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prix Unitaire (Ar) *</label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    required
                    value={catalogFormData.price}
                    onChange={(e) => setCatalogFormData({ ...catalogFormData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description (Optionnelle)</label>
                <textarea
                  rows={2}
                  value={catalogFormData.description}
                  onChange={(e) => setCatalogFormData({ ...catalogFormData, description: e.target.value })}
                  placeholder="Précisions sur les soins ou les prestations..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCatalogModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE DE CONFIGURATION ET IMPRESSION FICHE VIERGE A4 (1 PAGE)             */}
      {/* ========================================================================= */}
      {blankModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setBlankModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 font-bold flex items-center justify-center border border-amber-200">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Configuration &amp; Impression Fiche Vierge A4 (1 page)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Générez une fiche vierge avec référence pour remplissage manuel par l'infirmière.
                  </p>
                </div>
              </div>
              <button onClick={() => setBlankModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Référence attribuée (PF - ...) */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="block font-bold text-slate-800 mb-1">
                  Référence imprimée sur la fiche papier (Préfixe : PF - ) *
                </label>
                <input
                  type="text"
                  value={blankReference}
                  onChange={(e) => setBlankReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-blue-700 bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  L'infirmière utilisera cette référence. L'administration la sélectionnera ensuite pour saisir les produits dans l'application.
                </span>
              </div>

              {/* Configuration du nombre de lignes par catégorie */}
              <div className="space-y-3 pt-2">
                <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  Nombre de lignes vierges par catégorie (Configurable) :
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Médicaments (12 lignes par défaut) */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-indigo-50/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-indigo-900 block">1. Médicaments</span>
                      <span className="text-[10px] text-slate-500">Défaut: 12 lignes (Calibré 1 page A4)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBlankLinesConfig((p) => ({ ...p, MEDICAMENT: Math.max(1, p.MEDICAMENT - 1) }))}
                        className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold font-mono text-sm">{blankLinesConfig.MEDICAMENT}</span>
                      <button
                        type="button"
                        onClick={() => setBlankLinesConfig((p) => ({ ...p, MEDICAMENT: p.MEDICAMENT + 1 }))}
                        className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Acte infirmier (4 lignes par défaut) */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-teal-50/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-teal-900 block">2. Acte Infirmier</span>
                      <span className="text-[10px] text-slate-500">Défaut: 4 lignes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBlankLinesConfig((p) => ({ ...p, ACTE_INFIRMIER: Math.max(1, p.ACTE_INFIRMIER - 1) }))}
                        className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold font-mono text-sm">{blankLinesConfig.ACTE_INFIRMIER}</span>
                      <button
                        type="button"
                        onClick={() => setBlankLinesConfig((p) => ({ ...p, ACTE_INFIRMIER: p.ACTE_INFIRMIER + 1 }))}
                        className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Hébergement (3 lignes par défaut) */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-amber-50/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-900 block">3. Hébergement</span>
                      <span className="text-[10px] text-slate-500">Défaut: 3 lignes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBlankLinesConfig((p) => ({ ...p, HEBERGEMENT: Math.max(1, p.HEBERGEMENT - 1) }))}
                        className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold font-mono text-sm">{blankLinesConfig.HEBERGEMENT}</span>
                      <button
                        type="button"
                        onClick={() => setBlankLinesConfig((p) => ({ ...p, HEBERGEMENT: p.HEBERGEMENT + 1 }))}
                        className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Autre (3 lignes par défaut) */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-purple-50/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-purple-900 block">4. Autre &amp; Fournitures</span>
                      <span className="text-[10px] text-slate-500">Défaut: 3 lignes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBlankLinesConfig((p) => ({ ...p, AUTRE: Math.max(1, p.AUTRE - 1) }))}
                        className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold font-mono text-sm">{blankLinesConfig.AUTRE}</span>
                      <button
                        type="button"
                        onClick={() => setBlankLinesConfig((p) => ({ ...p, AUTRE: p.AUTRE + 1 }))}
                        className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleStartNewEntry(blankReference)}
                className="text-xs text-blue-600 hover:underline font-bold"
              >
                + Ouvrir directement la saisie pour cette référence
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setBlankModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePrintBlankSheetAutoIncrement}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 text-xs flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  title="Enregistre la fiche dans l'historique avec numéro PF-XXXX auto-incrémenté et lance l'impression A4"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer A4 (Numérotation Auto &amp; Historique)</span>
                </button>
              </div>
            </div>

            {/* Note informative */}
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Numérotation automatique en continu :</strong> À chaque impression, une nouvelle référence (ex: <code>PF - 0001</code>) est automatiquement générée et archivée dans l'onglet <em>Fiches &amp; Historique</em> avec le statut <strong>Vierge (À saisir)</strong>. L'accueil pourra ensuite la retrouver directement par son numéro pour saisir les prestations manuelles.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE D'ENCAISSEMENT DIRECT (ACCUEIL)                                     */}
      {/* ========================================================================= */}
      {cashingModalDelivery && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCashingModalDelivery(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Encaissement de la Fiche
                  </h3>
                  <p className="text-[11px] font-mono text-blue-700 font-bold">
                    {cashingModalDelivery.sheetReference || cashingModalDelivery.deliveryNumber}
                  </p>
                </div>
              </div>
              <button onClick={() => setCashingModalDelivery(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Patient :</span>
                <span className="font-bold text-slate-800">
                  {cashingModalDelivery.patientName || (cashingModalDelivery.patient ? `${cashingModalDelivery.patient.firstName} ${cashingModalDelivery.patient.lastName}` : 'Client externe')}
                </span>
              </div>
              {cashingModalDelivery.roomNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Chambre / Lit :</span>
                  <span className="font-bold text-amber-700">{cashingModalDelivery.roomNumber}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-700">Total Net à Régler :</span>
                <span className="font-black text-emerald-700 font-mono text-base">
                  {formatCurrency(cashingModalDelivery.totalAmount)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-slate-700">Mode de Règlement *</label>
              <select
                value={cashingPaymentMethod}
                onChange={(e) => setCashingPaymentMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="CASH">Espèces</option>
                <option value="MVOLA">Mvola (Mobile Money)</option>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="AIRTEL_MONEY">Airtel Money</option>
                <option value="CREDIT_CARD">Carte Bancaire</option>
                <option value="CHECK">Chèque</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCashingModalDelivery(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`/api/pharmacy/consumables/${cashingModalDelivery.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'pay',
                        paymentMethod: cashingPaymentMethod,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’encaissement.');

                    setDeliveries((prev) =>
                      prev.map((d) => (d.id === data.delivery.id ? data.delivery : d))
                    );
                    setCashingModalDelivery(null);
                    setPreviewDelivery(data.delivery);
                    setSuccessMsg(`Fiche #${data.delivery.sheetReference || data.delivery.deliveryNumber} encaissée avec succès. Facture globale prête.`);
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Erreur lors de l’encaissement.');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Valider le Règlement &amp; Sortir Facture A4</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* APERÇU FICHE REMPLIE A4 (Modale d'affichage écran)                         */}
      {/* ========================================================================= */}
      {previewDelivery && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewDelivery(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print"
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {previewDelivery.paymentStatus === 'PAID' ? 'Facture Globale A4' : 'Décompte de Consommables & Actes'} #{previewDelivery.sheetReference || previewDelivery.deliveryNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Patient : {previewDelivery.patientName || 'Client externe'} • Chambre : {previewDelivery.roomNumber || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {previewDelivery.paymentStatus !== 'PAID' && previewDelivery.status !== 'BLANK' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCashingModalDelivery(previewDelivery);
                      setPreviewDelivery(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Encaisser cette fiche</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    handlePrintCleanA4(
                      `Facture_Globale_${previewDelivery.sheetReference || previewDelivery.deliveryNumber}_Betesda`
                    )
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer / Télécharger PDF A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDelivery(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Corps de l'aperçu écran */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">RÉF. FICHE</span>
                  <span className="font-mono font-bold text-blue-700">{previewDelivery.sheetReference || previewDelivery.deliveryNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">DATE</span>
                  <span className="font-semibold text-slate-800">{previewDelivery.date ? formatDate(previewDelivery.date) : formatDate(previewDelivery.createdAt)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">CHAMBRE</span>
                  <span className="font-semibold text-slate-800">{previewDelivery.roomNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">N° DOSSIER</span>
                  <span className="font-mono font-semibold text-slate-800">{previewDelivery.fileNumber || '—'}</span>
                </div>
              </div>

              {/* Tableau récapitulatif */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                      <th className="py-2 px-3">Catégorie</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Désignation</th>
                      <th className="py-2 px-3 text-center">Qté</th>
                      <th className="py-2 px-3 text-right">P.U</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewDelivery.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {it.category === 'MEDICAMENT' ? 'Médicament' : it.category === 'ACTE_INFIRMIER' ? 'Acte' : it.category === 'HEBERGEMENT' ? 'Hébergement' : 'Autre'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 text-[11px]">{it.itemDate ? formatDate(it.itemDate) : '—'}</td>
                        <td className="py-1.5 px-3 font-semibold text-slate-800">{it.itemName}</td>
                        <td className="py-1.5 px-3 text-center font-bold">{it.quantity}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(it.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                      <td colSpan={5} className="py-2.5 px-3 text-right uppercase text-xs">Total Général :</td>
                      <td className="py-2.5 px-3 text-right font-black text-blue-700 text-sm">{formatCurrency(previewDelivery.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  const del = previewDelivery;
                  setPreviewDelivery(null);
                  handleStartEditDelivery(del);
                }}
                className="text-xs text-amber-700 hover:underline font-bold flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Modifier cette fiche</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewDelivery(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE CONFIRMATION SUPPRESSION FICHE                                     */}
      {/* ========================================================================= */}
      {deleteConfirmDelivery && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) setDeleteConfirmDelivery(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs no-print"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Supprimer la fiche</h3>
                <p className="text-xs text-slate-500">Cette action est irréversible</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Êtes-vous sûr de vouloir supprimer la fiche #{deleteConfirmDelivery.sheetReference || deleteConfirmDelivery.deliveryNumber} ? Les stocks des médicaments éventuels seront automatiquement réintégrés.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setDeleteConfirmDelivery(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmDeleteDelivery}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {loading ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE CONFIRMATION SUPPRESSION CATALOGUE                                 */}
      {/* ========================================================================= */}
      {deleteConfirmCatalog && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) setDeleteConfirmCatalog(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs no-print"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Supprimer du catalogue</h3>
                <p className="text-xs text-slate-500">L'élément ne sera plus proposé</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Supprimer « <span className="font-bold">{deleteConfirmCatalog.name}</span> » du catalogue des {deleteConfirmCatalog.category} ?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setDeleteConfirmCatalog(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmDeleteCatalogItem}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {loading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZONE D'IMPRESSION A4 DESIGN MODERNE (@media print)                        */}
      {/* Lignes du tableau visibles et garanties, fond contrasté et pagination      */}
      {/* ========================================================================= */}
      <div className="print-only hidden">
        {printTarget === 'BLANK' ? (
          /* ======================================================== */
          /* CAS A : IMPRESSION FICHE VIERGE A4 MODERNE (1 PAGE)       */
          /* ======================================================== */
          <div className="a4-document a4-blank-sheet">
            {/* Entête Officielle Moderne */}
            <div className="doc-header">
              <div className="doc-clinic">
                <div className="clinic-badge">
                  <span className="plus-sign">+</span>
                  <span className="clinic-title">{clinicInfo.name}</span>
                </div>
                <div className="clinic-sub">Établissement Hospitalier &amp; Médical</div>
                <div className="clinic-contacts">
                  Email : <strong>{clinicInfo.email}</strong> • Tél : <strong>{clinicInfo.phone}</strong>
                </div>
                <div className="clinic-fiscal">{clinicInfo.taxId}</div>
              </div>

              <div className="doc-ref-box">
                <span className="ref-label">RÉFÉRENCE FICHE</span>
                <span className="ref-val">{blankReference}</span>
                <span className="ref-date">Émise le : {formatDate(new Date())}</span>
              </div>
            </div>

            {/* Titre du document avec bandeau moderne */}
            <div className="doc-title-bar">
              FICHE DE CONSOMMABLES, ACTES &amp; HÉBERGEMENT
            </div>

            {/* Cadre Patient & Séjour moderne */}
            <div className="patient-box">
              <div className="p-field">
                <span className="p-label">Patient / Client :</span>
                <span className="p-line" style={{ width: '220px' }}></span>
              </div>
              <div className="p-field">
                <span className="p-label">N° Dossier :</span>
                <span className="p-line" style={{ width: '130px' }}></span>
              </div>
              <div className="p-field">
                <span className="p-label">N° Chambre / Lit :</span>
                <span className="p-line" style={{ width: '130px' }}></span>
              </div>
              <div className="p-field">
                <span className="p-label">Date d'admission :</span>
                <span className="p-line" style={{ width: '140px' }}></span>
              </div>
              <div className="p-field col-full">
                <span className="p-label">Infirmière / Soignant responsable :</span>
                <span className="p-line" style={{ width: '310px' }}></span>
              </div>
            </div>

            {/* TABLEAU DES 4 CATÉGORIES AVEC LIGNES VISIBLES (7 COLONNES EXACTEMENT COMME LA FACTURE) */}
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: '22px', textAlign: 'center' }}>N°</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Date</th>
                  <th>Désignation</th>
                  <th style={{ width: '45px', textAlign: 'center' }}>Unité</th>
                  <th style={{ width: '32px', textAlign: 'center' }}>Qté</th>
                  <th style={{ width: '70px', textAlign: 'right' }}>P.U (Ar)</th>
                  <th style={{ width: '75px', textAlign: 'right' }}>Total (Ar)</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. MÉDICAMENTS (Pharmacie) */}
                <tr className="cat-hdr cat-med">
                  <td colSpan={7}>I. MÉDICAMENTS (Pharmacie)</td>
                </tr>
                {Array.from({ length: blankLinesConfig.MEDICAMENT }).map((_, idx) => (
                  <tr key={`b-med-${idx}`} className="row-blank">
                    <td className="cell-num">{idx + 1}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}

                {/* 2. ACTES INFIRMIERS */}
                <tr className="cat-hdr cat-act">
                  <td colSpan={7}>II. ACTES INFIRMIERS &amp; SOINS</td>
                </tr>
                {Array.from({ length: blankLinesConfig.ACTE_INFIRMIER }).map((_, idx) => (
                  <tr key={`b-act-${idx}`} className="row-blank">
                    <td className="cell-num">{idx + 1}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}

                {/* 3. HÉBERGEMENT */}
                <tr className="cat-hdr cat-heb">
                  <td colSpan={7}>III. HÉBERGEMENT &amp; SÉJOUR</td>
                </tr>
                {Array.from({ length: blankLinesConfig.HEBERGEMENT }).map((_, idx) => (
                  <tr key={`b-heb-${idx}`} className="row-blank">
                    <td className="cell-num">{idx + 1}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}

                {/* 4. AUTRE */}
                <tr className="cat-hdr cat-aut">
                  <td colSpan={7}>IV. AUTRES FOURNITURES &amp; SERVICES</td>
                </tr>
                {Array.from({ length: blankLinesConfig.AUTRE }).map((_, idx) => (
                  <tr key={`b-aut-${idx}`} className="row-blank">
                    <td className="cell-num">{idx + 1}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Général */}
            <div className="total-bar">
              <div>
                <span className="total-label">TOTAL GÉNÉRAL À RÉGLER (Ar) :</span>
                <span className="p-line" style={{ width: '180px', marginLeft: '6px' }}></span>
              </div>
              <div className="total-note">
                Document manuscrit officiel — À remettre à l'accueil pour encaissement.
              </div>
            </div>

            {/* 3 Blocs de Signature */}
            <div className="signatures-grid">
              <div className="sig-box">
                <span className="sig-title">Le Patient / La Famille</span>
                <span className="sig-hint">Signature &amp; Date</span>
              </div>
              <div className="sig-box">
                <span className="sig-title">Le Responsable Soins / Pharmacie</span>
                <span className="sig-hint">Signature &amp; Date</span>
              </div>
              <div className="sig-box">
                <span className="sig-title">La Caisse / Accueil (ou Direction)</span>
                <span className="sig-hint">Visa &amp; Cachet</span>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* CAS B : IMPRESSION FICHE REMPLIE A4 MODERNE              */
          /* ======================================================== */
          previewDelivery && (
            <div className="a4-document">
              {/* Entête Officielle Moderne */}
              <div className="doc-header">
                <div className="doc-clinic">
                  <div className="clinic-badge">
                    <span className="plus-sign">+</span>
                    <span className="clinic-title">{clinicInfo.name}</span>
                  </div>
                  <div className="clinic-sub">Établissement Hospitalier &amp; Médical</div>
                  <div className="clinic-contacts">
                    Email : <strong>{clinicInfo.email}</strong> • Tél : <strong>{clinicInfo.phone}</strong>
                  </div>
                  <div className="clinic-fiscal">{clinicInfo.taxId}</div>
                </div>

                <div className="doc-ref-box">
                  <span className="ref-label">RÉFÉRENCE FICHE</span>
                  <span className="ref-val">{previewDelivery.sheetReference || previewDelivery.deliveryNumber}</span>
                  <span className="ref-date">
                    Date : {previewDelivery.date ? formatDate(previewDelivery.date) : formatDate(previewDelivery.createdAt)}
                  </span>
                </div>
              </div>

              {/* Titre */}
              <div className="doc-title-bar">
                {previewDelivery.paymentStatus === 'PAID'
                  ? 'FACTURE GLOBALE DÉFINITIVE — CONSOMMABLES, ACTES & HÉBERGEMENT'
                  : 'DÉCOMPTE DES CONSOMMABLES, ACTES & HÉBERGEMENT'}
              </div>

              {/* Patient Card */}
              <div className="patient-box">
                <div className="p-field">
                  <span className="p-label">Patient / Client :</span>
                  <strong style={{ fontSize: '9.5pt', color: '#0f172a' }}>
                    {previewDelivery.patientName || (previewDelivery.patient ? `${previewDelivery.patient.firstName} ${previewDelivery.patient.lastName}` : 'Client externe')}
                  </strong>
                </div>
                <div className="p-field">
                  <span className="p-label">N° Dossier :</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {previewDelivery.fileNumber || previewDelivery.patient?.patientNumber || '—'}
                  </span>
                </div>
                <div className="p-field">
                  <span className="p-label">N° Chambre / Lit :</span>
                  <strong style={{ color: '#b45309' }}>{previewDelivery.roomNumber || '—'}</strong>
                </div>
                <div className="p-field">
                  <span className="p-label">Soignant / Responsable :</span>
                  <span>{previewDelivery.recipientName}</span>
                </div>
              </div>

              {/* Badge d'encaissement et acquittement */}
              {previewDelivery.paymentStatus === 'PAID' && (
                <div
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #10b981',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '8.5pt',
                    fontWeight: 'bold',
                    color: '#065f46',
                    marginBottom: '6px',
                  }}
                >
                  <span>✓ STATUT : FACTURE GLOBALE ENCAISSÉE &amp; ACQUITTÉE</span>
                  <span>MODE DE RÈGLEMENT : {previewDelivery.paymentMethod || 'ESPÈCES'}</span>
                </div>
              )}

              {/* Tableau rempli avec lignes visibles */}
              <table className="print-table">
                <thead>
                  <tr>
                    <th style={{ width: '22px', textAlign: 'center' }}>N°</th>
                    <th style={{ width: '60px' }}>Date</th>
                    <th>Désignation</th>
                    <th style={{ width: '45px' }}>Unité</th>
                    <th style={{ width: '32px', textAlign: 'center' }}>Qté</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>P.U (Ar)</th>
                    <th style={{ width: '75px', textAlign: 'right' }}>Total (Ar)</th>
                  </tr>
                </thead>
                <tbody>
                  {(['MEDICAMENT', 'ACTE_INFIRMIER', 'HEBERGEMENT', 'AUTRE'] as const).map((catKey) => {
                    const catItems = previewDelivery.items.filter((it) => it.category === catKey);
                    if (catItems.length === 0) return null;

                    const catTitle =
                      catKey === 'MEDICAMENT'
                        ? 'I. MÉDICAMENTS (Pharmacie)'
                        : catKey === 'ACTE_INFIRMIER'
                        ? 'II. ACTES INFIRMIERS & SOINS'
                        : catKey === 'HEBERGEMENT'
                        ? 'III. HÉBERGEMENT & SÉJOUR'
                        : 'IV. AUTRES FOURNITURES & SERVICES';

                    const catClass =
                      catKey === 'MEDICAMENT'
                        ? 'cat-med'
                        : catKey === 'ACTE_INFIRMIER'
                        ? 'cat-act'
                        : catKey === 'HEBERGEMENT'
                        ? 'cat-heb'
                        : 'cat-aut';

                    const catSubtotal = catItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);

                    return (
                      <React.Fragment key={catKey}>
                        <tr className={`cat-hdr ${catClass}`}>
                          <td colSpan={6}>{catTitle}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {formatCurrency(catSubtotal)}
                          </td>
                        </tr>
                        {catItems.map((it, idx) => (
                          <tr key={idx} className="row-filled">
                            <td className="cell-num">{idx + 1}</td>
                            <td style={{ fontSize: '7.5pt', color: '#475569' }}>
                              {it.itemDate ? formatDate(it.itemDate) : '—'}
                            </td>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{it.itemName}</td>
                            <td style={{ color: '#475569' }}>{it.unit || 'Pièce'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{it.quantity}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(it.unitPrice)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>
                              {formatCurrency(it.totalPrice)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="tfoot-total">
                    <td colSpan={6} style={{ textAlign: 'right', textTransform: 'uppercase', fontSize: '9pt', fontWeight: 900 }}>
                      TOTAL GÉNÉRAL À RÉGLER :
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '10.5pt', fontWeight: 900, color: '#0f172a' }}>
                      {formatCurrency(previewDelivery.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures */}
              <div className="signatures-grid">
                <div className="sig-box">
                  <span className="sig-title">L'Infirmière / Soignant</span>
                  <span className="sig-hint">Signature &amp; Date</span>
                </div>
                <div className="sig-box">
                  <span className="sig-title">Le Bénéficiaire / Patient</span>
                  <span className="sig-hint">Signature</span>
                </div>
                <div className="sig-box">
                  <span className="sig-title">L'Administration / Caisse</span>
                  <span className="sig-hint">Visa &amp; Cachet</span>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* ========================================================================= */}
      {/* FEUILLE DE STYLE IMPRESSION A4 MODERNE COMPLÈTE                           */}
      {/* ========================================================================= */}
      <style jsx global>{`
        @media print {
          /* 1. Masquage complet de tous les éléments d'interface */
          body * {
            visibility: hidden;
          }
          .no-print,
          aside,
          header,
          nav,
          button,
          input,
          select {
            display: none !important;
          }

          /* 2. Affichage strict et précis du conteneur d'impression A4 */
          .print-only,
          .print-only * {
            visibility: visible;
          }
          .print-only {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 3. Définition du format de page A4 et marges sans en-têtes d'URL */
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          /* 4. Typographie et structure du document A4 */
          .a4-document {
            width: 100%;
            max-width: 198mm;
            margin: 0 auto;
            padding: 3mm 6mm;
            box-sizing: border-box;
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 7.5pt;
            line-height: 1.15;
            page-break-inside: auto;
          }

          /* Contrainte stricte 1 seule page pour la fiche vierge A4 */
          .a4-document.a4-blank-sheet {
            height: 288mm !important;
            max-height: 288mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Entête Officielle */
          .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 3px;
            margin-bottom: 3px;
          }
          .doc-clinic {
            flex: 1;
          }
          .clinic-badge {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .plus-sign {
            display: inline-block;
            background: #0d9488;
            color: white;
            font-weight: 900;
            font-size: 10pt;
            width: 15px;
            height: 15px;
            text-align: center;
            line-height: 13px;
            border-radius: 3px;
          }
          .clinic-title {
            font-size: 12pt;
            font-weight: 900;
            letter-spacing: -0.2px;
            color: #0f172a;
            text-transform: uppercase;
          }
          .clinic-sub {
            font-size: 6.5pt;
            color: #0d9488;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .clinic-contacts {
            font-size: 6.5pt;
            color: #334155;
            margin-top: 1px;
          }
          .clinic-fiscal {
            font-size: 6.2pt;
            color: #64748b;
          }

          /* Boîte de Référence PF - ... */
          .doc-ref-box {
            text-align: right;
            border: 1.5px solid #0f172a;
            background: #f8fafc !important;
            padding: 2px 6px;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
          }
          .ref-label {
            font-size: 6pt;
            font-weight: 800;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .ref-val {
            font-size: 10pt;
            font-weight: 900;
            font-family: monospace;
            color: #1e3a8a;
            letter-spacing: 0.5px;
          }
          .ref-date {
            font-size: 6.5pt;
            color: #64748b;
          }

          /* Titre document */
          .doc-title-bar {
            text-align: center;
            background: #0f172a !important;
            color: #ffffff !important;
            font-weight: 900;
            font-size: 8pt;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding: 2.5px 5px;
            border-radius: 3px;
            margin-bottom: 3px;
          }

          /* Fiche Patient */
          .patient-box {
            border: 1px solid #94a3b8;
            background: #f8fafc !important;
            border-radius: 4px;
            padding: 2.5px 5px;
            margin-bottom: 3px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            row-gap: 2px;
            column-gap: 8px;
            font-size: 7pt;
          }
          .p-field {
            display: flex;
            align-items: center;
          }
          .p-field.col-full {
            grid-column: span 2;
          }
          .p-label {
            font-weight: bold;
            color: #334155;
            margin-right: 4px;
          }
          .p-line {
            display: inline-block;
            border-bottom: 1px dotted #475569;
            height: 10px;
          }

          /* TABLEAU AVEC LIGNES VISIBLES SUR TOUTES LES CELLULES */
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1.5px solid #1e293b !important;
            font-size: 6.8pt !important;
            page-break-inside: auto;
          }
          .print-table th {
            border: 1px solid #475569 !important;
            background: #e2e8f0 !important;
            color: #0f172a !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            padding: 1.5px 2px !important;
            font-size: 6.2pt !important;
          }
          .print-table td {
            border: 1px solid #64748b !important;
            padding: 1px 2px !important;
          }
          .row-blank {
            height: 11px !important;
            max-height: 11px !important;
          }
          .row-blank td {
            padding: 0.5px 2px !important;
            line-height: 11px !important;
          }
          .row-filled td {
            padding: 2px 3px !important;
          }
          .cell-num {
            text-align: center;
            font-weight: 700;
            color: #64748b;
          }

          /* Bandeaux de Catégories Colorés et Contrastés */
          .cat-hdr {
            font-weight: 900 !important;
            font-size: 6.8pt !important;
            text-transform: uppercase !important;
            letter-spacing: 0.3px;
            page-break-after: avoid;
          }
          .cat-med td {
            background: #e0e7ff !important;
            color: #1e1b4b !important;
            border-top: 1.5px solid #1e293b !important;
            border-bottom: 1.5px solid #1e293b !important;
          }
          .cat-act td {
            background: #ccfbf1 !important;
            color: #115e59 !important;
            border-top: 1.5px solid #1e293b !important;
            border-bottom: 1.5px solid #1e293b !important;
          }
          .cat-heb td {
            background: #fef3c7 !important;
            color: #78350f !important;
            border-top: 1.5px solid #1e293b !important;
            border-bottom: 1.5px solid #1e293b !important;
          }
          .cat-aut td {
            background: #f3e8ff !important;
            color: #581c87 !important;
            border-top: 1.5px solid #1e293b !important;
            border-bottom: 1.5px solid #1e293b !important;
          }

          /* Total Footer */
          .tfoot-total td {
            background: #f1f5f9 !important;
            border-top: 2px solid #0f172a !important;
            padding: 2.5px 3px !important;
          }
          .total-bar {
            margin-top: 3px;
            border: 1px solid #475569;
            background: #f8fafc !important;
            border-radius: 4px;
            padding: 2.5px 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            page-break-inside: avoid;
          }
          .total-label {
            font-weight: 900;
            font-size: 7.5pt;
            color: #0f172a;
          }
          .total-note {
            font-size: 6pt;
            color: #64748b;
            font-style: italic;
          }

          /* Grille de 3 Signatures */
          .signatures-grid {
            margin-top: 4px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 5px;
            page-break-inside: avoid;
          }
          .sig-box {
            border: 1px solid #64748b;
            border-radius: 4px;
            padding: 2px 3px;
            height: 38px !important;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
            background: #ffffff !important;
          }
          .sig-title {
            font-size: 7pt;
            font-weight: 800;
            color: #1e293b;
          }
          .sig-hint {
            font-size: 5.8pt;
            color: #94a3b8;
            font-style: italic;
          }
        }
      `}</style>
    </div>
  );
}
