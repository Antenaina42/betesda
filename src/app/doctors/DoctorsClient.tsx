'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Stethoscope,
  PlusCircle,
  Search,
  Phone,
  Mail,
  Clock,
  Award,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  Calendar,
  FileText,
  PauseCircle,
} from 'lucide-react';
import { AuthUser } from '@/types';

export interface DoctorItem {
  id: string;
  userId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  licenseNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  bio?: string | null;
  workingHours?: string | null;
  isActive: boolean;
  specialtyId?: string | null;
  specialtyName?: string | null;
  user?: {
    firstName: string;
    lastName: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  specialty?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    consultations: number;
    appointments: number;
    prescriptions: number;
  };
}

interface SpecialtyItem {
  id: string;
  name: string;
}

interface DoctorsClientProps {
  user: AuthUser;
  initialDoctors: DoctorItem[];
  specialties: SpecialtyItem[];
}

export default function DoctorsClient({
  user,
  initialDoctors,
  specialties: initialSpecialties,
}: DoctorsClientProps) {
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'CLINIC_ADMIN';

  const [doctors, setDoctors] = useState<DoctorItem[]>(initialDoctors);
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>(initialSpecialties);
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [formData, setFormData] = useState({
    title: 'Dr.',
    firstName: '',
    lastName: '',
    specialtyId: initialSpecialties[0]?.id || '',
    specialtyName: '',
    licenseNumber: '',
    phone: '',
    email: '',
    workingHours: 'Lun - Ven: 08h00 - 17h00',
    bio: '',
    isActive: true,
  });

  const getDoctorName = (doc: DoctorItem) => {
    const t = doc.title || 'Dr.';
    if (doc.firstName || doc.lastName) {
      return `${t} ${doc.firstName || ''} ${doc.lastName || ''}`.trim();
    }
    if (doc.user) {
      return `${t} ${doc.user.firstName} ${doc.user.lastName}`.trim();
    }
    return `${t} Praticien`;
  };

  const getDoctorSpecialty = (doc: DoctorItem) => {
    return doc.specialty?.name || doc.specialtyName || 'Médecine Générale';
  };

  const getDoctorPhone = (doc: DoctorItem) => {
    return doc.phone || doc.user?.phone || 'Non renseigné';
  };

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const name = getDoctorName(doc).toLowerCase();
      const spec = getDoctorSpecialty(doc).toLowerCase();
      const phone = getDoctorPhone(doc);
      const lic = (doc.licenseNumber || '').toLowerCase();
      const q = search.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || spec.includes(q) || phone.includes(q) || lic.includes(q);
      const matchesSpec = !selectedSpecialty || (doc.specialtyId === selectedSpecialty || doc.specialty?.name === selectedSpecialty);

      return matchesSearch && matchesSpec;
    });
  }, [doctors, search, selectedSpecialty]);

  const handleOpenCreateModal = () => {
    setEditingDoctor(null);
    setFormData({
      title: 'Dr.',
      firstName: '',
      lastName: '',
      specialtyId: specialties[0]?.id || '',
      specialtyName: '',
      licenseNumber: '',
      phone: '',
      email: '',
      workingHours: 'Lun - Ven: 08h00 - 17h00',
      bio: '',
      isActive: true,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (doc: DoctorItem) => {
    setEditingDoctor(doc);
    setFormData({
      title: doc.title || 'Dr.',
      firstName: doc.firstName || doc.user?.firstName || '',
      lastName: doc.lastName || doc.user?.lastName || '',
      specialtyId: doc.specialtyId || doc.specialty?.id || '',
      specialtyName: doc.specialtyName || doc.specialty?.name || '',
      licenseNumber: doc.licenseNumber || '',
      phone: doc.phone || doc.user?.phone || '',
      email: doc.email || doc.user?.email || '',
      workingHours: doc.workingHours || 'Lun - Ven: 08h00 - 17h00',
      bio: doc.bio || '',
      isActive: doc.isActive !== false,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (editingDoctor) {
        // Edit doctor
        const res = await fetch(`/api/doctors/${editingDoctor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la modification');

        setDoctors((prev) =>
          prev.map((d) => (d.id === editingDoctor.id ? { ...d, ...data.doctor } : d))
        );
        setSuccessMsg(`Fiche du ${getDoctorName(data.doctor)} mise à jour avec succès !`);
        setTimeout(() => setModalOpen(false), 1200);
      } else {
        // Create doctor
        const res = await fetch('/api/doctors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');

        setDoctors((prev) => [data.doctor, ...prev]);
        if (data.doctor.specialty && !specialties.some((s) => s.id === data.doctor.specialty.id)) {
          setSpecialties((prev) => [...prev, data.doctor.specialty]);
        }
        setSuccessMsg(`Le ${getDoctorName(data.doctor)} a été ajouté avec succès au corps médical !`);
        setTimeout(() => setModalOpen(false), 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoctor = async (doc: DoctorItem) => {
    const docName = getDoctorName(doc);
    if (!confirm(`Êtes-vous certain de vouloir retirer le ${docName} du répertoire des médecins ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/doctors/${doc.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression');

      // Update state
      if (data.message && data.message.includes('désactivé')) {
        setDoctors((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, isActive: false } : d))
        );
      } else {
        setDoctors((prev) => prev.filter((d) => d.id !== doc.id));
      }
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  const totalConsultations = doctors.reduce((acc, d) => acc + (d._count?.consultations || 0), 0);
  const activeDoctorsCount = doctors.filter((d) => d.isActive !== false).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">Administration</span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">Corps Médical</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight flex items-center gap-2.5">
            <Stethoscope className="w-6 h-6 text-blue-600" />
            <span>Gestion des Médecins ({doctors.length})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Répertoire des praticiens hospitaliers et médecins consultants (sélectionnables en Caisse Consultation &amp; Fiche Navette)
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouveau Médecin</span>
          </button>
        )}
      </div>

      {/* Bannière Module en pause */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-900 text-xs shadow-xs">
        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <PauseCircle className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold">Module en pause :</span> La gestion des médecins et l'assignation nominative sont actuellement mises en pause. Le module a été retiré du menu principal et les créations de consultation s'effectuent directement sans sélection obligatoire de praticien.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Médecins Actifs</p>
            <p className="text-xl font-black text-slate-900">{activeDoctorsCount}</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Spécialités Couvertes</p>
            <p className="text-xl font-black text-slate-900">{specialties.length}</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Consultations Réalisées</p>
            <p className="text-xl font-black text-emerald-700">{totalConsultations}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un médecin par nom, spécialité, contact ou N° d'ordre..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedSpecialty('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              !selectedSpecialty ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Toutes spécialités
          </button>
          {specialties.map((spec) => (
            <button
              key={spec.id}
              type="button"
              onClick={() => setSelectedSpecialty(spec.name === selectedSpecialty ? '' : spec.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedSpecialty === spec.name ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {spec.name}
            </button>
          ))}
        </div>
      </div>

      {/* Doctors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDoctors.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 space-y-3">
            <Stethoscope className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Aucun médecin trouvé</p>
            <p className="text-xs">Cliquez sur &laquo; Nouveau Médecin &raquo; pour ajouter un praticien au répertoire.</p>
          </div>
        ) : (
          filteredDoctors.map((doc) => {
            const docName = getDoctorName(doc);
            const specialtyName = getDoctorSpecialty(doc);
            const phone = getDoctorPhone(doc);
            const isInactive = doc.isActive === false;

            return (
              <div
                key={doc.id}
                className={`p-6 bg-white rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  isInactive ? 'opacity-60 border-slate-200 bg-slate-50/50' : 'border-slate-200 hover:border-blue-300 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 font-black text-base flex items-center justify-center shrink-0 border border-blue-200">
                        {doc.title ? doc.title.replace('.', '') : 'Dr'}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                          {docName}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {specialtyName}
                          </span>
                          {isInactive && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Inactif
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoctor(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Supprimer / Désactiver"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {doc.licenseNumber && (
                    <div className="text-[11px] text-slate-500 font-mono mt-2.5">
                      N° Ordre : <span className="font-bold text-slate-700">{doc.licenseNumber}</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                    {doc.bio || 'Médecin praticien de la Clinique Betesda.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{doc.workingHours || 'Lun - Ven: 08h00 - 17h00'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{phone}</span>
                    </div>
                    {doc.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{doc.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Stats */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-3 text-center text-xs">
                  <div>
                    <span className="font-extrabold text-slate-900 block">
                      {doc._count?.consultations || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Consultations</span>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-900 block">
                      {doc._count?.appointments || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">RDV</span>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-900 block">
                      {doc._count?.prescriptions || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Ordonnances</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add / Edit Doctor */}
      {modalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingDoctor ? 'Modifier la Fiche Médecin' : 'Ajouter un Médecin au Répertoire'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fiche praticien sans compte de connexion (disponible dans la Caisse Consultation)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Row 1: Titre, Prénom & Nom */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Titre
                  </label>
                  <select
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="Dr.">Dr.</option>
                    <option value="Pr.">Pr.</option>
                    <option value="Dr. Méd.">Dr. Méd.</option>
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Ex: Hery"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom de famille *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Ex: RAKOTOMANGA"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 uppercase"
                  />
                </div>
              </div>

              {/* Row 2: Spécialité médicale */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Spécialité Médicale *
                  </label>
                  <select
                    value={formData.specialtyId}
                    onChange={(e) => setFormData({ ...formData, specialtyId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500"
                  >
                    {specialties.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="">+ Nouvelle spécialité...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    N° Ordre des Médecins (Optionnel)
                  </label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="Ex: MED-2026-042"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {!formData.specialtyId && (
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1">
                    Précisez le nom de la nouvelle spécialité *
                  </label>
                  <input
                    type="text"
                    required={!formData.specialtyId}
                    value={formData.specialtyName}
                    onChange={(e) => setFormData({ ...formData, specialtyName: e.target.value })}
                    placeholder="Ex: Cardiologie, Dermatologie, Ophtalmologie..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-blue-400 bg-blue-50/40 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Row 3: Téléphone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Téléphone (Contact cabinet / urgence)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ex: +261 34 00 123 45"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email professionnel (Optionnel)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="docteur@clinique.mg"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Row 4: Horaires de consultation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Horaires de consultation / Présence
                </label>
                <input
                  type="text"
                  value={formData.workingHours}
                  onChange={(e) => setFormData({ ...formData, workingHours: e.target.value })}
                  placeholder="Ex: Lun - Ven: 08h00 - 17h00 ou Sur rendez-vous"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Row 5: Notes / Bio */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes ou Précisions (Optionnel)
                </label>
                <textarea
                  rows={2}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Ex: Spécialiste des consultations de suivi, échographies..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              {/* Active Toggle (Edit mode) */}
              {editingDoctor && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="isActiveCheck" className="text-xs font-semibold text-slate-700">
                    Médecin en exercice actif (affiché dans les listes de consultation)
                  </label>
                </div>
              )}

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Enregistrement...' : editingDoctor ? 'Mettre à jour' : 'Ajouter le Médecin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
