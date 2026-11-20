'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Printer,
  Receipt,
  DollarSign,
  Smartphone,
  CreditCard,
  Building,
  Loader2,
  History,
  Eye,
  Send,
  PackageCheck,
  Edit3,
  X,
  Clock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import ThermalReceiptPreview from '@/components/pharmacy/ThermalReceiptPreview';
import { ThermalReceiptData, printThermalReceipt } from '@/lib/thermalReceipt';
import MedicineSearchSelect from '@/components/pharmacy/MedicineSearchSelect';

interface POSClientProps {
  clinic: any;
  currentUser: any;
  medicines: any[];
  patients: any[];
  employees?: any[];
  initialSales: any[];
}

export default function POSClient({
  clinic,
  currentUser,
  medicines: initialMedicines,
  patients,
  employees = [],
  initialSales,
}: POSClientProps) {
  const isPharmacist = currentUser.role === 'PHARMACIST';
  const isReceptionist = currentUser.role === 'RECEPTIONIST';
  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'CLINIC_ADMIN';

  const [medicines, setMedicines] = useState(initialMedicines);
  const [sales, setSales] = useState(initialSales);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Mode Personnel Clinique (Achat au prix d'achat)
  const [isStaffMode, setIsStaffMode] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Mode Don / Prise en charge 100% clinique (Médicament Gratuit 0 Ar)
  const [isFreeDonation, setIsFreeDonation] = useState(false);

  // Filter tabs for orders list
  const [orderFilter, setOrderFilter] = useState<'PENDING_PAYMENT' | 'PAID' | 'DELIVERED' | 'ALL'>(
    isReceptionist ? 'PENDING_PAYMENT' : 'PENDING_PAYMENT'
  );

  // Cart State (Creating new sale / demand)
  const [cart, setCart] = useState<Array<{
    medicineId: string;
    name: string;
    dosage: string;
    form: string;
    unitPrice: number;
    quantity: number;
    availableStock: number;
  }>>([]);

  // Customer State (Saisie libre du nom complet)
  const [customerName, setCustomerName] = useState('Client de passage');
  const [customerPhone, setCustomerPhone] = useState('');

  // Payment State (Direct Sale at Reception)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MOBILE_MONEY' | 'CREDIT_CARD' | 'BANK_TRANSFER'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [discount, setDiscount] = useState('0');
  const [cashTendered, setCashTendered] = useState('');

  // Status & Notification State
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [completedSaleReceipt, setCompletedSaleReceipt] = useState<ThermalReceiptData | null>(null);
  const [isNewSale, setIsNewSale] = useState(false);

  // =========================================================================
  // RECEPTIONIST EDIT & CASH-IN MODAL STATE
  // =========================================================================
  const [editingSale, setEditingSale] = useState<any | null>(null);
  const [editCart, setEditCart] = useState<Array<{
    medicineId: string;
    medicineName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    availableStock?: number;
  }>>([]);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editDiscount, setEditDiscount] = useState('0');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'CASH' | 'MOBILE_MONEY' | 'CREDIT_CARD' | 'BANK_TRANSFER'>('CASH');
  const [editPaymentReference, setEditPaymentReference] = useState('');
  const [editCashTendered, setEditCashTendered] = useState('');
  const [editAddMedId, setEditAddMedId] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    initialMedicines.forEach((m) => {
      if (m.category?.name) set.add(m.category.name);
    });
    return Array.from(set);
  }, [initialMedicines]);

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      const matchQuery =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.genericName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || m.category?.name === selectedCategory;
      return matchQuery && matchCat;
    });
  }, [medicines, searchQuery, selectedCategory]);

  // Cart Calculations (Création)
  const subtotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + (it.unitPrice * (Number(it.quantity) || 0)), 0);
  }, [cart]);

  const totalAmount = useMemo(() => {
    if (isFreeDonation) return 0;
    const disc = parseFloat(discount || '0');
    return Math.max(0, subtotal - disc);
  }, [isFreeDonation, subtotal, discount]);

  // Validation stricte du stock du panier
  const cartStockError = useMemo(() => {
    for (const item of cart) {
      const qty = Number(item.quantity);
      if (!qty || isNaN(qty) || qty <= 0) {
        return `Veuillez saisir une quantité valide (> 0) pour "${item.name}".`;
      }
      if (qty > item.availableStock) {
        return `Stock insuffisant : "${item.name}" demandé en ${qty} unités, mais il ne reste que ${item.availableStock} unités en stock.`;
      }
    }
    return null;
  }, [cart]);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered || '0');
    if (tendered > totalAmount) {
      return tendered - totalAmount;
    }
    return 0;
  }, [cashTendered, totalAmount]);

  // Edit Modal Calculations
  const editSubtotal = useMemo(() => {
    return editCart.reduce((acc, it) => acc + (it.unitPrice * (Number(it.quantity) || 0)), 0);
  }, [editCart]);

  const editTotal = useMemo(() => {
    const disc = parseFloat(editDiscount || '0');
    return Math.max(0, editSubtotal - disc);
  }, [editSubtotal, editDiscount]);

  // Validation stricte du stock pour la modification de commande
  const editStockError = useMemo(() => {
    for (const item of editCart) {
      const qty = Number(item.quantity);
      if (!qty || isNaN(qty) || qty <= 0) {
        return `Veuillez saisir une quantité valide (> 0) pour "${item.medicineName}".`;
      }
      const med = medicines.find((m) => m.id === item.medicineId);
      const stock = item.availableStock ?? (med ? med.currentStock : 999);
      if (qty > stock) {
        return `Stock insuffisant : "${item.medicineName}" demandé en ${qty} unités, mais il ne reste que ${stock} unités en stock.`;
      }
    }
    return null;
  }, [editCart, medicines]);

  const editChangeDue = useMemo(() => {
    const tendered = parseFloat(editCashTendered || '0');
    if (tendered > editTotal) {
      return tendered - editTotal;
    }
    return 0;
  }, [editCashTendered, editTotal]);

  // Counts of orders by status
  const pendingCount = useMemo(() => sales.filter((s) => s.status === 'PENDING_PAYMENT').length, [sales]);
  const paidCount = useMemo(() => sales.filter((s) => s.status === 'PAID').length, [sales]);
  const deliveredCount = useMemo(() => sales.filter((s) => s.status === 'DELIVERED' || s.status === 'COMPLETED').length, [sales]);

  // Filtered sales for table
  const displayedSales = useMemo(() => {
    let list = sales;
    if (orderFilter !== 'ALL') {
      if (orderFilter === 'DELIVERED') {
        list = list.filter((s) => s.status === 'DELIVERED' || s.status === 'COMPLETED');
      } else {
        list = list.filter((s) => s.status === orderFilter);
      }
    }
    const q = orderSearchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter((s) =>
      (s.saleNumber || '').toLowerCase().includes(q) ||
      (s.customerName || '').toLowerCase().includes(q) ||
      (s.customerPhone || '').includes(q)
    );
  }, [sales, orderFilter, orderSearchQuery]);

  // Basculer mode personnel clinique
  const handleToggleStaffMode = (enabled: boolean) => {
    setIsStaffMode(enabled);
    if (!enabled) {
      setSelectedEmployeeId('');
      setCustomerName('Client de passage');
      setCart((prev) =>
        prev.map((it) => {
          const med = medicines.find((m) => m.id === it.medicineId);
          return {
            ...it,
            unitPrice: med?.sellingPrice || it.unitPrice,
          };
        })
      );
    }
  };

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setCustomerName(`[PERSONNEL] ${emp.lastName} ${emp.firstName} (${emp.position})`);
      if (emp.phone) setCustomerPhone(emp.phone);
      setCart((prev) =>
        prev.map((it) => {
          const med = medicines.find((m) => m.id === it.medicineId);
          const price = med?.purchasePrice && med.purchasePrice > 0 ? med.purchasePrice : med?.sellingPrice || it.unitPrice;
          return {
            ...it,
            unitPrice: price,
          };
        })
      );
    }
  };

  // Add to Cart with Stock Verification (en unités)
  const addToCart = (med: any) => {
    setError('');
    if (med.currentStock <= 0) {
      setError(`Le médicament "${med.name}" est en rupture de stock.`);
      return;
    }

    const effectiveUnitPrice = (isStaffMode && med.purchasePrice && med.purchasePrice > 0)
      ? med.purchasePrice
      : med.sellingPrice;

    const existingIndex = cart.findIndex((i) => i.medicineId === med.id);
    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      if (existing.quantity + 1 > med.currentStock) {
        setError(`Quantité maximale disponible en unités atteinte pour "${med.name}" (${med.currentStock} unités).`);
        return;
      }
      setCart((prev) => {
        const copy = [...prev];
        copy[existingIndex].quantity += 1;
        copy[existingIndex].unitPrice = effectiveUnitPrice;
        return copy;
      });
    } else {
      setCart((prev) => [
        ...prev,
        {
          medicineId: med.id,
          name: med.name,
          dosage: med.dosage,
          form: med.form,
          unitPrice: effectiveUnitPrice,
          quantity: 1,
          availableStock: med.currentStock,
        },
      ]);
    }
  };

  const handleSetCartQuantity = (medicineId: string, val: string) => {
    setError('');
    if (val === '') {
      setCart((prev) =>
        prev.map((i) => (i.medicineId === medicineId ? { ...i, quantity: 0 } : i))
      );
      return;
    }

    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return;

    setCart((prev) =>
      prev.map((i) =>
        i.medicineId === medicineId ? { ...i, quantity: Math.max(0, parsed) } : i
      )
    );
  };

  const removeFromCart = (medicineId: string) => {
    setCart((prev) => prev.filter((i) => i.medicineId !== medicineId));
  };

  // =========================================================================
  // ENVOI DE LA DEMANDE À L'ACCUEIL (RÔLE PHARMACIE)
  // =========================================================================
  const handleSendToReception = async () => {
    if (!cart.length) {
      setError('Le panier est vide. Veuillez sélectionner au moins un médicament.');
      return;
    }

    if (cartStockError) {
      setError(cartStockError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        action: 'SEND_TO_RECEPTION',
        status: 'PENDING_PAYMENT',
        customerName: customerName || 'Client de passage',
        customerPhone: customerPhone || null,
        patientId: null,
        employeeId: isStaffMode && selectedEmployeeId ? selectedEmployeeId : null,
        isFreeGift: isFreeDonation,
        items: cart,
        discount: 0,
        paymentMethod: 'CASH',
      };

      const res = await fetch('/api/pharmacy/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la transmission à l’accueil');
      }

      setSales([data.sale, ...sales]);
      setCart([]);
      setCustomerName('Client de passage');
      setCustomerPhone('');
      setLoading(false);
      setSuccessMsg(
        `✓ Demande N° ${data.sale.saleNumber} transmise à l'accueil avec succès ! Le client peut se rendre à la caisse pour payer.`
      );
      setOrderFilter('PENDING_PAYMENT');
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setError(err.message || 'Erreur réseau');
      setLoading(false);
    }
  };

  // =========================================================================
  // VENTE DIRECTE ACCUEIL / ADMIN (ENCAISSEMENT IMMÉDIAT)
  // =========================================================================
  const handleDirectCheckout = async () => {
    if (!cart.length) {
      setError('Le panier est vide.');
      return;
    }

    if (cartStockError) {
      setError(cartStockError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/pharmacy/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || 'Client de passage',
          customerPhone: customerPhone || null,
          patientId: null,
          employeeId: isStaffMode && selectedEmployeeId ? selectedEmployeeId : null,
          isFreeGift: isFreeDonation,
          items: cart,
          paymentMethod,
          paymentReference: paymentMethod !== 'CASH' ? paymentReference : undefined,
          discount: isFreeDonation ? '0' : discount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la vente');
      }

      // Déduire localement le stock
      setMedicines((prev) =>
        prev.map((m) => {
          const cartItem = cart.find((ci) => ci.medicineId === m.id);
          if (cartItem) {
            return { ...m, currentStock: m.currentStock - cartItem.quantity };
          }
          return m;
        })
      );

      setSales([data.sale, ...sales]);
      setCart([]);
      setCashTendered('');
      setDiscount('0');
      setPaymentReference('');
      setLoading(false);

      // Ouvrir le ticket
      openReceiptModal(data.sale, true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la validation');
      setLoading(false);
    }
  };

  // =========================================================================
  // OUVERTURE DE LA MODAL DE MODIFICATION & ENCAISSEMENT (ACCUEIL)
  // =========================================================================
  const handleOpenEditModal = (sale: any) => {
    setError('');
    setEditingSale(sale);
    setEditCustomerName(sale.customerName || 'Client');
    setEditCustomerPhone(sale.customerPhone || '');
    setEditDiscount(String(sale.discount || 0));
    setEditPaymentMethod(sale.paymentMethod || 'CASH');
    setEditPaymentReference(sale.paymentReference || '');
    setEditCashTendered('');
    setEditCart(
      (sale.items || []).map((it: any) => {
        const med = medicines.find((m) => m.id === it.medicineId);
        const stock = med ? med.currentStock : 999;
        return {
          medicineId: it.medicineId,
          medicineName: it.medicineName || it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice || it.unitPrice * it.quantity,
          availableStock: stock,
        };
      })
    );
  };

  const handleSetEditQuantity = (medicineId: string, val: string) => {
    setError('');
    if (val === '') {
      setEditCart((prev) =>
        prev.map((it) =>
          it.medicineId === medicineId
            ? { ...it, quantity: 0, totalPrice: 0 }
            : it
        )
      );
      return;
    }
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return;
    const qty = Math.max(0, parsed);
    setEditCart((prev) =>
      prev.map((it) =>
        it.medicineId === medicineId
          ? { ...it, quantity: qty, totalPrice: qty * it.unitPrice }
          : it
      )
    );
  };

  const handleEditRemoveItem = (medicineId: string) => {
    setEditCart((prev) => prev.filter((it) => it.medicineId !== medicineId));
  };

  const handleEditAddMedicine = (medId: string) => {
    if (!medId) return;
    const med = medicines.find((m) => m.id === medId);
    if (!med) return;

    setEditCart((prev) => {
      const idx = prev.findIndex((i) => i.medicineId === med.id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        copy[idx].totalPrice = copy[idx].quantity * copy[idx].unitPrice;
        return copy;
      }
      return [
        ...prev,
        {
          medicineId: med.id,
          medicineName: med.name,
          quantity: 1,
          unitPrice: med.sellingPrice,
          totalPrice: med.sellingPrice,
          availableStock: med.currentStock,
        },
      ];
    });
    setEditAddMedId('');
  };

  // =========================================================================
  // VALIDATION PAIEMENT PAR L'ACCUEIL & IMPRESSION DU TICKET
  // =========================================================================
  const handleConfirmPaymentByReception = async () => {
    if (!editingSale) return;
    if (!editCart.length) {
      setError('La commande doit comporter au moins un médicament.');
      return;
    }

    if (editStockError) {
      setError(editStockError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        action: 'PAY',
        items: editCart,
        paymentMethod: editPaymentMethod,
        paymentReference: editPaymentReference || null,
        discount: editDiscount,
        cashTendered: null,
      };

      const res = await fetch(`/api/pharmacy/sales/${editingSale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l’encaissement');
      }

      // Mettre à jour l'état local
      setSales((prev) => prev.map((s) => (s.id === editingSale.id ? data.sale : s)));

      // Déduire localement le stock
      setMedicines((prev) =>
        prev.map((m) => {
          const item = editCart.find((ci) => ci.medicineId === m.id);
          if (item) {
            return { ...m, currentStock: Math.max(0, m.currentStock - item.quantity) };
          }
          return m;
        })
      );

      setEditingSale(null);
      setLoading(false);
      setSuccessMsg(`✓ Paiement de ${formatCurrency(data.sale.total)} validé pour #${data.sale.saleNumber} !`);
      setTimeout(() => setSuccessMsg(''), 5000);

      // Ouvrir le ticket de caisse thermique 80mm
      openReceiptModal(data.sale, true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’encaissement');
      setLoading(false);
    }
  };

  // =========================================================================
  // ACTION PHARMACIE : MARQUER COMME LIVRÉ (QUAND LE CLIENT APPORTE LE TICKET)
  // =========================================================================
  const handleMarkAsDelivered = async (sale: any) => {
    setActionLoadingId(sale.id);
    setError('');

    try {
      const res = await fetch(`/api/pharmacy/sales/${sale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELIVER' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la livraison');
      }

      setSales((prev) => prev.map((s) => (s.id === sale.id ? data.sale : s)));
      setActionLoadingId(null);
      setSuccessMsg(`✓ Commande #${sale.saleNumber} marquée comme livrée au client !`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Erreur');
      setActionLoadingId(null);
    }
  };

  // Annulation commande non payée
  const handleCancelOrder = async (sale: any) => {
    if (!confirm(`Annuler la commande #${sale.saleNumber} ?`)) return;

    try {
      const res = await fetch(`/api/pharmacy/sales/${sale.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erreur');
      }
      setSales((prev) => prev.filter((s) => s.id !== sale.id));
      setSuccessMsg(`Commande #${sale.saleNumber} supprimée.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Construction des données du ticket thermique
  const openReceiptModal = (sale: any, isNew: boolean = false) => {
    const thermalReceipt: ThermalReceiptData = {
      clinic: {
        name: clinic?.name || 'CLINIQUE BETESDA',
        slogan: clinic?.slogan || 'Soins, Bienveillance & Gestion Intelligente',
        address: clinic?.address || 'Lot IVG 35 Rue Pasteur, Antananarivo',
        phone: clinic?.phone || '034 51 365 45 / 034 53 689 59',
        taxId: clinic?.taxId || 'NIF: 3 005 710 430 - N° Stat: 86201 11 2021 0 08027',
        currency: clinic?.currency || 'Ar',
      },
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate || sale.createdAt || new Date(),
      cashierName: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'Accueil & Caisse',
      customerName: sale.customerName || 'Client de passage',
      customerPhone: sale.customerPhone || null,
      paymentMethod: sale.paymentMethod || 'CASH',
      paymentReference: sale.paymentReference || null,
      items: (sale.items || []).map((it: any) => ({
        medicineName: it.medicineName || it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice || it.unitPrice * it.quantity,
      })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.isFreeGift ? 0 : sale.total,
      isFreeGift: Boolean(sale.isFreeGift),
      cashTendered: sale.paymentMethod === 'CASH' && cashTendered ? parseFloat(cashTendered) : null,
      changeDue: sale.paymentMethod === 'CASH' ? changeDue : null,
    };

    setCompletedSaleReceipt(thermalReceipt);
    setIsNewSale(isNew);
  };

  const handleQuickPrint = (e: React.MouseEvent, sale: any) => {
    e.stopPropagation();
    openReceiptModal(sale, false);
    if (completedSaleReceipt) {
      printThermalReceipt(completedSaleReceipt);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alertes & Notifications */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SECTION CAISSE & DEMANDES PHARMACIE (RÉSERVÉE AU PHARMACIEN ET AUX ADMINS - L'ACCUEIL A DIRECTEMENT LE TABLEAU DES COMMANDES) */}
      {!isReceptionist && (
        <>
          {/* BANNIÈRE ALERTE COMMANDES PHARMACIE EN ATTENTE */}
          {isAdmin && pendingCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shadow-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-black text-sm">
                    {pendingCount} Commande{pendingCount > 1 ? 's' : ''} Pharmacie en Attente de Paiement à l'Accueil
                  </div>
                  <div className="text-xs text-amber-100">
                    Les clients arrivent de la pharmacie pour régler leur ordonnance. Vous pouvez modifier les quantités si nécessaire avant d'encaisser et imprimer le ticket.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrderFilter('PENDING_PAYMENT');
                  const el = document.getElementById('orders-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-xl bg-white text-amber-900 font-extrabold text-xs hover:bg-amber-50 transition-colors shadow-xs shrink-0"
              >
                Voir les {pendingCount} Commandes
              </button>
            </div>
          )}

          {/* GRILLE PRINCIPALE : RECHERCHE MÉDICAMENTS (GAUCHE) & PANIER (DROITE) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche : Médicaments (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {isPharmacist
                    ? '1. Demande Client : Sélection des Médicaments (en Unités)'
                    : 'Sélection Médicaments (Comptoir)'}
                </span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Stock décompté en unités de vente
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher médicament par nom commercial ou DCI..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grille des médicaments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredMedicines.map((med) => {
              const inCart = cart.find((i) => i.medicineId === med.id);
              const outOfStock = med.currentStock <= 0;

              return (
                <div
                  key={med.id}
                  onClick={() => !outOfStock && addToCart(med)}
                  className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                    outOfStock
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-slate-200/90 hover:border-blue-400 hover:shadow-sm cursor-pointer group'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-extrabold text-xs text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {med.name}
                      </span>
                      {med.category?.name && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 shrink-0">
                          {med.category.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mb-1">
                      {med.dosage} • {med.form}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                    <div>
                      <div className="text-xs font-black text-slate-900">
                        {formatCurrency(med.sellingPrice)} <span className="text-[9px] font-normal text-slate-500">/ unité</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Stock : <span className={`font-bold ${outOfStock ? 'text-rose-600' : 'text-emerald-700'}`}>{med.currentStock} unités</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(med);
                      }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        inCart
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Colonne Droite : Panier & Action (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                  {isPharmacist ? 'Panier Demande Client' : 'Panier Vente'}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                {cart.reduce((a, b) => a + (Number(b.quantity) || 0), 0)} unité(s)
              </span>
            </div>

            {/* Liste des articles du panier */}
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Aucun médicament sélectionné.<br />
                  Cliquez sur les médicaments à gauche pour les ajouter en unités.
                </div>
              ) : (
                cart.map((item) => {
                  const qty = Number(item.quantity) || 0;
                  const isStockExceeded = qty > item.availableStock;
                  const isInvalidQty = qty <= 0;

                  return (
                    <div
                      key={item.medicineId}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                        isStockExceeded || isInvalidQty
                          ? 'bg-rose-50/40 border-rose-200'
                          : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-800 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatCurrency(item.unitPrice)} / unité
                        </div>
                      </div>

                      {/* Champ de saisie directe de la quantité (sans boutons + et -) */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max={item.availableStock}
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => handleSetCartQuantity(item.medicineId, e.target.value)}
                            placeholder="0"
                            className={`w-16 px-2 py-1 text-center font-black text-xs rounded-lg border transition-all focus:outline-none ${
                              isStockExceeded || isInvalidQty
                                ? 'border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-300 bg-white text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                            }`}
                            title={`Stock disponible : ${item.availableStock} unités`}
                          />
                          <span className="text-[10px] text-slate-400 font-semibold">u.</span>
                        </div>
                        {isStockExceeded ? (
                          <span className="text-[9px] text-rose-600 font-black mt-0.5">
                            Max: {item.availableStock}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                            Stock: {item.availableStock}
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0 min-w-[65px]">
                        <div className="font-extrabold text-xs text-slate-900">
                          {formatCurrency(item.unitPrice * (Number(item.quantity) || 0))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.medicineId)}
                        className="text-slate-300 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* OPTIONS SPÉCIALES : PERSONNEL CLINIQUE & MÉDICAMENT GRATUIT */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              {/* Option 1 : Don / Gratuité */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-50 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={isFreeDonation}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsFreeDonation(checked);
                    if (checked) {
                      setIsStaffMode(false);
                      setSelectedEmployeeId('');
                    }
                  }}
                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                />
                <div className="flex-1 text-[11px]">
                  <span className="font-extrabold text-amber-900 block">
                    🎁 Don Gratuit (0 Ar) • Prise en charge clinique
                  </span>
                  <span className="text-[10px] text-amber-700">
                    Le patient ne paie rien (0 Ar). La dépense est imputée à la clinique au prix d'achat.
                  </span>
                </div>
              </label>

              {/* Option 2 : Achat Personnel au prix d'achat */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-50 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={isStaffMode}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked) setIsFreeDonation(false);
                    handleToggleStaffMode(checked);
                  }}
                  className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex-1 text-[11px]">
                  <span className="font-extrabold text-blue-900 block">
                    👨‍⚕️ Personnel Clinique (Achat au prix de revient)
                  </span>
                  <span className="text-[10px] text-blue-700">
                    Facturation automatique au prix d'achat (sans marge) et archivage dans la fiche de l'employé.
                  </span>
                </div>
              </label>

              {/* Sélecteur de l'employé si mode personnel */}
              {isStaffMode && (
                <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-1.5 animate-in fade-in">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Sélectionner l'Employé bénéficiaire *
                  </label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => handleSelectEmployee(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-blue-300 font-bold text-slate-800 bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">-- Choisir un employé dans la liste --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.lastName} {emp.firstName} — {emp.position || 'Personnel'} ({emp.phone || 'Sans tél'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Infos Client / Patient (Saisie libre directe du nom complet) */}
            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nom complet du client / patient
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Rakoto Jean ou Client de passage"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Numéro de téléphone (optionnel)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ex: 034 00 000 00"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            {/* SI ACCUEIL OU DIRECT : Saisie Paiement */}
            {!isPharmacist && (
              <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                <label className="block font-bold text-slate-700">Mode de règlement</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold transition-all ${
                      paymentMethod === 'CASH'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Espèces</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('MOBILE_MONEY')}
                    className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold transition-all ${
                      paymentMethod === 'MOBILE_MONEY'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile Money</span>
                  </button>
                </div>

                {paymentMethod === 'MOBILE_MONEY' && (
                  <div>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Réf. MVola / Orange Money / Airtel (Optionnel)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Total Box */}
            <div className="border-t border-slate-100 pt-3">
              {cartStockError && (
                <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <div className="font-black text-rose-800">Validation bloquée :</div>
                    <div className="font-semibold mt-0.5">{cartStockError}</div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-black text-slate-900 mb-3">
                <span>TOTAL À ENCAISSER :</span>
                <span className="text-base text-blue-700">{formatCurrency(totalAmount)}</span>
              </div>

              {/* ACTION BUTTON SELON LE RÔLE */}
              {isPharmacist ? (
                // BOUTON PHARMACIEN : ENVOI ACCUEIL
                <button
                  type="button"
                  disabled={loading || cart.length === 0 || Boolean(cartStockError)}
                  onClick={handleSendToReception}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Transmission en cours...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Envoyer la Demande à l'Accueil pour Paiement ({formatCurrency(totalAmount)})</span>
                    </>
                  )}
                </button>
              ) : (
                // BOUTON ACCUEIL : ENCAISSEMENT DIRECT
                <button
                  type="button"
                  disabled={loading || cart.length === 0 || Boolean(cartStockError)}
                  onClick={handleDirectCheckout}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Encaissement...</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      <span>Encaisser &amp; Imprimer Ticket ({formatCurrency(totalAmount)})</span>
                    </>
                  )}
                </button>
              )}

              {isPharmacist && (
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  ℹ️ Le client se rendra à l'accueil pour régler. Vous validerez la délivrance sur présentation de son ticket.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
    )}

      {/* ========================================================================= */}
      {/* SECTION COMMANDES & LIVRAISONS PHARMACIE                                  */}
      {/* ========================================================================= */}
      <div id="orders-section" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header avec onglets de filtrage */}
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-blue-600" />
              <span>
                {isReceptionist
                  ? 'Liste des Commandes de Paiement (Transmises par le Pharmacien)'
                  : 'Suivi des Commandes Pharmacie & Délivrance'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Circuit sécurisé : Demande Pharmacie → Paiement &amp; Ticket Accueil → Remise Médicaments Pharmacie
            </p>
          </div>

          {/* Recherche & Filtres par statut */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Rechercher par N° commande, client..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 sm:w-56"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/80 text-xs font-bold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setOrderFilter('PENDING_PAYMENT')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderFilter === 'PENDING_PAYMENT'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⏳ En attente ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilter('PAID')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderFilter === 'PAID'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✅ Payés ({paidCount})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilter('DELIVERED')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderFilter === 'DELIVERED'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✓ Livrés ({deliveredCount})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({sales.length})
              </button>
            </div>
          </div>
        </div>

        {/* Table des commandes */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">N° Commande</th>
                <th className="px-4 py-3">Date &amp; Heure</th>
                <th className="px-4 py-3">Client / Patient</th>
                <th className="px-4 py-3">Médicaments (Unités)</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Aucune commande trouvée pour ce filtre.
                  </td>
                </tr>
              ) : (
                displayedSales.map((s) => {
                  const isPending = s.status === 'PENDING_PAYMENT';
                  const isPaid = s.status === 'PAID';
                  const isDelivered = s.status === 'DELIVERED' || s.status === 'COMPLETED';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {s.saleNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDateTime(s.createdAt || s.saleDate)}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {s.customerName || 'Client de passage'}
                        {s.customerPhone && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            {s.customerPhone}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {(s.items || []).map((it: any, idx: number) => (
                            <div key={idx} className="text-[11px] text-slate-700">
                              • <span className="font-semibold">{it.medicineName || it.name}</span> :{' '}
                              <span className="font-bold text-blue-700">{it.quantity} unité(s)</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            ⏳ EN ATTENTE ACCUEIL
                          </span>
                        )}
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✅ PAYÉ — PRÊT À LIVRER
                          </span>
                        )}
                        {isDelivered && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                            ✓ LIVRÉ AU CLIENT
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(s.total)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* SI EN ATTENTE ET UTILISATEUR ACCUEIL / ADMIN -> BOUTON MODIFIER & ENCAISSER */}
                          {isPending && (isReceptionist || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(s)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors cursor-pointer"
                              title="Modifier la commande et encaisser"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Modifier &amp; Encaisser</span>
                            </button>
                          )}

                          {/* SI EN ATTENTE ET PHARMACIEN -> INDICATEUR OU ANNULATION */}
                          {isPending && isPharmacist && (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-amber-700 italic">
                                Client en caisse
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCancelOrder(s)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Annuler cette demande"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* SI PAYÉ ET PHARMACIEN -> GROS BOUTON VERT "LIVRÉ" */}
                          {isPaid && isPharmacist && (
                            <button
                              type="button"
                              disabled={actionLoadingId === s.id}
                              onClick={() => handleMarkAsDelivered(s)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer animate-pulse hover:animate-none"
                              title="Cliquer ici quand le client vous présente le ticket pour valider la remise des médicaments"
                            >
                              {actionLoadingId === s.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <PackageCheck className="w-4 h-4" />
                              )}
                              <span>✓ Marquer Livré</span>
                            </button>
                          )}

                          {/* SI PAYÉ ET ACCUEIL -> BOUTON RÉIMPRIMER TICKET */}
                          {isPaid && !isPharmacist && (
                            <button
                              type="button"
                              onClick={() => openReceiptModal(s, false)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Ticket 80mm</span>
                            </button>
                          )}

                          {/* SI DÉJÀ LIVRÉ -> APERÇU / RÉIMPRESSION DISPONIBLE POUR TOUS */}
                          {isDelivered && (
                            <button
                              type="button"
                              onClick={() => openReceiptModal(s, false)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                              title="Voir / Imprimer le ticket"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Ticket</span>
                            </button>
                          )}
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

      {/* ========================================================================= */}
      {/* MODAL DE MODIFICATION & ENCAISSEMENT ACCUEIL (QUI POURRAIT ÊTRE MODIFIABLE) */}
      {/* ========================================================================= */}
      {editingSale && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingSale(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span>Modification &amp; Encaissement Commande #{editingSale.saleNumber}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Vous pouvez ajuster les quantités en unités, retirer ou ajouter des médicaments selon le budget du client.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            {/* Articles modifiables */}
            <div className="space-y-3">
              <label className="block text-xs font-extrabold uppercase text-slate-700 tracking-wider">
                1. Médicaments demandés (Modifiable en direct)
              </label>

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {editCart.map((it) => {
                  const qty = Number(it.quantity) || 0;
                  const med = medicines.find((m) => m.id === it.medicineId);
                  const stock = it.availableStock ?? (med ? med.currentStock : 999);
                  const isStockExceeded = qty > stock;
                  const isInvalidQty = qty <= 0;

                  return (
                    <div
                      key={it.medicineId}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                        isStockExceeded || isInvalidQty
                          ? 'bg-rose-50/40 border-rose-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900">{it.medicineName}</div>
                        <div className="text-[10px] text-slate-500">
                          P.U : {formatCurrency(it.unitPrice)} / unité
                        </div>
                      </div>

                      {/* Contrôle de quantité modifiable (sans boutons + et -) */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max={stock}
                            value={it.quantity === 0 ? '' : it.quantity}
                            onChange={(e) => handleSetEditQuantity(it.medicineId, e.target.value)}
                            placeholder="0"
                            className={`w-16 px-2 py-1 text-center font-black text-xs rounded-lg border transition-all focus:outline-none ${
                              isStockExceeded || isInvalidQty
                                ? 'border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-300 bg-white text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                            }`}
                            title={`Stock disponible : ${stock} unités`}
                          />
                          <span className="text-[10px] text-slate-400 font-semibold">u.</span>
                        </div>
                        {isStockExceeded ? (
                          <span className="text-[9px] text-rose-600 font-black mt-0.5">
                            Max: {stock}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                            Stock: {stock}
                          </span>
                        )}
                      </div>

                      <div className="text-right font-black text-slate-900 min-w-[80px]">
                        {formatCurrency(it.unitPrice * (Number(it.quantity) || 0))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleEditRemoveItem(it.medicineId)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Supprimer cette ligne"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Ajouter un médicament supplémentaire avec recherche intégrée en tête de liste */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-extrabold uppercase text-slate-700 tracking-wider mb-1.5">
                  + Ajouter un autre médicament à la commande
                </label>
                <MedicineSearchSelect
                  medicines={medicines}
                  selectedId=""
                  onSelect={(medId) => {
                    handleEditAddMedicine(medId);
                  }}
                  placeholder="+ Rechercher et sélectionner un médicament dans la liste déroulante..."
                />
              </div>
            </div>

            {/* Paiement & Encaissement */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                2. Règlement &amp; Encaissement
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditPaymentMethod('CASH')}
                  className={`p-2 rounded-xl border flex items-center gap-2 font-bold transition-all ${
                    editPaymentMethod === 'CASH'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Espèces</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditPaymentMethod('MOBILE_MONEY')}
                  className={`p-2 rounded-xl border flex items-center gap-2 font-bold transition-all ${
                    editPaymentMethod === 'MOBILE_MONEY'
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Mobile Money</span>
                </button>
              </div>

              {editPaymentMethod === 'MOBILE_MONEY' && (
                <div>
                  <input
                    type="text"
                    value={editPaymentReference}
                    onChange={(e) => setEditPaymentReference(e.target.value)}
                    placeholder="Référence de transaction MVola / OM / Airtel (Optionnel)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              )}

              {/* Total Net à Régler (Paiement direct) */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Net à Régler</div>
                  <div className="text-2xl font-black text-blue-700">{formatCurrency(editTotal)}</div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Règlement direct</span>
                  </span>
                </div>
              </div>
            </div>

            {editStockError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <div className="font-black text-rose-800">Validation bloquée :</div>
                  <div className="font-semibold mt-0.5">{editStockError}</div>
                </div>
              </div>
            )}

            {/* Boutons actions modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
              >
                Fermer sans encaisser
              </button>
              <button
                type="button"
                disabled={loading || editCart.length === 0 || Boolean(editStockError)}
                onClick={handleConfirmPaymentByReception}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validation &amp; Impression...</span>
                  </>
                ) : (
                  <>
                    <Receipt className="w-4 h-4" />
                    <span>Valider Paiement &amp; Imprimer Ticket ({formatCurrency(editTotal)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Reçu Thermique 80mm Modal After Sale / On Reprint */}
      {completedSaleReceipt && (
        <ThermalReceiptPreview
          receiptData={completedSaleReceipt}
          onClose={() => setCompletedSaleReceipt(null)}
          isNewSale={isNewSale}
        />
      )}
    </div>
  );
}
