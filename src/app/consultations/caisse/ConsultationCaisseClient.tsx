'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  User,
  Search,
  PlusCircle,
  Printer,
  Receipt,
  HeartPulse,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Smartphone,
  Banknote,
  RotateCcw,
  Settings,
  Trash2,
  Plus,
  Minus,
  X,
  Check,
  Sparkles,
  Smile,
} from 'lucide-react';
import { AuthUser } from '@/types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import ConsultationDualTicketPreview from '@/components/consultations/ConsultationDualTicketPreview';
import { ConsultationTicketData } from '@/lib/consultationReceipt';
import { ConsultationAct, DEFAULT_CONSULTATION_ACTS } from '@/lib/consultationActs';

interface DoctorItem {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  specialtyName?: string | null;
  user?: { firstName: string; lastName: string } | null;
  specialty?: { name: string } | null;
}

interface PatientItem {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  gender: string;
  birthDate?: string | Date | null;
}

export interface SelectedActItem {
  id: string;
  name: string;
  price: number;
  icon?: string;
  quantity: number;
}

interface ConsultationCaisseClientProps {
  user: AuthUser;
  doctors: DoctorItem[];
  initialPatients: PatientItem[];
  initialConsultations: any[];
  initialActs?: ConsultationAct[];
  initialDentalActs?: any[];
}

