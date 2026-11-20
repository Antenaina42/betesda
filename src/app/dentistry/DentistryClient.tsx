'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Smile,
  PlusCircle,
  Edit2,
  Trash2,
  Search,
  DollarSign,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  X,
  Stethoscope,
  TrendingUp,
  Receipt,
  User,
  Calendar,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { AuthUser } from '@/lib/auth';

interface DentalAct {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface DentistryClientProps {
  clinic: any;
  currentUser: AuthUser;
  initialDentalActs: DentalAct[];
  initialConsultations: any[];
  initialTransactions: any[];
}

export default function DentistryClient({
  clinic,
  currentUser,
  initialDentalActs,
  initialConsultations,
  initialTransactions,
}: DentistryClientProps) {
  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'CLINIC_ADMIN';

  const [activeTab, setActiveTab] = useState<'acts' | 'history'>('acts');
  const [dentalActs, setDentalActs] = useState<DentalAct[]>(initialDentalActs);
  const [searchAct, setSearchAct] = useState('');

  // Modals CRUD
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAct, setEditingAct] = useState<DentalAct | null>(null);
  const [actToDelete, setActToDelete] = useState<DentalAct | null>(null);

  const [actForm, setActForm] = useState({
    name: '',
    price: '',
    description: '',
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Total recettes dentisterie
  const totalConsultationsIncome = initialConsultations.reduce((sum, c) => {
    const paid = c.invoice?.payments?.reduce((pSum: number, p: any) => pSum + p.amount, 0) || c.invoice?.totalAmount || 0;
    return sum + paid;
  }, 0);

  const handleOpenCreateModal = () => {
    setEditingAct(null);
    setActForm({
      name: '',
      price: '',
      description: '',
      isActive: true,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (act: DentalAct) => {
    setEditingAct(act);
    setActForm({
      name: act.name,
      price: String(act.price),
      description: act.description || '',
      isActive: act.isActive,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setModalOpen(true);
  };

  const handleSubmitAct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (editingAct) {
        const res = await fetch('/api/dentistry/acts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingAct.id,
            name: actForm.name,
            price: actForm.price,
            description: actForm.description,
            isActive: actForm.isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la modification');

        setDentalActs((prev) => prev.map((a) => (a.id === editingAct.id ? data.act : a)));
        setSuccessMsg(`✓ Soin dentaire « ${data.act.name} » mis à jour avec succès !`);
      } else {
        const res = await fetch('/api/dentistry/acts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');

        setDentalActs((prev) => [data.act, ...prev]);
        setSuccessMsg(`✓ Nouveau soin dentaire « ${data.act.name} » ajouté au catalogue !`);
      }

      setTimeout(() => {
        setModalOpen(false);
        setEditingAct(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAct = async () => {
    if (!actToDelete) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/dentistry/acts?id=${actToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur suppression');

      setDentalActs((prev) => prev.filter((a) => a.id !== actToDelete.id));
      setSuccessMsg(`✓ Soin « ${actToDelete.name} » supprimé.`);
      setActToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur suppression');
    } finally {
      setLoading(false);
    }
  };

  const filteredActs = dentalActs.filter((a) => {
    const q = searchAct.toLowerCase();
    return !searchAct || a.name.toLowerCase().includes(q) || (a.description && a.description.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Messages */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">Actes &amp; Soins</span>
            <span>/</span>
            <span className="text-teal-700 font-semibold">Cabinet Dentaire</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight flex items-center gap-2.5">
            <Smile className="w-7 h-7 text-teal-600" />
            <span>Cabinet Dentaire : Consultations &amp; Soins des Dents</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestion du catalogue des soins dentaires (Action &amp; Tarif) et suivi des consultations bucco-dentaires.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Nouveau Soin Dentaire</span>
          </button>
        )}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Catalogue des Soins</div>
          <div className="text-2xl font-black text-teal-700 mt-1">{dentalActs.length} actes</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Disponibles lors de l'encaissement à l'accueil</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Consultations Réalisées</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{initialConsultations.length}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Patients soignés au cabinet dentaire</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Recettes Estimées</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(totalConsultationsIncome)}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Total encaissé sur les soins dentaires</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('acts')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            activeTab === 'acts'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Smile className="w-4 h-4" />
          <span>Grille Tarifaire des Soins ({dentalActs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Historique des Soins &amp; Patients ({initialConsultations.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : GRILLE TARIFAIRE DES SOINS (ACTION, TARIF, CRUD)               */}
      {/* ========================================================================= */}
      {activeTab === 'acts' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchAct}
                onChange={(e) => setSearchAct(e.target.value)}
                placeholder="Rechercher une action, extraction, détartrage..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              {filteredActs.length} soin(s) trouvé(s)
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Action / Soin Dentaire</th>
                  <th className="py-3 px-4">Description / Détails</th>
                  <th className="py-3 px-4 text-right">Tarif Unitaire</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Aucun soin dentaire trouvé dans le catalogue.
                    </td>
                  </tr>
                ) : (
                  filteredActs.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Smile className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>{act.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {act.description || <span className="text-slate-300 italic">Aucune mention</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-teal-800 text-sm font-mono">
                        {formatCurrency(act.price)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {act.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            Désactivé
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(act)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setActToDelete(act)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : HISTORIQUE DES CONSULTATIONS & SOINS DENTAIRES                 */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-teal-600" />
              <span>Historique des Soins Dentaires Réalisés</span>
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              Total recettes : {formatCurrency(totalConsultationsIncome)}
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Motif / Soin Dentaire</th>
                  <th className="py-2.5 px-3">Praticien</th>
                  <th className="py-2.5 px-3 text-right">Montant Réglé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialConsultations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Aucune consultation dentaire enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  initialConsultations.map((c) => {
                    const paid = c.invoice?.payments?.reduce((s: number, p: any) => s + p.amount, 0) || c.invoice?.totalAmount || 0;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {formatDateTime(c.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">
                          {c.patient ? (
                            <div>
                              <span>{c.patient.lastName} {c.patient.firstName}</span>
                              {c.patient.phone && <span className="block text-[10px] font-normal text-slate-400">📞 {c.patient.phone}</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Patient de passage</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <span className="inline-block px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[11px]">
                            {c.reason || 'Soin dentaire'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {c.doctor?.user ? `Dr. ${c.doctor.user.firstName} ${c.doctor.user.lastName}` : 'Dentiste de garde'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono">
                          {formatCurrency(paid)}
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

      {/* ========================================================================= */}
      {/* MODAL : AJOUT / MODIFICATION D'UN SOIN DENTAIRE (ACTION & TARIF)          */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Smile className="w-5 h-5 text-teal-600" />
                <span>{editingAct ? 'Modifier le Soin Dentaire' : 'Ajouter un Soin Dentaire'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Action / Intitulé du Soin Dentaire *
                </label>
                <input
                  type="text"
                  required
                  value={actForm.name}
                  onChange={(e) => setActForm({ ...actForm, name: e.target.value })}
                  placeholder="Ex: Extraction dentaire simple, Détartrage..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-teal-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tarif (Ariary) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="500"
                  value={actForm.price}
                  onChange={(e) => setActForm({ ...actForm, price: e.target.value })}
                  placeholder="Ex: 30000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-teal-500 font-bold font-mono text-teal-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description / Remarques (Optionnel)
                </label>
                <input
                  type="text"
                  value={actForm.description}
                  onChange={(e) => setActForm({ ...actForm, description: e.target.value })}
                  placeholder="Ex: Anesthésie locale incluse, par arcade..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="actActive"
                  checked={actForm.isActive}
                  onChange={(e) => setActForm({ ...actForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                />
                <label htmlFor="actActive" className="font-semibold text-slate-700 cursor-pointer">
                  Soin actif (affiché à l'accueil pour encaissement)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black shadow-xs transition-colors"
                >
                  {loading ? 'Enregistrement...' : editingAct ? 'Enregistrer les modifications' : 'Ajouter le soin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION SUPPRESSION SOIN DENTAIRE */}
      {actToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <h4 className="font-extrabold text-slate-900 text-sm">Confirmer la suppression</h4>
            <p className="text-xs text-slate-600">
              Voulez-vous vraiment supprimer le soin dentaire <strong>« {actToDelete.name} »</strong> ({formatCurrency(actToDelete.price)}) ?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setActToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleDeleteAct}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {loading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
