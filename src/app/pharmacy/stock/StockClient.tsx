'use client';

import React, { useState } from 'react';
import {
  Plus,
  ArrowDownRight,
  Package,
  AlertCircle,
  Loader2,
  FileText,
  Image as ImageIcon,
  Paperclip,
  X,
  CheckCircle2,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import MedicineSearchSelect from '@/components/pharmacy/MedicineSearchSelect';

interface StockClientProps {
  medicines: any[];
  suppliers?: any[];
  initialEntries: any[];
  initialExits: any[];
  userRole?: string;
}

export default function StockClient({
  medicines,
  initialEntries,
  initialExits,
  userRole,
}: StockClientProps) {
  const isPharmacist = userRole === 'PHARMACIST';
  const [activeTab, setActiveTab] = useState<'entries' | 'exits'>('entries');
  const [entries, setEntries] = useState(initialEntries);
  const [exits, setExits] = useState(initialExits);

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected medicine for entry
  const [selectedMedId, setSelectedMedId] = useState(medicines[0]?.id || '');
  const selectedMed = medicines.find((m) => m.id === selectedMedId);

  // Form State for Entry: Boîtes & Unités
  const [boxesCount, setBoxesCount] = useState<string>('5');
  const [unitsPerBox, setUnitsPerBox] = useState<string>(
    selectedMed?.unitsPerBox ? String(selectedMed.unitsPerBox) : '30'
  );
  const [boxCost, setBoxCost] = useState<string>(
    isPharmacist && selectedMed?.sellingPrice
      ? String(selectedMed.sellingPrice * (selectedMed.unitsPerBox || 30))
      : '15000'
  );
  const [batchNumber, setBatchNumber] = useState<string>('LOT-2026-A1');
  const [expiryDate, setExpiryDate] = useState<string>('2028-06-30');
  const [notes, setNotes] = useState<string>('Entrée conforme de stock.');

  // File upload state (Image / PDF)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);

  // Exit Form State (Only for Admins)
  const [exitForm, setExitForm] = useState({
    medicineId: medicines[0]?.id || '',
    quantity: '2',
    reason: 'EXPIRED',
    notes: 'Périmé en rayon',
  });

  // Calcul dynamique des unités totales ajoutées
  const numBoxes = parseInt(boxesCount, 10) || 0;
  const numUnitsPerBox = parseInt(unitsPerBox, 10) || 1;
  const totalUnitsCalculated = numBoxes * numUnitsPerBox;
  const numBoxCost = parseFloat(boxCost) || 0;
  const unitCostCalculated = totalUnitsCalculated > 0 ? (numBoxCost * numBoxes) / totalUnitsCalculated : 0;

  const handleMedicineChange = (id: string) => {
    setSelectedMedId(id);
    const med = medicines.find((m) => m.id === id);
    if (med) {
      const uPerBox = med.unitsPerBox || 30;
      setUnitsPerBox(String(uPerBox));
      if (isPharmacist && med.sellingPrice) {
        setBoxCost(String(med.sellingPrice * uPerBox));
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setError('Format invalide : Veuillez joindre une image (JPG, PNG) ou un PDF.');
      return;
    }

    setAttachmentFile(file);
    setUploadingFile(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/pharmacy/stock/upload', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l’upload du fichier');
      }

      setAttachmentUrl(data.url);
      setAttachmentName(data.fileName);
      setUploadingFile(false);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’upload du fichier');
      setUploadingFile(false);
      setAttachmentFile(null);
    }
  };

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (totalUnitsCalculated <= 0) {
      setError('Veuillez renseigner un nombre de boîtes et d’unités par boîte supérieur à 0.');
      setLoading(false);
      return;
    }

    const effectiveUnitCost = isPharmacist && selectedMed?.purchasePrice
      ? selectedMed.purchasePrice
      : unitCostCalculated;
    const effectiveBoxCost = isPharmacist && selectedMed?.purchasePrice
      ? selectedMed.purchasePrice * numUnitsPerBox
      : numBoxCost;

    try {
      const payload = {
        type: 'ENTRY',
        medicineId: selectedMedId,
        boxesCount: numBoxes,
        unitsPerBox: numUnitsPerBox,
        quantity: totalUnitsCalculated, // Stock en unités
        boxCost: effectiveBoxCost,
        unitCost: effectiveUnitCost,
        totalCost: effectiveBoxCost * numBoxes,
        batchNumber: batchNumber || null,
        expiryDate: expiryDate || null,
        notes: notes || null,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
      };

      const res = await fetch('/api/pharmacy/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l’entrée de stock');
        setLoading(false);
        return;
      }

      setEntries([data.entry, ...entries]);
      setShowEntryModal(false);
      setLoading(false);
      setSuccessMsg(`+${totalUnitsCalculated} unités ajoutées avec succès pour ${data.entry.medicine?.name || 'le médicament'} !`);
      setTimeout(() => setSuccessMsg(''), 5000);

      // Reset attachment
      setAttachmentFile(null);
      setAttachmentUrl('');
      setAttachmentName('');
    } catch (err: any) {
      setError('Erreur réseau');
      setLoading(false);
    }
  };

  const handleExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/pharmacy/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'EXIT', ...exitForm }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la sortie de stock');
        setLoading(false);
        return;
      }

      setExits([data.exit, ...exits]);
      setShowExitModal(false);
      setLoading(false);
    } catch (err: any) {
      setError('Erreur réseau');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification succès */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Action Buttons & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!isPharmacist ? (
          <div className="flex rounded-xl bg-slate-200/70 p-1">
            <button
              onClick={() => setActiveTab('entries')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'entries'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entrées de Stock ({entries.length})
            </button>
            <button
              onClick={() => setActiveTab('exits')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'exits'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sorties / Ajustements ({exits.length})
            </button>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Gestion des Stocks Pharmacie</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isPharmacist && selectedMed?.sellingPrice) {
                const uPerBox = selectedMed.unitsPerBox || 30;
                setBoxCost(String(selectedMed.sellingPrice * uPerBox));
              }
              setShowEntryModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Faire Entrer le Stock (Boîtes → Unités)</span>
          </button>

          {!isPharmacist && (
            <button
              onClick={() => setShowExitModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Déclarer Sortie</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content: Entries */}
      {activeTab === 'entries' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">
                Historique des Réceptions de Stock (Comptabilisées en Unités)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Chaque boîte réceptionnée est automatiquement fractionnée en unités de vente.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Date Entrée</th>
                  <th className="py-3 px-4">Médicament</th>
                  <th className="py-3 px-4">Conditionnement</th>
                  <th className="py-3 px-4">Unités Ajoutées</th>
                  <th className="py-3 px-4">N° de Lot</th>
                  <th className="py-3 px-4">Péremption</th>
                  <th className="py-3 px-4">Justificatif (Pièce Jointe)</th>
                  <th className="py-3 px-4 text-right">
                    {isPharmacist ? 'Valeur Vente Totale' : 'Montant Total'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Aucune entrée de stock enregistrée pour l’instant.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const hasAttachment = Boolean(entry.attachmentUrl);
                    const isPdf = entry.attachmentUrl?.toLowerCase().endsWith('.pdf') || entry.attachmentName?.toLowerCase().endsWith('.pdf');

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-500 whitespace-nowrap">
                          {formatDate(entry.entryDate)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{entry.medicine?.name || 'Médicament'}</span>
                          <span className="text-[11px] text-slate-400">{entry.medicine?.dosage} • {entry.medicine?.form}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {entry.boxesCount ? (
                            <span className="font-semibold">
                              {entry.boxesCount} boîte{entry.boxesCount > 1 ? 's' : ''} ({entry.unitsPerBox || 1} u/bte)
                            </span>
                          ) : (
                            <span className="text-slate-500">Saisie directe</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            +{entry.quantity} unités
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {entry.batchNumber || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {formatDate(entry.expiryDate)}
                        </td>
                        <td className="py-3.5 px-4">
                          {hasAttachment ? (
                            <a
                              href={entry.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                              title="Ouvrir le justificatif joint"
                            >
                              {isPdf ? (
                                <FileText className="w-3.5 h-3.5 text-rose-600" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span className="max-w-[130px] truncate">
                                {entry.attachmentName || (isPdf ? 'Justificatif.pdf' : 'Image')}
                              </span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Aucune PJ</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 text-right">
                          {formatCurrency(entry.totalCost)}
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

      {/* Tab Content: Exits (Admins) */}
      {!isPharmacist && activeTab === 'exits' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date Sortie</th>
                  <th className="py-3 px-4">Médicament</th>
                  <th className="py-3 px-4">Quantité Déduite (Unités)</th>
                  <th className="py-3 px-4">Motif</th>
                  <th className="py-3 px-4">Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Aucune sortie de stock enregistrée.
                    </td>
                  </tr>
                ) : (
                  exits.map((exit) => (
                    <tr key={exit.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500">
                        {formatDate(exit.exitDate)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {exit.medicine?.name} ({exit.medicine?.dosage})
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          -{exit.quantity} unités
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {exit.reason === 'EXPIRED' ? 'Périmé' : exit.reason === 'DAMAGED' ? 'Avarié / Cassé' : 'Ajustement inventaire'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 italic">
                        {exit.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Entrée de Stock (Boîtes → Unités + Pièce Jointe Image/PDF) */}
      {showEntryModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEntryModal(false);
              setError('');
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Nouvelle Entrée de Stock Médicament
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Saisie par boîte avec conversion automatique en unités de vente &amp; pièce jointe justificative
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEntryModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleEntrySubmit} className="space-y-4 text-xs">
              {/* Sélection du médicament */}
              <MedicineSearchSelect
                label="Médicament à approvisionner"
                medicines={medicines}
                selectedId={selectedMedId}
                onSelect={handleMedicineChange}
                placeholder="Rechercher par nom ou DCI..."
              />

              {/* Conversion Boîtes -> Unités */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  <span>Conditionnement &amp; Fractionnement en Unités</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nombre de Boîtes reçues
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={boxesCount}
                      onChange={(e) => setBoxesCount(e.target.value)}
                      required
                      placeholder="Ex: 5"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Unités par Boîte (ex: 30)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={unitsPerBox}
                      onChange={(e) => setUnitsPerBox(e.target.value)}
                      required
                      placeholder="Ex: 30 comprimés"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900 bg-white"
                    />
                  </div>
                </div>

                {/* Bannière de calcul instantané */}
                <div className="p-2.5 rounded-lg bg-blue-600 text-white flex items-center justify-between text-xs font-bold shadow-xs">
                  <span>Stock total ajouté en caisse :</span>
                  <span className="text-sm font-black tracking-wide">
                    {numBoxes} boîtes × {numUnitsPerBox} = +{totalUnitsCalculated} unités
                  </span>
                </div>
              </div>

              {/* Coût & Prix (Seuls les administrateurs entrent les prix, le pharmacien entre uniquement les quantités) */}
              {!isPharmacist ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Prix d'achat par boîte (Ar) *
                    </label>
                    <input
                      type="number"
                      value={boxCost}
                      onChange={(e) => setBoxCost(e.target.value)}
                      required
                      placeholder="Ex: 15000"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">
                      Revient à {formatCurrency(unitCostCalculated)} / unité
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      N° de Lot (Optionnel)
                    </label>
                    <input
                      type="text"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="LOT-2026-..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="block text-[11px] font-bold text-slate-700">
                      Tarification Officielle (Direction)
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      🔒 Les prix d'achat et de vente sont gérés exclusivement par l'Administration. Le pharmacien valide les quantités physiques reçues.
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      N° de Lot (Optionnel)
                    </label>
                    <input
                      type="text"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="LOT-2026-..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Date péremption & Remarques */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date de péremption
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Remarques / Observations
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Réception conforme, stock magasin..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {/* PIÈCE JOINTE : Image JPG/PNG ou PDF */}
              <div className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 space-y-2">
                <label className="block font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    <span>Pièce Jointe Justificative (Image JPG/PNG ou Document PDF)</span>
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">Optionnel</span>
                </label>

                {attachmentUrl ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <div className="flex items-center gap-2 truncate">
                      {attachmentName.toLowerCase().endsWith('.pdf') ? (
                        <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <span className="font-semibold text-xs truncate">{attachmentName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentFile(null);
                        setAttachmentUrl('');
                        setAttachmentName('');
                      }}
                      className="text-slate-400 hover:text-rose-600 ml-2"
                      title="Supprimer la pièce jointe"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer transition-colors text-center">
                      {uploadingFile ? (
                        <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Téléversement du fichier en cours...</span>
                        </div>
                      ) : (
                        <>
                          <Paperclip className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="font-bold text-slate-700 text-xs">
                            Cliquer pour joindre une facture ou bon de livraison
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Formats acceptés : PDF, JPG, PNG (Max 10 Mo)
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf, image/jpeg, image/png, image/webp"
                        onChange={handleFileUpload}
                        disabled={uploadingFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Boutons d'action */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingFile}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Valider l'Entrée (+{totalUnitsCalculated} Unités)</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sortie de Stock (Admins) */}
      {!isPharmacist && showExitModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExitModal(false);
              setError('');
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              Déclaration de Sortie de Stock
            </h3>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleExitSubmit} className="space-y-3 text-xs">
              <MedicineSearchSelect
                label="Médicament concerné"
                medicines={medicines}
                selectedId={exitForm.medicineId}
                onSelect={(id) => setExitForm({ ...exitForm, medicineId: id })}
                placeholder="Rechercher un médicament..."
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quantité à déduire (Unités)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={exitForm.quantity}
                    onChange={(e) => setExitForm({ ...exitForm, quantity: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Motif</label>
                  <select
                    value={exitForm.reason}
                    onChange={(e) => setExitForm({ ...exitForm, reason: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="EXPIRED">Périmé</option>
                    <option value="DAMAGED">Avarié / Cassé</option>
                    <option value="INVENTORY_ADJUSTMENT">Ajustement inventaire</option>
                    <option value="RETURN_TO_SUPPLIER">Retour fournisseur</option>
                    <option value="OTHER">Autre motif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observations</label>
                <input
                  type="text"
                  value={exitForm.notes}
                  onChange={(e) => setExitForm({ ...exitForm, notes: e.target.value })}
                  placeholder="Ex: Cassé lors du rangement..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm"
                >
                  {loading ? 'Validation...' : 'Confirmer la Sortie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
