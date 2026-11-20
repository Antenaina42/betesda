'use client';

import React, { useState } from 'react';
import {
  Printer,
  CheckCircle2,
  X,
  Receipt,
  HeartPulse,
  Scissors,
  FileText,
  User,
  Stethoscope,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  ConsultationTicketData,
  printConsultationDualTicket,
  formatTicketMoney,
  formatTicketDateTime,
  formatTicketDate,
  formatTicketPaymentMethod,
} from '@/lib/consultationReceipt';

interface ConsultationDualTicketPreviewProps {
  ticketData: ConsultationTicketData;
  onClose: () => void;
  isNewPayment?: boolean;
}

export default function ConsultationDualTicketPreview({
  ticketData,
  onClose,
  isNewPayment = true,
}: ConsultationDualTicketPreviewProps) {
  const [printing, setPrinting] = useState(false);
  const [activeMode, setActiveMode] = useState<'all' | 'payment' | 'vitals'>('all');

  const currency = ticketData.clinic?.currency || 'Ar';
  const clinicName = ticketData.clinic?.name || 'CLINIQUE BETESDA';
  const clinicSlogan = ticketData.clinic?.slogan || 'Soins, Bienveillance & Gestion Intelligente';

  const dateStr = formatTicketDateTime(ticketData.date);
  const dateOnlyStr = formatTicketDate(ticketData.date);
  const paymentStr = formatTicketPaymentMethod(ticketData.paymentMethod);
  const patientFullName = `${ticketData.patient.lastName.toUpperCase()} ${ticketData.patient.firstName}`;
  const cashier = ticketData.cashierName || 'Accueil Clinique';
  const rawDoctor = ticketData.doctorName ? ticketData.doctorName.trim() : 'Médecin consultant';
  const doctor = (rawDoctor !== 'Médecin consultant' && rawDoctor !== 'Médecin de consultation')
    ? (rawDoctor.replace(/^(Dr\.?\s*)+/i, 'Dr. ').startsWith('Dr. ') || rawDoctor.startsWith('Prof.') ? rawDoctor.replace(/^(Dr\.?\s*)+/i, 'Dr. ') : `Dr. ${rawDoctor}`)
    : rawDoctor;
  const orderNumStr = ticketData.orderNumber
    ? String(ticketData.orderNumber).padStart(3, '0')
    : '001';

  const bpVal = ticketData.vitals?.bloodPressure || (
    ticketData.vitals?.systolicBP && ticketData.vitals?.diastolicBP
      ? `${ticketData.vitals.systolicBP}/${ticketData.vitals.diastolicBP}`
      : ''
  );
  const tempVal = ticketData.vitals?.temperature ? `${ticketData.vitals.temperature} °C` : '';
  const weightVal = ticketData.vitals?.weight ? `${ticketData.vitals.weight} kg` : '';
  const heightVal = ticketData.vitals?.height ? `${ticketData.vitals.height} cm` : '';
  const pulseVal = ticketData.vitals?.heartRate ? `${ticketData.vitals.heartRate} bpm` : '';
  const spo2Val = ticketData.vitals?.oxygenSaturation ? `${ticketData.vitals.oxygenSaturation} %` : '';
  const bloodSugarVal = ticketData.vitals?.bloodSugar ? `${ticketData.vitals.bloodSugar} g/L` : '';

  const handlePrint = async (mode: 'all' | 'payment' | 'vitals' = activeMode) => {
    setPrinting(true);
    try {
      await printConsultationDualTicket(ticketData, mode);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg my-auto bg-slate-900/95 rounded-2xl shadow-2xl border border-slate-700/60 p-4 sm:p-5 flex flex-col items-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-3">
          {isNewPayment ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Encaissement Validé avec Succès !</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 text-xs font-semibold mb-1 border border-sky-500/30">
              <Receipt className="w-3.5 h-3.5" />
              <span>Aperçu & Réimpression Ticket Consultation</span>
            </div>
          )}
          <h2 className="text-base font-bold text-white">
            Ticket Thermique 80mm — 2 Volets
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Volet 1 : Reçu de caisse • Volet 2 : Fiche navette &amp; Constantes médicales
          </p>
        </div>

        {/* Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl mb-3 text-xs w-full max-w-xs justify-center">
          <button
            type="button"
            onClick={() => setActiveMode('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeMode === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2 Volets (Complet)
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('payment')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeMode === 'payment'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Volet 1 (Paiement)
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('vitals')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeMode === 'vitals'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Volet 2 (Navette)
          </button>
        </div>

        {/* Paper Thermal Receipt Container */}
        <div className="relative w-full max-w-[340px] bg-white text-slate-900 rounded-lg shadow-xl font-mono text-[11px] p-4 border border-slate-200 select-text max-h-[58vh] overflow-y-auto">
          
          {/* VOLET 1 : REÇU DE PAIEMENT */}
          {(activeMode === 'all' || activeMode === 'payment') && (
            <div className="pb-3">
              <div className="text-center pb-2">
                <div className="font-extrabold text-[14px] uppercase tracking-wider text-slate-900">
                  {clinicName}
                </div>
                <div className="text-[9px] text-slate-500 italic">
                  {clinicSlogan}
                </div>
                <div className="text-[8.5px] text-slate-500 mt-1">
                  Lot IVG 35 Antananarivo • Tél : 034 51 365 45 / 034 53 689 59
                </div>
                <div className="text-[8px] text-slate-400">
                  contact@betesda.com • NIF: 3 005 710 430 - STAT: 86201 11 2021 0 08027
                </div>
                <div className="inline-block mt-2 px-2.5 py-0.5 rounded border border-slate-900 font-extrabold text-[10px] uppercase">
                  VOLET 1 : REÇU DE PAIEMENT
                </div>
              </div>

              <div className="border-t border-dashed border-slate-400 my-2" />

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Reçu N° :</span>
                  <span className="font-bold text-slate-900">{ticketData.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Date :</span>
                  <span>{dateStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Caissier :</span>
                  <span>{cashier}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-400 my-2" />

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">PATIENT :</span>
                  <span className="font-bold text-slate-900">{patientFullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">N° Dossier :</span>
                  <span>{ticketData.patient.patientNumber}</span>
                </div>
                {ticketData.items && ticketData.items.length > 1 ? (
                  <div className="pt-1.5 pb-0.5 border-t border-dotted border-slate-300">
                    <div className="text-[9.5px] font-bold text-slate-700 uppercase mb-1">
                      Actes &amp; Soins facturés ({ticketData.items.length}) :
                    </div>
                    {ticketData.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-[9.5px] text-slate-800 py-0.5">
                        <span className="truncate pr-2">
                          • {it.name} {it.quantity && it.quantity > 1 ? `(x${it.quantity})` : ''}
                        </span>
                        <span className="font-bold shrink-0">
                          {formatTicketMoney((it.price * (it.quantity || 1)), currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Acte :</span>
                    <span className="font-bold">{ticketData.actName}</span>
                  </div>
                )}
              </div>

              {/* Box Montant */}
              {Number(ticketData.amount) === 0 ? (
                <div className="my-2 p-2 rounded bg-white border-2 border-dashed border-slate-900 text-center">
                  <div className="font-black text-xs text-slate-900 uppercase tracking-wide">
                    CONSULTATION GRATUITE (0 Ar)
                  </div>
                  <div className="text-[9px] font-extrabold text-slate-700 mt-0.5">
                    PRISE EN CHARGE CLINIQUE
                  </div>
                </div>
              ) : (
                <div className="my-2 p-2 rounded bg-slate-50 border border-slate-900 flex justify-between items-center">
                  <span className="font-bold text-[10px] uppercase">TOTAL ENCAISSÉ :</span>
                  <span className="font-black text-base text-slate-900">
                    {formatTicketMoney(ticketData.amount, currency)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500 font-semibold">Règlement :</span>
                <span className="font-bold text-slate-900">{paymentStr}</span>
              </div>

              <div className="text-center mt-2">
                <span className={`inline-block px-2 py-0.5 rounded font-bold text-[9px] ${
                  Number(ticketData.amount) === 0
                    ? 'border-2 border-slate-900 text-slate-900 bg-slate-100 font-black'
                    : 'border border-emerald-600 text-emerald-800'
                }`}>
                  {Number(ticketData.amount) === 0 ? '★ CONSULTATION EXONÉRÉE • ACCUEIL ★' : '✓ PAIEMENT VALIDÉ & ENREGISTRÉ'}
                </span>
              </div>
            </div>
          )}

          {/* SÉPARATION & LIGNE DE DÉCOUPE */}
          {activeMode === 'all' && (
            <div className="my-3 text-center relative py-1">
              <div className="border-t-2 border-dashed border-slate-900" />
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white text-[9px] font-extrabold uppercase text-slate-700 tracking-wider -mt-2">
                <Scissors className="w-3 h-3 text-slate-900" />
                <span>DÉCOUPE TICKET / VOLET MÉDICAL</span>
              </div>
              <div className="border-t-2 border-dashed border-slate-900 mt-1" />
            </div>
          )}

          {/* VOLET 2 : FICHE NAVETTE DE PRISE DE CONSTANTES */}
          {(activeMode === 'all' || activeMode === 'vitals') && (
            <div className="pt-2">
              <div className="text-center">
                <div className="font-black text-[13px] uppercase text-slate-900">
                  {clinicName}
                </div>
                <div className="inline-block mt-1 px-2.5 py-0.5 rounded border border-slate-900 font-extrabold text-[10px] uppercase bg-slate-100">
                  VOLET 2 : FICHE NAVETTE DE CONSULTATION
                </div>
                <div className="text-[8.5px] font-bold text-slate-600 mt-0.5">
                  À PRÉSENTER AU PRATICIEN
                </div>
              </div>

              {/* Bannière N° d'ordre de passage */}
              <div className="my-2 p-1.5 rounded border-2 border-slate-900 bg-amber-50 text-center">
                <div className="text-[8px] font-black uppercase text-amber-900 tracking-wider">
                  NUMÉRO D'ORDRE DE PASSAGE
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-wider">
                  #{orderNumStr}
                </div>
                <div className="text-[8.5px] text-slate-600">
                  {dateOnlyStr} • Arrivée : {dateStr.split(' ')[1] || ''}
                </div>
              </div>

              {/* Infos Patient */}
              <div className="space-y-0.5 text-[10.5px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Patient :</span>
                  <span className="font-extrabold text-slate-900">{patientFullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Dossier :</span>
                  <span className="font-bold">{ticketData.patient.patientNumber}</span>
                </div>
                {ticketData.reason && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Motif :</span>
                    <span className="text-slate-800">{ticketData.reason}</span>
                  </div>
                )}
              </div>

              {/* GRILLE DÉDIÉE PRISE DES PARAMÈTRES VITAUX */}
              <div className="mt-2.5 p-2 rounded border-2 border-slate-900 bg-white space-y-1">
                <div className="text-center font-extrabold text-[9.5px] uppercase border-b border-slate-900 pb-1 mb-1 tracking-wide">
                  ★ PRISE DES PARAMÈTRES VITAUX ★
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-dotted border-slate-300 text-[9.5px]">
                  <span className="font-bold text-slate-800">🩺 Tension (TA) :</span>
                  <span className="px-1.5 py-0.5 rounded border border-slate-400 bg-slate-50 min-w-[65px] text-center font-bold">
                    {bpVal ? `${bpVal} mmHg` : '___ / ___ mmHg'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-dotted border-slate-300 text-[9.5px]">
                  <span className="font-bold text-slate-800">⚖️ Poids :</span>
                  <span className="px-1.5 py-0.5 rounded border border-slate-400 bg-slate-50 min-w-[65px] text-center font-bold">
                    {weightVal || '_____ kg'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-dotted border-slate-300 text-[9.5px]">
                  <span className="font-bold text-slate-800">📏 Taille :</span>
                  <span className="px-1.5 py-0.5 rounded border border-slate-400 bg-slate-50 min-w-[65px] text-center font-bold">
                    {heightVal || '_____ cm'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-dotted border-slate-300 text-[9.5px]">
                  <span className="font-bold text-slate-800">🌡️ Température (T°) :</span>
                  <span className="px-1.5 py-0.5 rounded border border-slate-400 bg-slate-50 min-w-[65px] text-center font-bold">
                    {tempVal || '_____ °C'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-dotted border-slate-300 text-[9.5px]">
                  <span className="font-bold text-slate-800">❤️ Pouls (FC) :</span>
                  <span className="px-1.5 py-0.5 rounded border border-slate-400 bg-slate-50 min-w-[65px] text-center font-bold">
                    {pulseVal || '_____ bpm'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-dotted border-slate-300 text-[9.5px]">
                  <span className="font-bold text-slate-800">🫁 Saturation (SpO2) :</span>
                  <span className="px-1.5 py-0.5 rounded border border-slate-400 bg-slate-50 min-w-[65px] text-center font-bold">
                    {spo2Val || '_____ %'}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-[8px] border border-dashed border-slate-400 p-1 rounded flex justify-between">
                <span>Visa Soignant : ____________</span>
                <span>Heure : ____:____</span>
              </div>

              <div className="text-[7.5px] text-center text-slate-500 font-bold mt-2">
                Remettre ce volet au médecin lors de l'appel.
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="w-full mt-4 flex flex-col sm:flex-row items-center gap-2">
          <button
            type="button"
            disabled={printing}
            onClick={() => handlePrint(activeMode)}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>
              {printing
                ? 'Impression en cours...'
                : activeMode === 'all'
                ? 'Imprimer le Ticket 80mm (2 Volets)'
                : activeMode === 'payment'
                ? 'Imprimer Reçu de Paiement'
                : 'Imprimer Fiche Navette'}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl font-bold text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
