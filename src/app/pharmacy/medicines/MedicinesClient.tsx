'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Pill,
  Search,
  PlusCircle,
  AlertTriangle,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Sparkles,
  Edit2,
  Trash2,
  Paperclip,
  Upload,
  FileText,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { AuthUser } from '@/lib/auth';

interface Category {
  id: string;
  name: string;
  description?: string | null;
}

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  form: string;
  packaging?: string | null;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStockLevel: number;
  expiryDate?: string | null;
  location?: string | null;
  manufacturer?: string | null;
  categoryId: string;
  category: Category;
}

interface MedicinesClientProps {
  user?: AuthUser;
  initialMedicines: Medicine[];
  categories: Category[];
  initialSearch?: string;
  initialCategoryId?: string;
}

export default function MedicinesClient({
  user,
  initialMedicines,
  categories,
  initialSearch = '',
  initialCategoryId = '',
}: MedicinesClientProps) {
  const isAdmin = user ? (user.role === 'SUPER_ADMIN' || user.role === 'CLINIC_ADMIN') : false;
  const [medicines, setMedicines] = useState<Medicine[]>(initialMedicines);
  const [allCategories, setAllCategories] = useState<Category[]>(categories);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategoryId);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [deleteConfirmMedicine, setDeleteConfirmMedicine] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Custom Category & Form States
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customFormName, setCustomFormName] = useState('');

  // Saisie du stock par Boîtes & Unités par boîte + Pièce jointe optionnelle
  const [boxesCount, setBoxesCount] = useState<string>('5');
  const [unitsPerBox, setUnitsPerBox] = useState<string>('30');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [uploadingAttachment, setUploadingAttachment] = useState<boolean>(false);

  const numBoxes = parseInt(boxesCount, 10) || 0;
  const numUnits = parseInt(unitsPerBox, 10) || 1;
  const calculatedTotalStockUnits = numBoxes * numUnits;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: data,
      });
      const result = await res.json();
      if (result.url) {
        setAttachmentUrl(result.url);
        setAttachmentName(file.name);
      }
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    categoryId: categories[0]?.id || '',
    dosage: '',
    form: 'Comprimé',
    packaging: 'Boîte',
    purchasePrice: '',
    sellingPrice: '',
    minStockLevel: '5',
    expiryDate: '',
    location: 'Rayon principal - Étagère 1',
    manufacturer: '',
  });

  const formsList = [
    'Comprimé',
    'Gélule',
    'Sirop',
    'Suspension buvable',
    'Ampoule injectable',
    'Flacon pour perfusion',
    'Pommade / Crème',
    'Collyre',
    'Suppositoire',
    'Sachet de poudre',
    'Aérosol / Inhalateur',
  ];

  // Open Modal for Create
  const handleOpenModal = () => {
    if (!isAdmin) return;
    setErrorMsg('');
    setSuccessMsg('');
    setEditingMedicine(null);
    setCustomCategoryName('');
    setCustomFormName('');
    setBoxesCount('5');
    setUnitsPerBox('30');
    setAttachmentUrl('');
    setAttachmentName('');
    setFormData({
      name: '',
      genericName: '',
      categoryId: allCategories[0]?.id || '',
      dosage: '',
      form: 'Comprimé',
      packaging: 'Boîte',
      purchasePrice: '',
      sellingPrice: '',
      minStockLevel: '5',
      expiryDate: '',
      location: 'Rayon A - Étagère 1',
      manufacturer: '',
    });
    setModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (med: any) => {
    if (!isAdmin) return;
    setErrorMsg('');
    setSuccessMsg('');
    setEditingMedicine(med);
    setCustomCategoryName('');
    setCustomFormName('');
    const uPerBox = med.unitsPerBox || 30;
    const bCount = Math.max(1, Math.round((med.currentStock || 0) / uPerBox));
    setBoxesCount(String(bCount));
    setUnitsPerBox(String(uPerBox));
    setAttachmentUrl('');
    setAttachmentName('');

    const isCustomForm = !formsList.includes(med.form);
    setFormData({
      name: med.name,
      genericName: med.genericName,
      categoryId: med.categoryId,
      dosage: med.dosage,
      form: isCustomForm ? '__OTHER__' : med.form,
      packaging: 'Boîte',
      purchasePrice: String(med.purchasePrice || ''),
      sellingPrice: String(med.sellingPrice || ''),
      minStockLevel: String(med.minStockLevel ?? 5),
      expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '',
      location: med.location || '',
      manufacturer: med.manufacturer || '',
    });
    if (isCustomForm) {
      setCustomFormName(med.form);
    }
    setModalOpen(true);
  };

  // Submit New or Edited Medicine
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const payload = {
        ...formData,
        packaging: 'Boîte',
        boxesCount: numBoxes,
        unitsPerBox: numUnits,
        currentStock: calculatedTotalStockUnits,
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
        newCategoryName: formData.categoryId === '__OTHER__' ? customCategoryName.trim() : undefined,
        form: formData.form === '__OTHER__' ? customFormName.trim() : formData.form,
      };

      const isEditing = Boolean(editingMedicine);
      const url = isEditing ? `/api/medicines/${editingMedicine!.id}` : '/api/medicines';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l’enregistrement');
      }

      if (isEditing) {
        setMedicines((prev) => prev.map((m) => (m.id === editingMedicine!.id ? data.medicine : m)));
        setSuccessMsg(`Le médicament « ${data.medicine.name} » a été mis à jour avec succès !`);
      } else {
        setMedicines((prev) => [data.medicine, ...prev]);
        if (data.medicine?.category && !allCategories.some((c) => c.id === data.medicine.category.id)) {
          setAllCategories((prev) => [...prev, data.medicine.category]);
        }
        setSuccessMsg(`Le médicament « ${data.medicine.name} » a été ajouté avec succès au catalogue !`);
      }

      setTimeout(() => {
        setModalOpen(false);
        setEditingMedicine(null);
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  // Delete Medicine
  const handleConfirmDelete = async () => {
    if (!deleteConfirmMedicine) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/medicines/${deleteConfirmMedicine.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      setMedicines((prev) => prev.filter((m) => m.id !== deleteConfirmMedicine.id));
      setSuccessMsg(`Le médicament « ${deleteConfirmMedicine.name} » a été supprimé du catalogue.`);
      setDeleteConfirmMedicine(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  // Filtered List
  const filteredMedicines = medicines.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      m.name.toLowerCase().includes(q) ||
      m.genericName.toLowerCase().includes(q) ||
      (m.manufacturer && m.manufacturer.toLowerCase().includes(q));

    const matchCategory = !selectedCategory || m.categoryId === selectedCategory;

    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
            <span>/</span>
            <Link href="/pharmacy" className="hover:text-blue-600">Pharmacie</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">Médicaments</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Catalogue Médicaments ({medicines.length})
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Inventaire officiel avec DCI, prix, formes galéniques et niveaux de stock en temps réel
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Main Button: Nouveau Médicament (Administration only) */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nouveau Médicament</span>
            </button>
          )}

          <Link
            href="/pharmacy/stock"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-2xs transition-all"
          >
            <Package className="w-4 h-4" />
            <span>Entrée de Stock</span>
          </Link>
        </div>
      </div>

      {/* Filters (Search & Categories) */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom commercial, DCI ou fabricant..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              !selectedCategory ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Toutes catégories
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Médicament & DCI</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Dosage / Forme</th>
                {isAdmin && <th className="py-3 px-4">Prix Achat</th>}
                <th className="py-3 px-4">Prix Vente</th>
                <th className="py-3 px-4">Stock Actuel</th>
                <th className="py-3 px-4">Péremption</th>
                <th className="py-3 px-4">Emplacement</th>
                {isAdmin && <th className="py-3 px-4 text-center w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="py-12 text-center text-slate-400">
                    <Pill className="w-8 h-8 mx-auto mb-2 opacity-30 text-blue-500" />
                    Aucun médicament ne correspond à vos filtres.
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((m) => {
                  const isLow = m.currentStock <= m.minStockLevel;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{m.name}</span>
                        <span className="text-[11px] text-slate-400">
                          DCI: {m.genericName}
                          {m.manufacturer ? ` • ${m.manufacturer}` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {m.category?.name || 'Général'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-semibold">{m.dosage}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            m.packaging === 'Plaquette'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {m.packaging || 'Boîte'}
                          </span>
                        </div>
                        <span className="text-slate-400 text-[11px] block">{m.form}</span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-slate-500">
                          {formatCurrency(m.purchasePrice)}
                        </td>
                      )}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatCurrency(m.sellingPrice)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                            isLow
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3 mr-1 text-rose-500 shrink-0" />}
                          {m.currentStock} {m.packaging === 'Plaquette' ? (m.currentStock > 1 ? 'plaquettes' : 'plaquette') : (m.currentStock > 1 ? 'boîtes' : 'boîte')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {m.expiryDate ? formatDate(m.expiryDate) : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {m.location || 'Rayon principal'}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(m)}
                              title="Modifier ce médicament"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmMedicine(m)}
                              title="Supprimer ce médicament"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NOUVEAU MÉDICAMENT */}
      {modalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingMedicine ? 'Modifier le Médicament' : 'Ajouter un Médicament au Catalogue'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingMedicine
                      ? 'Mise à jour des informations, prix et stock du médicament'
                      : "Enregistrement d'une nouvelle référence pharmaceutique avec DCI, prix et stock initial"}
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
              {/* Row 1: Nom & DCI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom Commercial du Médicament *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ex: Augmentin, Doliprane, Amoxil"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dénomination Commune (DCI / Nom Générique) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.genericName}
                    onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                    placeholder="ex: Amoxicilline + Ac. Clavulanique"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Row 2: Catégorie, Forme & Dosage */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catégorie Thérapeutique *
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500"
                  >
                    {allCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__OTHER__">+ Autre catégorie...</option>
                  </select>
                  {formData.categoryId === '__OTHER__' && (
                    <div className="mt-1.5 animate-in fade-in">
                      <input
                        type="text"
                        required
                        value={customCategoryName}
                        onChange={(e) => setCustomCategoryName(e.target.value)}
                        placeholder="Nom catégorie personnalisée..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-blue-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-blue-50/40"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Forme Galénique *
                  </label>
                  <select
                    value={formData.form}
                    onChange={(e) => setFormData({ ...formData, form: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500"
                  >
                    {formsList.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                    <option value="__OTHER__">+ Autre forme...</option>
                  </select>
                  {formData.form === '__OTHER__' && (
                    <div className="mt-1.5 animate-in fade-in">
                      <input
                        type="text"
                        required
                        value={customFormName}
                        onChange={(e) => setCustomFormName(e.target.value)}
                        placeholder="Forme personnalisée..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-blue-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-blue-50/40"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dosage *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.dosage}
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                    placeholder="ex: 1 g, 500 mg, 250mg/5ml"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Stock Initial : Saisie en Boîtes & Unités par boîte (Calcul automatique) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>Stock Initial : Saisie en Boîtes &amp; Fractionnement en Unités</span>
                  </div>
                  <span className="text-[10px] text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md font-bold">
                    Comptabilisé en Unités
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre de Boîtes *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={boxesCount}
                      onChange={(e) => setBoxesCount(e.target.value)}
                      placeholder="ex: 5"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-bold font-mono focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre d'Unités par Boîte *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={unitsPerBox}
                      onChange={(e) => setUnitsPerBox(e.target.value)}
                      placeholder="ex: 30"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-bold font-mono focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-900">Total Stock en Unités de vente :</span>
                  <span className="font-black text-blue-700 text-sm font-mono">
                    {numBoxes} boîte{numBoxes > 1 ? 's' : ''} &times; {numUnits} = {calculatedTotalStockUnits} unités
                  </span>
                </div>
              </div>

              {/* Pièce jointe justificative optionnelle */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pièce jointe justificative (Optionnelle : Facture, Bon de livraison, Notice)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept="image/*,.pdf"
                    className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                  {uploadingAttachment && (
                    <span className="text-xs text-blue-600 font-semibold animate-pulse">
                      Chargement du fichier...
                    </span>
                  )}
                </div>
                {attachmentUrl && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Fichier joint : {attachmentName || 'Document justificatif'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentUrl('');
                        setAttachmentName('');
                      }}
                      className="ml-auto text-rose-500 hover:text-rose-700 text-[11px]"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>

              {/* Row 3: Prix Achat & Vente (Réservé Direction / Administrateur avec Pièce Jointe) */}
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-amber-900 tracking-wide">
                    🔒 Tarification Officielle (Réservée à l'Administration)
                  </span>
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded">
                    Facture / Bon d'achat
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Prix d'Achat Fournisseur (Ar) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      disabled={!isAdmin}
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      placeholder="ex: 6000"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 font-mono disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Prix de Vente Client (Ar) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="100"
                      disabled={!isAdmin}
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                      placeholder="ex: 8500"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 font-mono font-bold text-blue-700 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Seuil d'Alerte Stock Bas */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Seuil d'Alerte Stock Bas (en unités) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                  placeholder="ex: 10"
                />
              </div>

              {/* Row 5: Péremption, Emplacement & Laboratoire */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date de Péremption
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Emplacement en Pharmacie
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Rayon A - Étagère 2"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fabricant / Laboratoire
                  </label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder="ex: Sanofi, Biogaran"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
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
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {loading
                      ? 'Enregistrement...'
                      : editingMedicine
                      ? 'Enregistrer les modifications'
                      : 'Enregistrer le Médicament'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION DE SUPPRESSION */}
      {deleteConfirmMedicine && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) setDeleteConfirmMedicine(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Supprimer le Médicament</h3>
                <p className="text-xs text-slate-500">Cette action retirera le médicament du catalogue</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Êtes-vous sûr de vouloir supprimer « <strong className="text-slate-900">{deleteConfirmMedicine.name} ({deleteConfirmMedicine.dosage})</strong> » du catalogue actif ?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setDeleteConfirmMedicine(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{loading ? 'Suppression...' : 'Supprimer définitivement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