export default function ConsultationCaisseClient({
  user,
  doctors,
  initialPatients,
  initialConsultations,
  initialActs,
  initialDentalActs,
}: ConsultationCaisseClientProps) {
  // Rôle Administrateur (seuls les admins peuvent modifier la grille officielle des actes)
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'CLINIC_ADMIN';

  // Liste des patients et consultations
  const [patients, setPatients] = useState<PatientItem[]>(initialPatients);
  const [consultations, setConsultations] = useState<any[]>(initialConsultations);

  // Filtre département des actes : Général vs Dentisterie
  const [departmentFilter, setDepartmentFilter] = useState<'GENERAL' | 'DENTISTRY'>('GENERAL');
  const [dentalActs, setDentalActs] = useState<any[]>(initialDentalActs || []);

  // Saisie directe du patient (aucun menu déroulant ni sélection de clients)
  const [patientFullName, setPatientFullName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientGender, setPatientGender] = useState<'MALE' | 'FEMALE'>('MALE');

  // Grille d'actes configurés (depuis DB setting ou défauts)
  const [acts, setActs] = useState<ConsultationAct[]>(
    initialActs && initialActs.length > 0 ? initialActs : DEFAULT_CONSULTATION_ACTS
  );

  // Sélection multiple d'actes avec quantité (aucune sélection par défaut)
  const [selectedActs, setSelectedActs] = useState<SelectedActItem[]>([]);

  // Montant manuel optionnel
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [customTotalAmount, setCustomTotalAmount] = useState<string>('');

  // Mode de tarification : Catalogue d'actes vs Prestation personnalisée hors liste
  const [actSelectionMode, setActSelectionMode] = useState<'CATALOG' | 'CUSTOM'>('CATALOG');

  // Ajout d'acte hors liste / prestation ad-hoc
  const [showAddCustomAct, setShowAddCustomAct] = useState(false);
  const [customActName, setCustomActName] = useState('');
  const [customActPrice, setCustomActPrice] = useState('');
  const [customActQuantity, setCustomActQuantity] = useState(1);

  // Modal de gestion des tarifs
  const [showActsModal, setShowActsModal] = useState(false);
  const [editingActs, setEditingActs] = useState<ConsultationAct[]>([]);
  const [savingActs, setSavingActs] = useState(false);
  const [actsModalError, setActsModalError] = useState('');
  const [actsModalSuccess, setActsModalSuccess] = useState('');
  const [newActForm, setNewActForm] = useState({ name: '', price: '', icon: '🩺' });

  // Médecin et motif (Optionnel, défaut Médecin consultant)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [reason, setReason] = useState('');

  // Constantes vitals optionnelles
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [vitalsData, setVitalsData] = useState({
    temperature: '',
    systolicBP: '',
    diastolicBP: '',
    weight: '',
    height: '',
    heartRate: '',
    oxygenSaturation: '',
    bloodSugar: '',
    notes: '',
  });

  // Paiement
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MVOLA' | 'ORANGE_MONEY' | 'AIRTEL_MONEY' | 'CARD' | 'CHECK'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');

  // États de soumission et prévisualisation du ticket
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [previewTicketData, setPreviewTicketData] = useState<ConsultationTicketData | null>(null);
  const [isNewTicket, setIsNewTicket] = useState(true);

  // Coche Consultation Gratuite (0 Ar)
  const [isFreeConsultation, setIsFreeConsultation] = useState(false);

  // Détection automatique Samedi (6) / Dimanche (0) : coché et figé automatiquement le week-end
  const isTodayWeekend = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }, []);

  // Coche Consultation Week-end (automatiquement cochée & figée le Samedi/Dimanche)
  const [isWeekendConsultation, setIsWeekendConsultation] = useState<boolean>(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  });

  // Total cumulé automatique des actes sélectionnés
  const computedTotal = useMemo(() => {
    return selectedActs.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [selectedActs]);

  // Montant effectif à payer
  const effectiveAmount = useMemo(() => {
    if (isFreeConsultation) return 0;
    if (isCustomAmount && customTotalAmount !== '') {
      return Math.max(0, parseFloat(customTotalAmount) || 0);
    }
    return computedTotal;
  }, [isFreeConsultation, isCustomAmount, customTotalAmount, computedTotal]);

  // Libellé global des actes concaténés
  const effectiveActName = useMemo(() => {
    if (selectedActs.length === 0) return 'Consultation Médicale';
    return selectedActs
      .map((a) => (a.quantity > 1 ? `${a.name} (x${a.quantity})` : a.name))
      .join(' + ');
  }, [selectedActs]);

  // Statistiques du jour
  const todayStats = useMemo(() => {
    const totalAmount = consultations.reduce((acc, c) => {
      const inv = c.invoice?.totalAmount || 0;
      return acc + inv;
    }, 0);
    return {
      count: consultations.length,
      totalAmount,
    };
  }, [consultations]);

  // Basculer la sélection d'un acte (Multi-sélection)
  const handleToggleAct = (act: ConsultationAct) => {
    setSelectedActs((prev) => {
      const exists = prev.find((a) => a.id === act.id || a.name === act.name);
      if (exists) {
        // Si déjà sélectionné, on le retire
        return prev.filter((a) => a.id !== act.id && a.name !== act.name);
      } else {
        // Sinon on l'ajoute avec quantité 1
        return [...prev, { id: act.id, name: act.name, price: act.price, icon: act.icon, quantity: 1 }];
      }
    });
  };

  // Basculer la sélection d'un acte du Cabinet Dentaire
  const handleToggleDentalAct = (dentalAct: any) => {
    setSelectedActs((prev) => {
      const exists = prev.find((a) => a.id === dentalAct.id || a.name === dentalAct.name);
      if (exists) {
        return prev.filter((a) => a.id !== dentalAct.id && a.name !== dentalAct.name);
      } else {
        return [...prev, { id: dentalAct.id, name: dentalAct.name, price: dentalAct.price, icon: '🦷', quantity: 1 }];
      }
    });
  };

  // Ajuster la quantité d'un acte directement par saisie
  const handleSetDirectQuantity = (actId: string, qty: number) => {
    setSelectedActs((prev) =>
      prev.map((item) => (item.id === actId ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  };

  // Ajuster la quantité d'un acte sélectionné (+ / -)
  const handleUpdateQuantity = (actId: string, delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedActs((prev) =>
      prev
        .map((item) => {
          if (item.id === actId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as SelectedActItem[]
    );
  };

  // Retirer un acte sélectionné
  const handleRemoveSelectedAct = (actId: string) => {
    setSelectedActs((prev) => prev.filter((a) => a.id !== actId));
  };

  // Ajouter un acte personnalisé hors grille
  const handleAddCustomAct = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customActName.trim()) return;
    const p = Math.max(0, parseFloat(customActPrice) || 0);
    const qty = Math.max(1, customActQuantity || 1);
    const newCustomItem: SelectedActItem = {
      id: `custom-${Date.now()}`,
      name: customActName.trim(),
      price: p,
      icon: '✍️',
      quantity: qty,
    };
    setSelectedActs((prev) => [...prev, newCustomItem]);
    setCustomActName('');
    setCustomActPrice('');
    setCustomActQuantity(1);
    setShowAddCustomAct(false);
  };

  // Ouvrir le modal de gestion des tarifs (Administrateurs uniquement)
  const handleOpenActsModal = () => {
    if (!isAdmin) return;
    setEditingActs(JSON.parse(JSON.stringify(acts)));
    setActsModalError('');
    setActsModalSuccess('');
    setShowActsModal(true);
  };

  // Sauvegarder la grille tarifaire via l'API
  const handleSaveActsModal = async () => {
    if (editingActs.length === 0) {
      setActsModalError('La grille doit contenir au moins un acte médical.');
      return;
    }
    setSavingActs(true);
    setActsModalError('');
    setActsModalSuccess('');

    try {
      const res = await fetch('/api/consultations/acts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acts: editingActs }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour des tarifs.');
      }
      setActs(data.acts);
      setActsModalSuccess('Grille des tarifs enregistrée avec succès !');
      setTimeout(() => {
        setShowActsModal(false);
        setActsModalSuccess('');
      }, 1000);
    } catch (err: any) {
      setActsModalError(err.message || 'Une erreur est survenue.');
    } finally {
      setSavingActs(false);
    }
  };

  // Réinitialiser les tarifs aux 5 valeurs officielles Betesda
  const handleResetActsToDefault = () => {
    if (confirm('Voulez-vous restaurer les 5 tarifs officiels de base de la Clinique Betesda ?')) {
      setEditingActs(JSON.parse(JSON.stringify(DEFAULT_CONSULTATION_ACTS)));
    }
  };

  // Ajouter un nouvel acte dans le modal
  const handleAddNewActToModal = () => {
    if (!newActForm.name.trim()) return;
    const p = Math.max(0, parseFloat(newActForm.price) || 0);
    const newAct: ConsultationAct = {
      id: `act-${Date.now()}`,
      name: newActForm.name.trim(),
      price: p,
      icon: newActForm.icon || '🩺',
    };
    setEditingActs([...editingActs, newAct]);
    setNewActForm({ name: '', price: '', icon: '🩺' });
  };

  // Supprimer un acte dans le modal
  const handleDeleteActFromModal = (id: string) => {
    setEditingActs((prev) => prev.filter((a) => a.id !== id));
  };

  // Modifier un champ d'un acte dans le modal
  const handleUpdateActInModal = (id: string, field: 'name' | 'price' | 'icon', value: any) => {
    setEditingActs((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            [field]: field === 'price' ? Math.max(0, parseFloat(value) || 0) : value,
          };
        }
        return a;
      })
    );
  };

  // Réinitialisation du formulaire
  const handleResetForm = () => {
    setPatientFullName('');
    setPatientPhone('');
    setPatientGender('MALE');
    setIsFreeConsultation(false);
    // Réinitialiser la sélection d'actes (aucune coche par défaut)
    setSelectedActs([]);
    setIsCustomAmount(false);
    setCustomTotalAmount('');
    setShowAddCustomAct(false);
    setCustomActName('');
    setCustomActPrice('');
    setReason('');
    setPaymentReference('');
    setVitalsData({
      temperature: '',
      systolicBP: '',
      diastolicBP: '',
      weight: '',
      height: '',
      heartRate: '',
      oxygenSaturation: '',
      bloodSugar: '',
      notes: '',
    });
    setError('');
    setSuccessMsg('');
  };

  // Soumission de l'encaissement et impression ticket
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!patientFullName.trim()) {
      setError('Veuillez saisir le nom complet du patient.');
      return;
    }

    // Si une prestation personnalisée est en cours de saisie, on l'ajoute automatiquement
    let currentActs = [...selectedActs];
    if (customActName.trim() && parseFloat(customActPrice) > 0) {
      const autoCustom: SelectedActItem = {
        id: `custom-${Date.now()}`,
        name: customActName.trim(),
        price: Math.max(0, parseFloat(customActPrice) || 0),
        icon: '✍️',
        quantity: Math.max(1, customActQuantity || 1),
      };
      currentActs.push(autoCustom);
      setSelectedActs(currentActs);
      setCustomActName('');
      setCustomActPrice('');
      setCustomActQuantity(1);
    }

    const currentTotal = currentActs.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const finalAmount = isFreeConsultation
      ? 0
      : isCustomAmount && customTotalAmount !== ''
      ? Math.max(0, parseFloat(customTotalAmount) || 0)
      : currentTotal;

    if (!isFreeConsultation && finalAmount <= 0) {
      setError('Veuillez sélectionner un acte du catalogue ou saisir une prestation personnalisée hors liste avec son tarif (ou cochez Consultation Gratuite).');
      return;
    }

    setLoading(true);

    try {
      const finalActName = isFreeConsultation
        ? `[CONSULTATION GRATUITE 0 Ar] ${currentActs.length > 0 ? currentActs.map((a) => (a.quantity > 1 ? `${a.name} (x${a.quantity})` : a.name)).join(' + ') : 'Consultation Générale'}`
        : currentActs.length > 0
        ? currentActs.map((a) => (a.quantity > 1 ? `${a.name} (x${a.quantity})` : a.name)).join(' + ')
        : 'Consultation Médicale';

      const parts = patientFullName.trim().split(' ');
      const lastName = parts[0] || 'Patient';
      const firstName = parts.slice(1).join(' ') || '-';

      const payload: any = {
        patientId: null,
        newPatient: {
          lastName,
          firstName,
          phone: patientPhone.trim() || 'Néant',
          gender: patientGender,
        },
        doctorId: selectedDoctorId || null,
        actName: finalActName,
        selectedActs: currentActs.map((a) => ({
          name: a.name,
          price: isFreeConsultation ? 0 : a.price,
          quantity: a.quantity,
        })),
        amount: isFreeConsultation ? 0 : finalAmount,
        isFreeConsultation,
        isWeekendConsultation: isTodayWeekend ? true : isWeekendConsultation,
        paymentMethod,
        paymentReference: paymentReference.trim() || 'Néant',
        cashTendered: isFreeConsultation ? 0 : finalAmount,
        changeDue: null,
        reason: reason.trim() || null,
        vitals: showVitalsForm ? vitalsData : null,
      };

      const res = await fetch('/api/consultations/caisse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l’encaissement');
      }

      // Succès
      setSuccessMsg(`Encaissement réussi ! Ticket #${data.ticketData.orderNumber} émis.`);
      
      // Mise à jour de l'historique
      setConsultations([data.consultation, ...consultations]);
      if (data.consultation?.patient) {
        setPatients([data.consultation.patient, ...patients]);
      }

      // Ouvre immédiatement la prévisualisation et l'impression du ticket 2 volets
      setIsNewTicket(true);
      setPreviewTicketData(data.ticketData);

      // Réinitialiser les champs du formulaire
      handleResetForm();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  // Réimprimer un ticket depuis l'historique
  const handleReprintFromHistory = (consult: any) => {
    let patientAge: number | string = '-';
    if (consult.patient.birthDate) {
      const diff = Date.now() - new Date(consult.patient.birthDate).getTime();
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
      receiptNumber: consult.invoice?.invoiceNumber || `REC-${consult.id.slice(0, 8)}`,
      orderNumber: consult.orderNumber || '001',
      consultationId: consult.id,
      date: consult.createdAt || new Date(),
      cashierName: `${user.firstName} ${user.lastName}`,
      patient: {
        id: consult.patient.id,
        patientNumber: consult.patient.patientNumber,
        firstName: consult.patient.firstName,
        lastName: consult.patient.lastName,
        phone: consult.patient.phone,
        age: patientAge,
        gender: consult.patient.gender,
      },
      doctorName: consult.doctor
        ? consult.doctor.firstName || consult.doctor.lastName
          ? `${consult.doctor.title || 'Dr.'} ${consult.doctor.firstName || ''} ${consult.doctor.lastName || ''}`.trim()
          : consult.doctor.user
          ? `Dr. ${consult.doctor.user.firstName} ${consult.doctor.user.lastName}`
          : null
        : null,
      specialty: consult.doctor?.specialty?.name || consult.doctor?.specialtyName || null,
      actName: consult.reason || 'Consultation Médicale',
      items: consult.invoice?.items?.map((it: any) => ({
        name: it.description,
        price: it.unitPrice,
        quantity: it.quantity,
      })),
      amount: consult.invoice?.totalAmount || 15000,
      paymentMethod: consult.invoice?.payments?.[0]?.paymentMethod || 'CASH',
      reason: consult.reason,
      vitals: consult.vitalSigns ? {
        systolicBP: consult.vitalSigns.systolicBP,
        diastolicBP: consult.vitalSigns.diastolicBP,
        temperature: consult.vitalSigns.temperature,
        weight: consult.vitalSigns.weight,
        height: consult.vitalSigns.height,
        heartRate: consult.vitalSigns.heartRate,
        oxygenSaturation: consult.vitalSigns.oxygenSaturation,
      } : undefined,
    };

    setIsNewTicket(false);
    setPreviewTicketData(ticket);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Statistiques Caisse */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">Caisse Accueil</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight flex items-center gap-2.5">
            <span>Caisse Consultation &amp; Fiche Navette</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
              Double Ticket 80mm
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Encaissement de la consultation, émission du reçu de paiement et du ticket navette avec prise de paramètres vitaux.
          </p>
        </div>

        {/* Actions & Badges de synthèse du jour */}
        <div className="flex items-center gap-3">
          <Link
            href="/pharmacy/sales"
            className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 transition-all shadow-xs"
          >
            <CreditCard className="w-4 h-4 text-amber-700" />
            <span>{user.role === 'RECEPTIONIST' ? 'Commande de paiement' : 'Caisse & Commandes Pharmacie'}</span>
          </Link>

          <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Tickets du jour
            </div>
            <div className="text-lg font-black text-slate-900">
              {todayStats.count}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
              Recettes Consultations
            </div>
            <div className="text-lg font-black text-emerald-700">
              {formatCurrency(todayStats.totalAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Messages d'erreur ou de succès */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grille principale : Formulaire d'encaissement (Gauche) / Historique (Droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLONNE GAUCHE : FORMULAIRE D'ENCAISSEMENT (7 colonnes) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <form onSubmit={handleSubmitPayment} className="space-y-6">
            
            {/* SECTION 1 : PATIENT (SAISIE DIRECTE DU NOM COMPLET) */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                <span>1. Informations du Patient</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom complet du patient *
                  </label>
                  <input
                    type="text"
                    required
                    value={patientFullName}
                    onChange={(e) => setPatientFullName(e.target.value)}
                    placeholder="Ex: Rakoto Jean ou Ravelomanana Aina"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-white font-medium shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Numéro de téléphone (optionnel — Néant par défaut)
                  </label>
                  <input
                    type="tel"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder="Néant (ou 034 00 000 00)"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-white shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2 : ACTES & TARIFICATION (SÉLECTION CATALOGUE OU PRESTATION PERSONNALISÉE HORS LISTE) */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <span>2. Actes Médicaux &amp; Prestations</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Sélectionnez un acte du catalogue ou créez directement une prestation personnalisée hors liste
                  </p>
                </div>
                
                {/* Bouton d'ouverture du modal de gestion des tarifs (Administrateurs uniquement) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenActsModal}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-2xs"
                    title="Gérer les prix et la liste officielle des actes de consultation (Admin)"
                  >
                    <Settings className="w-3.5 h-3.5 text-blue-600" />
                    <span>⚙️ Gérer les Tarifs &amp; Actes</span>
                  </button>
                )}
              </div>

              {/* BASCULE DE MODE : CATALOGUE D'ACTES VS PRESTATION HORS LISTE */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActSelectionMode('CATALOG')}
                  className={`flex-1 min-w-[170px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    actSelectionMode === 'CATALOG'
                      ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                  <span>Actes du Catalogue ({acts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActSelectionMode('CUSTOM');
                    // Si seul le premier acte par défaut était sélectionné et aucun autre, on vide pour démarrer directement sur du sur-mesure
                    if (selectedActs.length === 1 && acts.some((a) => a.id === selectedActs[0].id)) {
                      setSelectedActs([]);
                    }
                  }}
                  className={`flex-1 min-w-[210px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    actSelectionMode === 'CUSTOM'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-amber-800 hover:bg-amber-100/60'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>✍️ Prestation Personnalisée Hors Liste</span>
                </button>

                {selectedActs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedActs([])}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1 transition-colors shrink-0"
                    title="Vider tous les actes sélectionnés"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vider ({selectedActs.length})</span>
                  </button>
                )}
              </div>

              {/* MODE 1 : GRILLE DU CATALOGUE D'ACTES */}
              {actSelectionMode === 'CATALOG' && (
                <div className="space-y-3">
                  {/* BASCULE SPÉCIALITÉ : CONSULTATION GÉNÉRALE VS DENTISTERIE */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDepartmentFilter('GENERAL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        departmentFilter === 'GENERAL'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>Consultation Générale ({acts.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDepartmentFilter('DENTISTRY')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        departmentFilter === 'DENTISTRY'
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Smile className="w-3.5 h-3.5" />
                      <span>Dentisterie / Soins des Dents ({dentalActs.length})</span>
                    </button>
                  </div>

                  {/* GRILLE SELON LA SPÉCIALITÉ CHOISIE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {departmentFilter === 'GENERAL' ? (
                      acts.map((act) => {
                        const selectedItem = selectedActs.find((a) => a.id === act.id || a.name === act.name);
                        const isSelected = !!selectedItem;

                        return (
                          <div
                            key={act.id}
                            onClick={() => handleToggleAct(act)}
                            className={`relative p-3 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/80'
                                : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl shrink-0">{act.icon || '🩺'}</span>
                                <span className="font-extrabold text-slate-900 text-xs leading-snug">
                                  {act.name}
                                </span>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs transition-colors ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-slate-300 bg-white text-transparent hover:border-blue-400'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between">
                              <span className="text-xs font-black text-blue-700">
                                {formatCurrency(act.price)}
                              </span>

                              {/* Compteur quantité si sélectionné avec champ direct et boutons +/- */}
                              {isSelected && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-blue-200 shadow-2xs"
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => handleUpdateQuantity(selectedItem.id, -1, e)}
                                    className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs"
                                    title="Diminuer la quantité"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={selectedItem.quantity}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      if (!isNaN(val) && val >= 1) {
                                        handleSetDirectQuantity(selectedItem.id, val);
                                      }
                                    }}
                                    className="w-8 text-center text-xs font-black text-slate-900 border-none p-0 focus:outline-hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => handleUpdateQuantity(selectedItem.id, 1, e)}
                                    className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs"
                                    title="Augmenter la quantité"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      dentalActs.map((dentalAct) => {
                        const selectedItem = selectedActs.find((a) => a.id === dentalAct.id || a.name === dentalAct.name);
                        const isSelected = !!selectedItem;

                        return (
                          <div
                            key={dentalAct.id}
                            onClick={() => handleToggleDentalAct(dentalAct)}
                            className={`relative p-3 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between ${
                              isSelected
                                ? 'border-teal-600 bg-teal-50/80 shadow-xs ring-2 ring-teal-500/80'
                                : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl shrink-0">🦷</span>
                                <div>
                                  <span className="font-extrabold text-slate-900 text-xs leading-snug block">
                                    {dentalAct.name}
                                  </span>
                                  {dentalAct.description && (
                                    <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">
                                      {dentalAct.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs transition-colors ${
                                  isSelected
                                    ? 'bg-teal-600 text-white'
                                    : 'border border-slate-300 bg-white text-transparent hover:border-teal-400'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between">
                              <span className="text-xs font-black text-teal-800 font-mono">
                                {formatCurrency(dentalAct.price)}
                              </span>

                              {/* Compteur quantité si sélectionné avec champ direct et boutons +/- */}
                              {isSelected && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-teal-200 shadow-2xs"
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => handleUpdateQuantity(selectedItem.id, -1, e)}
                                    className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs"
                                    title="Diminuer la quantité"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={selectedItem.quantity}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      if (!isNaN(val) && val >= 1) {
                                        handleSetDirectQuantity(selectedItem.id, val);
                                      }
                                    }}
                                    className="w-8 text-center text-xs font-black text-slate-900 border-none p-0 focus:outline-hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => handleUpdateQuantity(selectedItem.id, 1, e)}
                                    className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs"
                                    title="Augmenter la quantité"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                  {/* CARTE D'ACCÈS RAPIDE À LA PRESTATION HORS LISTE DIRECTEMENT DEPUIS LA GRILLE */}
                  <div
                    onClick={() => {
                      setActSelectionMode('CUSTOM');
                      if (selectedActs.length === 1 && acts.some((a) => a.id === selectedActs[0].id)) {
                        setSelectedActs([]);
                      }
                    }}
                    className="relative p-3 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-100/60 text-left transition-all cursor-pointer select-none flex flex-col justify-between group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">✍️</span>
                        <div>
                          <span className="font-extrabold text-amber-950 text-xs block leading-snug">
                            + Prestation Personnalisée
                          </span>
                          <span className="text-[10px] text-amber-700">Hors liste catalogue</span>
                        </div>
                      </div>
                      <span className="text-[9.5px] font-black uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                        Libre
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800">
                      <span>Tarif sur-mesure</span>
                      <span className="font-bold underline text-amber-900">Saisir &rarr;</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* MODE 2 : FORMULAIRE DÉDIÉ PRESTATION PERSONNALISÉE HORS LISTE */}
              {actSelectionMode === 'CUSTOM' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 border-2 border-amber-300 shadow-sm space-y-4 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs">✍️</span>
                        <span>Prestation Médicale Personnalisée (Hors Liste)</span>
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Aucun acte du catalogue n'est requis. Saisissez librement le nom de la prestation et son prix.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200 self-start sm:self-auto">
                      Tarification Sur-Mesure
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Intitulé / Désignation de la prestation *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Pansement stérile, ECG d'urgence, Infiltration, Certificat..."
                        value={customActName}
                        onChange={(e) => setCustomActName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomAct();
                          }
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white font-medium text-slate-900 placeholder-slate-400 shadow-2xs"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Prix Unitaire (Ar) *
                      </label>
                      <input
                        type="number"
                        placeholder="Ex: 25000"
                        value={customActPrice}
                        onChange={(e) => setCustomActPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomAct();
                          }
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white font-extrabold text-slate-900 shadow-2xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Quantité
                      </label>
                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setCustomActQuantity((q) => Math.max(1, q - 1))}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="flex-1 text-center font-bold text-xs text-slate-800">
                          {customActQuantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomActQuantity((q) => q + 1)}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddCustomAct}
                        disabled={!customActName.trim() || !(parseFloat(customActPrice) > 0)}
                        className="w-full py-2.5 px-3 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>

                  {/* Suggestions de tarifs rapides */}
                  <div className="pt-2 border-t border-amber-100 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-semibold mr-1">Tarifs rapides :</span>
                    {[5000, 10000, 15000, 20000, 25000, 30000, 50000].map((quickPrice) => (
                      <button
                        key={quickPrice}
                        type="button"
                        onClick={() => setCustomActPrice(String(quickPrice))}
                        className="px-2 py-0.5 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100 font-bold text-amber-900 transition-colors"
                      >
                        {formatCurrency(quickPrice)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Récapitulatif des actes sélectionnés et total */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Actes retenus sur le ticket ({selectedActs.length}) :</span>
                  </div>
                  {actSelectionMode === 'CATALOG' && (
                    <button
                      type="button"
                      onClick={() => setShowAddCustomAct(!showAddCustomAct)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{showAddCustomAct ? 'Fermer' : 'Ajouter prestation libre'}</span>
                    </button>
                  )}
                </div>

                {/* Formulaire ajout rapide de prestation personnalisée libre en mode catalogue */}
                {actSelectionMode === 'CATALOG' && showAddCustomAct && (
                  <div className="p-2.5 bg-white rounded-lg border border-blue-200 space-y-2 animate-in fade-in">
                    <div className="text-[11px] font-bold text-slate-700">Prestation personnalisée hors liste :</div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-7">
                        <input
                          type="text"
                          placeholder="Nom de la prestation (ex: ECG, Pansement complexe...)"
                          value={customActName}
                          onChange={(e) => setCustomActName(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="number"
                          placeholder="Prix en Ar"
                          value={customActPrice}
                          onChange={(e) => setCustomActPrice(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 font-bold"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddCustomAct}
                          className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Liste des actes retenus avec prix unitaire, quantité, total et suppression */}
                {selectedActs.length === 0 ? (
                  <div className="text-center py-2.5 text-xs text-amber-800 font-medium bg-amber-50/70 rounded-lg border border-amber-200">
                    {actSelectionMode === 'CUSTOM'
                      ? '✍️ Saisissez l’intitulé et le tarif de votre prestation personnalisée ci-dessus.'
                      : '⚠️ Aucun acte sélectionné. Cliquez sur un des actes ci-dessus ou basculez en Prestation Hors Liste.'}
                  </div>
                ) : (
                  <div className="space-y-1.5 divide-y divide-slate-100">
                    {selectedActs.map((item) => (
                      <div
                        key={item.id}
                        className="pt-1.5 first:pt-0 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>{item.icon || '•'}</span>
                          <span className="font-bold text-slate-800 truncate">{item.name}</span>
                          {item.quantity > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-black text-[10px]">
                              x{item.quantity}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-extrabold text-slate-900">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedAct(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Retirer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Synthèse du Montant Total et Option Montant Manuel */}
                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Montant Total à Payer :
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomAmount(!isCustomAmount);
                        if (!isCustomAmount) setCustomTotalAmount(String(computedTotal));
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      {isCustomAmount ? '← Revenir au calcul auto' : 'Ajuster manuellement'}
                    </button>
                  </div>

                  {isCustomAmount ? (
                    <div className="relative w-40">
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={customTotalAmount}
                        onChange={(e) => setCustomTotalAmount(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm font-black text-slate-900 rounded-lg border border-blue-400 focus:outline-hidden focus:ring-2 focus:ring-blue-200 text-right pr-8"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Ar
                      </span>
                    </div>
                  ) : (
                    <div className="text-base font-black text-blue-700">
                      {formatCurrency(effectiveAmount)}
                    </div>
                  )}
                </div>
              </div>

              {/* Motif de visite + Option Consultation Week-end */}
              <div className="pt-1 space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Motif de visite (Optionnel — Néant par défaut)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Néant (ou ex: Fièvre, maux de tête, contrôle, bilan...)"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                {/* Coche Consultation Week-end (Verrouillée automatiquement Samedi & Dimanche) */}
                <label className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs transition-colors ${
                  isTodayWeekend ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${
                  isWeekendConsultation || isTodayWeekend
                    ? 'bg-violet-50 border-violet-300 text-violet-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/70'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isTodayWeekend ? true : isWeekendConsultation}
                      disabled={isTodayWeekend}
                      onChange={(e) => {
                        if (!isTodayWeekend) setIsWeekendConsultation(e.target.checked);
                      }}
                      className="w-4 h-4 rounded text-violet-600 border-violet-300 focus:ring-violet-500 disabled:opacity-80 disabled:cursor-not-allowed"
                    />
                    <div>
                      <span className="font-bold block">
                        Consultation Week-end (Samedi / Dimanche)
                        {isTodayWeekend && (
                          <span className="ml-1.5 text-[10px] font-black text-violet-700">
                            • Verrouillé automatiquement aujourd&apos;hui
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Impute l&apos;entrée dans la caisse séparée « Consultations Week-end » (Accueil ➔ Versement vers Grande Caisse Week-end).
                      </span>
                    </div>
                  </div>
                  {(isWeekendConsultation || isTodayWeekend) && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-600 text-white shrink-0">
                      {isTodayWeekend ? 'WEEK-END (AUTO)' : 'WEEK-END'}
                    </span>
                  )}
                </label>
              </div>
            </div>

            {/* SECTION 3 : PARAMÈTRES VITAUX (ACCORDÉON OPTIONNEL) */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowVitalsForm(!showVitalsForm)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold text-slate-800">
                    3. Prise des Constantes Vitales (Optionnel à l'accueil)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{showVitalsForm ? 'Masquer' : 'Renseigner maintenant'}</span>
                  {showVitalsForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {showVitalsForm && (
                <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-white space-y-3 animate-in fade-in">
                  <p className="text-[11px] text-slate-500 italic">
                    Note : Si ces champs sont laissés vides, des cases au format médical s'imprimeront automatiquement sur le volet navette pour que le praticien ou l'infirmier les remplisse au stylo.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Tension (TA)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="Syst"
                          value={vitalsData.systolicBP}
                          onChange={(e) => setVitalsData({ ...vitalsData, systolicBP: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-center"
                        />
                        <span>/</span>
                        <input
                          type="number"
                          placeholder="Diast"
                          value={vitalsData.diastolicBP}
                          onChange={(e) => setVitalsData({ ...vitalsData, diastolicBP: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-center"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Poids (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 65"
                        value={vitalsData.weight}
                        onChange={(e) => setVitalsData({ ...vitalsData, weight: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Taille (cm)</label>
                      <input
                        type="number"
                        placeholder="Ex: 170"
                        value={vitalsData.height}
                        onChange={(e) => setVitalsData({ ...vitalsData, height: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Température (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 37.2"
                        value={vitalsData.temperature}
                        onChange={(e) => setVitalsData({ ...vitalsData, temperature: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Pouls (bpm)</label>
                      <input
                        type="number"
                        placeholder="Ex: 78"
                        value={vitalsData.heartRate}
                        onChange={(e) => setVitalsData({ ...vitalsData, heartRate: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">SpO2 (%)</label>
                      <input
                        type="number"
                        placeholder="Ex: 98"
                        value={vitalsData.oxygenSaturation}
                        onChange={(e) => setVitalsData({ ...vitalsData, oxygenSaturation: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Glycémie (g/L)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 0.95"
                        value={vitalsData.bloodSugar}
                        onChange={(e) => setVitalsData({ ...vitalsData, bloodSugar: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Notes / Allergies</label>
                      <input
                        type="text"
                        placeholder="Allergies..."
                        value={vitalsData.notes}
                        onChange={(e) => setVitalsData({ ...vitalsData, notes: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 4 : RÈGLEMENT & ENCAISSEMENT */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>4. Mode de Règlement</span>
              </label>

              {/* Modes de paiement */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CASH', label: 'Espèces', icon: Banknote },
                  { id: 'MVOLA', label: 'MVola', icon: Smartphone },
                  { id: 'ORANGE_MONEY', label: 'Orange Money', icon: Smartphone },
                  { id: 'CARD', label: 'Carte / Chèque', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 font-bold text-xs transition-all ${
                        paymentMethod === m.id
                          ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-slate-500" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* COCHE 0 Ar : Consultation Gratuite / Prise en charge clinique */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 hover:bg-amber-50 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={isFreeConsultation}
                  onChange={(e) => setIsFreeConsultation(e.target.checked)}
                  className="w-5 h-5 text-amber-600 rounded border-amber-400 focus:ring-amber-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-900 uppercase tracking-wide">
                      🎁 Consultation Gratuite (0 Ar) • Prise en charge clinique
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900">
                      Exonération
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 mt-0.5">
                    Cocher cette case si le patient bénéficie d’une consultation offerte ou gracieuse par la clinique. Le ticket s’imprimera en mention <strong>GRATUITÉ (0 Ar)</strong>.
                  </p>
                </div>
              </label>

              {/* Total de paiement */}
              <div className={`p-4 rounded-xl border flex items-center justify-between shadow-xs transition-all ${
                isFreeConsultation
                  ? 'bg-amber-100/90 border-amber-300 text-amber-950 ring-2 ring-amber-400'
                  : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
              }`}>
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                    isFreeConsultation ? 'text-amber-900' : 'text-emerald-800'
                  }`}>
                    {isFreeConsultation ? 'Montant Patient (Exonéré 100%)' : 'Total de Paiement'}
                  </span>
                  <span className={`text-xs font-medium ${
                    isFreeConsultation ? 'text-amber-700' : 'text-emerald-600'
                  }`}>
                    {isFreeConsultation
                      ? '★ Consultation Gratuite (0 Ar) enregistrée au comptoir'
                      : `Règlement par ${paymentMethod === 'CASH' ? 'Espèces' : paymentMethod === 'MVOLA' ? 'MVola' : paymentMethod === 'ORANGE_MONEY' ? 'Orange Money' : paymentMethod === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Carte / Chèque'}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-black tracking-tight ${
                    isFreeConsultation ? 'text-amber-900' : 'text-emerald-700'
                  }`}>
                    {formatCurrency(effectiveAmount)}
                  </span>
                </div>
              </div>

              {/* Référence pour les paiements électroniques si applicable (NON OBLIGATOIRE) */}
              {paymentMethod !== 'CASH' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Référence de transaction ({paymentMethod === 'MVOLA' ? 'MVola' : paymentMethod === 'ORANGE_MONEY' ? 'Orange Money' : paymentMethod === 'AIRTEL_MONEY' ? 'Airtel Money' : paymentMethod})
                    </label>
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Optionnel (inscriptible à la main sur le ticket)
                    </span>
                  </div>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Laisser vide pour remplir au stylo sur le ticket imprimé (ex: MV-9485...)"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400"
                  />
                </div>
              )}
            </div>

            {/* BOUTON D'ACTION PRINCIPAL */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl font-extrabold text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Enregistrement &amp; Génération du Ticket...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    <span>Encaisser {formatCurrency(effectiveAmount)} &amp; Imprimer Ticket (2 Volets)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* COLONNE DROITE : DERNIERS ENCAISSEMENTS DU JOUR (5 colonnes) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Encaissements du Jour ({consultations.length})</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Tickets émis aujourd'hui • Réimpression en 1 clic
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
            {consultations.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Aucun encaissement de consultation enregistré aujourd'hui.
              </div>
            ) : (
              consultations.map((c, index) => {
                const patName = `${c.patient.lastName.toUpperCase()} ${c.patient.firstName}`;
                const consultAmount = c.invoice?.totalAmount || 15000;
                const orderNum = String(consultations.length - index).padStart(3, '0');

                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 font-black text-slate-800 text-xs flex items-center justify-center shrink-0 border border-slate-200">
                        #{orderNum}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 text-xs truncate">
                          {patName}
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate">
                          {c.reason || 'Consultation'} • {c.patient.patientNumber}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
                          {formatCurrency(consultAmount)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleReprintFromHistory(c)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1 shrink-0"
                      title="Réimprimer le ticket thermique"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Ticket</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Modal Prévisualisation & Impression Ticket Thermique 2 Volets */}
      {previewTicketData && (
        <ConsultationDualTicketPreview
          ticketData={previewTicketData}
          onClose={() => setPreviewTicketData(null)}
          isNewPayment={isNewTicket}
        />
      )}

      {/* Modal Gestion de la Grille Tarifaire des Actes (Administrateurs uniquement) */}
      {isAdmin && showActsModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowActsModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200 cursor-pointer"
        >
          <div className="relative w-full max-w-2xl my-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <span>Gestion des Tarifs &amp; Actes Médicaux</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modifiez les prix, ajoutez ou supprimez des actes. Pris en compte immédiatement à la caisse et sur les tickets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowActsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            {actsModalError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{actsModalError}</span>
              </div>
            )}
            {actsModalSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{actsModalSuccess}</span>
              </div>
            )}

            {/* Corps défilant du modal */}
            <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Formulaire d'ajout d'un nouvel acte */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5">
                <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ajouter un nouvel acte médical à la grille</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Icône</label>
                    <select
                      value={newActForm.icon}
                      onChange={(e) => setNewActForm({ ...newActForm, icon: e.target.value })}
                      className="w-full px-2 py-2 text-sm rounded-lg border border-slate-200 bg-white text-center"
                    >
                      {['🩺', '👨‍⚕️', '🚨', '🔄', '🩹', '💉', '🔬', '🩻', '🦷', '👶', '🤰', '💊', '🚑', '🌡️'].map((emoji) => (
                        <option key={emoji} value={emoji}>
                          {emoji}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Libellé de l'acte *</label>
                    <input
                      type="text"
                      placeholder="Ex: Échographie, Pose plâtre, Pansement..."
                      value={newActForm.name}
                      onChange={(e) => setNewActForm({ ...newActForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-4 flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Prix (Ar) *</label>
                      <input
                        type="number"
                        placeholder="Ex: 30000"
                        value={newActForm.price}
                        onChange={(e) => setNewActForm({ ...newActForm, price: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNewActToModal}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors h-[34px] shrink-0"
                    >
                      + Ajouter
                    </button>
                  </div>
                </div>
              </div>

              {/* Liste des actes existants modifiables */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Grille actuelle des actes ({editingActs.length})</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Vous pouvez modifier directement le nom et le montant ci-dessous
                  </span>
                </div>

                <div className="space-y-2">
                  {editingActs.map((act) => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-center gap-2.5"
                    >
                      {/* Icône */}
                      <select
                        value={act.icon || '🩺'}
                        onChange={(e) => handleUpdateActInModal(act.id, 'icon', e.target.value)}
                        className="w-12 px-1 py-1.5 text-base rounded-lg border border-slate-200 bg-slate-50 text-center shrink-0"
                      >
                        {['🩺', '👨‍⚕️', '🚨', '🔄', '🩹', '💉', '🔬', '🩻', '🦷', '👶', '🤰', '💊', '🚑', '🌡️'].map((emoji) => (
                          <option key={emoji} value={emoji}>
                            {emoji}
                          </option>
                        ))}
                      </select>

                      {/* Nom de l'acte */}
                      <input
                        type="text"
                        value={act.name}
                        onChange={(e) => handleUpdateActInModal(act.id, 'name', e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs font-bold text-slate-800 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                        placeholder="Nom de l'acte"
                      />

                      {/* Prix de l'acte */}
                      <div className="relative w-32 shrink-0">
                        <input
                          type="number"
                          step={500}
                          value={act.price}
                          onChange={(e) => handleUpdateActInModal(act.id, 'price', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-black text-blue-700 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 text-right pr-7"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          Ar
                        </span>
                      </div>

                      {/* Suppression */}
                      <button
                        type="button"
                        onClick={() => handleDeleteActFromModal(act.id)}
                        disabled={editingActs.length <= 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                        title="Supprimer cet acte"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Modal Actions */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetActsToDefault}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurer les 5 actes par défaut</span>
              </button>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowActsModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={savingActs}
                  onClick={handleSaveActsModal}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingActs ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Enregistrer la Grille</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
