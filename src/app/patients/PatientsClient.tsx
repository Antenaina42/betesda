'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  PlusCircle,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  AlertTriangle,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  ShoppingCart,
  UserCheck,
  Stethoscope,
  Filter,
  ShieldAlert,
} from 'lucide-react';
import { calculateAge, formatDate, formatDoctorName } from '@/lib/formatters';

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
  gender: 'MALE' | 'FEMALE';
  birthDate: string | Date;
  bloodGroup?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  idCardNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRel?: string | null;
  primaryDoctorId?: string | null;
  primaryDoctor?: DoctorItem | null;
  medicalRecord?: {
    allergies?: string | null;
    chronicDiseases?: string | null;
    surgicalHistory?: string | null;
    familyHistory?: string | null;
    habits?: string | null;
    generalNotes?: string | null;
  } | null;
  createdAt: string | Date;
  _count?: {
    consultations?: number;
    prescriptions?: number;
    invoices?: number;
  };
}

interface PatientsClientProps {
  initialPatients: any[];
  doctors: DoctorItem[];
  userRole?: string;
}

const BLOOD_GROUPS = [
  'Non défini',
  'O+',
  'O-',
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
];

export default function PatientsClient({
  initialPatients,
  doctors,
  userRole,
}: PatientsClientProps) {
  const [patients, setPatients] = useState<PatientItem[]>(initialPatients);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');
  const [bloodGroupFilter, setBloodGroupFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Modal State
  const [editingPatient, setEditingPatient] = useState<PatientItem | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal State
  const [deletingPatient, setDeletingPatient] = useState<PatientItem | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Helper Toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  // Filtrage combiné
  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      // Recherche textuelle
      if (q) {
        const fullName = `${p.lastName} ${p.firstName}`.toLowerCase();
        const reversedFullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        const num = (p.patientNumber || '').toLowerCase();
        const ph = (p.phone || '').toLowerCase();
        const city = (p.city || '').toLowerCase();

        const matches =
          fullName.includes(q) ||
          reversedFullName.includes(q) ||
          num.includes(q) ||
          ph.includes(q) ||
          city.includes(q);

        if (!matches) return false;
      }

      // Filtre Sexe
      if (genderFilter !== 'ALL' && p.gender !== genderFilter) {
        return false;
      }

      // Filtre Groupe Sanguin
      if (bloodGroupFilter !== 'ALL') {
        const bg = p.bloodGroup || 'Non défini';
        if (bg !== bloodGroupFilter) return false;
      }

      return true;
    });
  }, [patients, search, genderFilter, bloodGroupFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / pageSize) || 1;
  const paginatedPatients = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, page, pageSize]);

  // Ouvrir le modal d'édition
  const handleOpenEdit = (p: PatientItem) => {
    const bDate = p.birthDate
      ? new Date(p.birthDate).toISOString().split('T')[0]
      : '';

    setEditingPatient(p);
    setEditFormData({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      gender: p.gender || 'MALE',
      birthDate: bDate,
      bloodGroup: p.bloodGroup || 'Non défini',
      phone: p.phone || '',
      email: p.email || '',
      address: p.address || '',
      city: p.city || 'Antananarivo',
      idCardNumber: p.idCardNumber || '',
      emergencyContactName: p.emergencyContactName || '',
      emergencyContactPhone: p.emergencyContactPhone || '',
      emergencyContactRel: p.emergencyContactRel || '',
      primaryDoctorId: p.primaryDoctorId || '',
      allergies: p.medicalRecord?.allergies || '',
      chronicDiseases: p.medicalRecord?.chronicDiseases || '',
      generalNotes: p.medicalRecord?.generalNotes || '',
    });
  };

  // Sauvegarder les modifications
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    if (!editFormData.lastName?.trim() || !editFormData.firstName?.trim()) {
      showToast('error', 'Le nom et le prénom du patient sont obligatoires.');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/patients/${editingPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour.');
      }

      // Mettre à jour l'état local immédiatement
      setPatients((prev) =>
        prev.map((item) => (item.id === data.id ? { ...item, ...data } : item))
      );

      setEditingPatient(null);
      showToast('success', `Dossier du patient ${data.lastName.toUpperCase()} ${data.firstName} mis à jour avec succès !`);
    } catch (err: any) {
      showToast('error', err.message || 'Impossible de mettre à jour le patient.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Supprimer un patient (Soft-delete)
  const handleConfirmDelete = async () => {
    if (!deletingPatient) return;

    setDeletingLoading(true);
    try {
      const res = await fetch(`/api/patients/${deletingPatient.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression.');
      }

      // Retirer de la liste locale
      setPatients((prev) => prev.filter((p) => p.id !== deletingPatient.id));
      const deletedName = `${deletingPatient.lastName.toUpperCase()} ${deletingPatient.firstName}`;
      setDeletingPatient(null);
      showToast('success', `Le dossier de ${deletedName} a été archivé et supprimé de la liste.`);
    } catch (err: any) {
      showToast('error', err.message || 'Impossible de supprimer le patient.');
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-md animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 rounded-md hover:bg-black/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barre de Recherche et Filtres */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Recherche textuelle */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par nom, prénom, N° dossier (PAT-XXXX), téléphone ou ville..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 bg-slate-50/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtre Genre */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Sexe :</label>
            <select
              value={genderFilter}
              onChange={(e: any) => {
                setGenderFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">Tous les sexes</option>
              <option value="MALE">Masculin</option>
              <option value="FEMALE">Féminin</option>
            </select>
          </div>

          {/* Filtre Groupe Sanguin */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Groupe :</label>
            <select
              value={bloodGroupFilter}
              onChange={(e) => {
                setBloodGroupFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">Tous les groupes</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          {/* Réinitialisation */}
          {(search || genderFilter !== 'ALL' || bloodGroupFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setGenderFilter('ALL');
                setBloodGroupFilter('ALL');
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* Compteur de résultats */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Affichage de <strong>{paginatedPatients.length}</strong> sur <strong>{filteredPatients.length}</strong> patient(s) trouvé(s)
          </span>
          {patients.length !== filteredPatients.length && (
            <span className="text-blue-600 font-semibold">
              Filtre actif ({patients.length} dossiers au total dans la clinique)
            </span>
          )}
        </div>
      </div>

      {/* Tableau des Patients avec CRUD complet */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">N° Dossier</th>
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Âge / Sexe</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Adresse</th>
                <th className="py-3.5 px-4">Médecin Traitant</th>
                <th className="py-3.5 px-4 text-center">Raccourcis Caisse</th>
                <th className="py-3.5 px-4 text-right">Actions CRUD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">Aucun patient correspondant</p>
                    <p className="text-[11px] mt-0.5">Modifiez vos critères de recherche ou ajoutez un nouveau patient.</p>
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((p) => {
                  const age = calculateAge(p.birthDate);
                  const isMale = p.gender === 'MALE';
                  const docDisplay = p.primaryDoctor ? formatDoctorName(p.primaryDoctor) : '—';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      {/* ID Dossier */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200/60 inline-block text-[11px]">
                          {p.patientNumber}
                        </span>
                      </td>

                      {/* Patient Avatar & Nom */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 border ${
                              isMale
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {(p.firstName?.[0] || 'P').toUpperCase()}
                            {(p.lastName?.[0] || '').toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                              {p.lastName.toUpperCase()} {p.firstName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  p.bloodGroup && p.bloodGroup !== 'Non défini'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {p.bloodGroup || 'Non défini'}
                              </span>
                              {p.medicalRecord?.allergies && p.medicalRecord.allergies !== 'Aucune' && (
                                <span className="text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Allergies</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Âge / Sexe */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <span className="font-bold">{age ? `${age} ans` : '—'}</span>
                        <span className="text-slate-400 text-[10.5px] block font-medium">
                          {isMale ? 'Masculin' : 'Féminin'} • {formatDate(p.birthDate)}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.phone || '—'}</span>
                        </div>
                        {p.email && (
                          <span className="text-[10.5px] text-slate-400 block truncate max-w-[140px]">
                            {p.email}
                          </span>
                        )}
                      </td>

                      {/* Adresse */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[130px]">{p.address || p.city || 'Antananarivo'}</span>
                        </div>
                      </td>

                      {/* Médecin traitant */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px] font-medium" title={docDisplay}>
                            {docDisplay}
                          </span>
                        </div>
                      </td>

                      {/* Raccourcis Caisse Rapides */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/consultations/caisse?patientId=${p.id}`}
                            className="px-2 py-1 rounded-lg text-[10.5px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1"
                            title="Ouvrir l'encaissement consultation pour ce patient"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Ticket Consult</span>
                          </Link>

                          <Link
                            href={`/pharmacy/sales?patientId=${p.id}`}
                            className="px-2 py-1 rounded-lg text-[10.5px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1"
                            title="Vente pharmacie pour ce patient"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Pharma</span>
                          </Link>
                        </div>
                      </td>

                      {/* Actions CRUD (Modifier, Supprimer) */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Modifier (Modal CRUD) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 transition-colors border border-transparent hover:border-amber-200"
                            title="Modifier les informations du patient"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Supprimer (Modal CRUD avec soft delete) */}
                          <button
                            type="button"
                            onClick={() => setDeletingPatient(p)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200"
                            title="Archiver / Supprimer ce patient"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page <strong>{page}</strong> sur <strong>{totalPages}</strong> ({filteredPatients.length} patients)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold disabled:opacity-40 disabled:hover:bg-white transition-all"
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold disabled:opacity-40 disabled:hover:bg-white transition-all"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1 : MODIFICATION DU DOSSIER PATIENT (CRUD UPDATE)       */}
      {/* ============================================================== */}
      {editingPatient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEdit) setEditingPatient(null);
          }}
        >
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">
                    Modifier le Patient : {editingPatient.lastName.toUpperCase()} {editingPatient.firstName}
                  </h3>
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {editingPatient.patientNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mise à jour des coordonnées civiles, médicales et médecin référent
                </p>
              </div>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditingPatient(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Section 1: État Civil */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wide block">
                  1. État Civil & Identité
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nom de famille *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Prénom(s) *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.firstName}
                      onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Sexe biologique *</label>
                    <select
                      value={editFormData.gender}
                      onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="MALE">Masculin</option>
                      <option value="FEMALE">Féminin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date de naissance *</label>
                    <input
                      type="date"
                      required
                      value={editFormData.birthDate}
                      onChange={(e) => setEditFormData({ ...editFormData, birthDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Groupe Sanguin</label>
                    <select
                      value={editFormData.bloodGroup}
                      onChange={(e) => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">N° CIN / Pièce d'identité</label>
                    <input
                      type="text"
                      placeholder="Ex: 101 254 895 124"
                      value={editFormData.idCardNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, idCardNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Coordonnées & Adresse */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wide block">
                  2. Coordonnées & Localisation
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Téléphone Principal *</label>
                    <input
                      type="tel"
                      required
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Adresse Email</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      placeholder="nom@exemple.mg"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Adresse (Lot / Rue / Quartier)</label>
                    <input
                      type="text"
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      placeholder="Ex: Lot II B 45 Antanimena"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ville</label>
                    <input
                      type="text"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      placeholder="Antananarivo"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Contact d'urgence & Médecin Référent */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wide block">
                  3. Contact d'Urgence & Médecin Traitant
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contact d'urgence (Nom)</label>
                    <input
                      type="text"
                      value={editFormData.emergencyContactName}
                      onChange={(e) => setEditFormData({ ...editFormData, emergencyContactName: e.target.value })}
                      placeholder="Ex: Rasoa Marie"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Téléphone d'urgence</label>
                    <input
                      type="tel"
                      value={editFormData.emergencyContactPhone}
                      onChange={(e) => setEditFormData({ ...editFormData, emergencyContactPhone: e.target.value })}
                      placeholder="+261 34 ..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Lien de parenté</label>
                    <input
                      type="text"
                      value={editFormData.emergencyContactRel}
                      onChange={(e) => setEditFormData({ ...editFormData, emergencyContactRel: e.target.value })}
                      placeholder="Ex: Conjoint, Mère, Frère..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block font-bold text-slate-700 mb-1">Médecin Référent Attitré</label>
                  <select
                    value={editFormData.primaryDoctorId}
                    onChange={(e) => setEditFormData({ ...editFormData, primaryDoctorId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="">-- Aucun médecin assigné --</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {formatDoctorName(doc)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section 4: Antécédents & Notes */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wide block">
                  4. Allergies & Antécédents Médicaux
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Allergies connues</label>
                    <input
                      type="text"
                      value={editFormData.allergies}
                      onChange={(e) => setEditFormData({ ...editFormData, allergies: e.target.value })}
                      placeholder="Ex: Pénicilline, Sulfamides, Aspirine..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Pathologies / Maladies chroniques</label>
                    <input
                      type="text"
                      value={editFormData.chronicDiseases}
                      onChange={(e) => setEditFormData({ ...editFormData, chronicDiseases: e.target.value })}
                      placeholder="Ex: Diabète type 2, HTA, Asthme..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes générales de suivi</label>
                  <textarea
                    rows={2}
                    value={editFormData.generalNotes}
                    onChange={(e) => setEditFormData({ ...editFormData, generalNotes: e.target.value })}
                    placeholder="Observations particulières sur le patient..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingPatient(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl font-extrabold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Enregistrer les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2 : CONFIRMATION SUPPRESSION PATIENT (CRUD DELETE)       */}
      {/* ============================================================== */}
      {deletingPatient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingLoading) setDeletingPatient(null);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-200">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Confirmer la suppression
                </h3>
                <p className="text-xs text-rose-600 font-medium mt-0.5">
                  Action réversible par l’administrateur
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <p>
                Êtes-vous sûr de vouloir supprimer et archiver le dossier de :
              </p>
              <p className="font-extrabold text-sm text-slate-900">
                {deletingPatient.lastName.toUpperCase()} {deletingPatient.firstName}
              </p>
              <p className="font-mono text-[11px] text-blue-700">
                Dossier N° : {deletingPatient.patientNumber}
              </p>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Le patient ne figurera plus dans la liste active de la clinique. Ses consultations, ordonnances et factures antérieures restent archivées en conformité avec les règles médico-légales.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deletingLoading}
                onClick={() => setDeletingPatient(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors text-xs"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={deletingLoading}
                onClick={handleConfirmDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20 transition-all text-xs disabled:opacity-50"
              >
                {deletingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer ce patient</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
