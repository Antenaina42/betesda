/**
 * Utilitaire d'impression pour le double ticket de consultation thermique (80mm)
 * Clinique Betesda — Haute netteté monochrome (100% noir #000 sur fond blanc #fff,
 * police grasse sans empattement, largeur imprimable 72mm anti-troncature).
 *
 * Sort en 2 volets :
 * Volet 1 : Reçu de paiement de consultation (pour le patient)
 * Volet 2 : Fiche navette médicale & prise des constantes vitales
 */

export interface ConsultationTicketData {
  clinic: {
    name?: string | null;
    slogan?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    taxId?: string | null;
    currency?: string | null;
  };
  receiptNumber: string;
  orderNumber?: number | string;
  consultationId?: string;
  date: string | Date;
  cashierName?: string | null;
  patient: {
    id?: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    age?: number | string | null;
    gender?: string | null;
  };
  doctorName?: string | null;
  specialty?: string | null;
  actName: string;
  items?: Array<{ name: string; price: number; quantity?: number }>;
  amount: number;
  paymentMethod: string;
  paymentReference?: string | null;
  cashTendered?: number | string | null;
  changeDue?: number | string | null;
  reason?: string | null;
  vitals?: {
    temperature?: number | string | null;
    bloodPressure?: string | null;
    systolicBP?: number | string | null;
    diastolicBP?: number | string | null;
    weight?: number | string | null;
    height?: number | string | null;
    heartRate?: number | string | null;
    oxygenSaturation?: number | string | null;
    bloodSugar?: number | string | null;
    notes?: string | null;
  };
}

export function formatTicketMoney(amount: number | null | undefined, currency: string = 'Ar'): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return `0 ${currency}`;
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(Number(amount))
    .replace(/[\u00A0\u202F]/g, ' ');
  return `${formatted} ${currency}`;
}

export function formatTicketDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function formatTicketDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatTicketTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

export function formatTicketPaymentMethod(method: string): string {
  switch (method) {
    case 'CASH':
      return 'Especes (Cash)';
    case 'MOBILE_MONEY':
    case 'MVOLA':
      return 'MVola (Mobile Money)';
    case 'ORANGE_MONEY':
      return 'Orange Money';
    case 'AIRTEL_MONEY':
      return 'Airtel Money';
    case 'CREDIT_CARD':
    case 'CARD':
      return 'Carte Bancaire';
    case 'CHECK':
      return 'Cheque';
    case 'BANK_TRANSFER':
      return 'Virement';
    default:
      return method || 'Especes';
  }
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Génère le code HTML ultra-net pour imprimante thermique 80mm (largeur utile 72mm).
 * Zéro gris, zéro italique, zéro emoji flou : contraste maximal 100% noir/blanc.
 */
export function generateConsultationDualTicketHtml(
  data: ConsultationTicketData,
  mode: 'all' | 'payment' | 'vitals' = 'all'
): string {
  const currency = data.clinic?.currency || 'Ar';
  const clinicName = data.clinic?.name || 'CLINIQUE BETESDA';
  const clinicSlogan = data.clinic?.slogan || 'Soins, Bienveillance & Gestion Intelligente';
  const clinicAddress = data.clinic?.address || 'Lot IVG 35 Rue Pasteur, Antananarivo';
  const clinicPhone = data.clinic?.phone || '034 51 365 45 / 034 53 689 59';
  const clinicTax = data.clinic?.taxId || 'NIF: 3 005 710 430 - Stat: 86201 11 2021 0 08027';

  const dateStr = formatTicketDateTime(data.date);
  const dateOnlyStr = formatTicketDate(data.date);
  const timeOnlyStr = formatTicketTime(data.date);
  const paymentStr = formatTicketPaymentMethod(data.paymentMethod);
  const cleanFirstName =
    data.patient.firstName && data.patient.firstName.trim() !== '-' ? data.patient.firstName.trim() : '';
  const patientFullName = `${data.patient.lastName.toUpperCase()}${cleanFirstName ? ` ${cleanFirstName}` : ''}`.trim();
  const cashier = data.cashierName || 'Accueil Clinique';
  const orderNumStr = data.orderNumber ? String(data.orderNumber).padStart(3, '0') : '001';
  const volet2Motif =
    (data.reason && data.reason.trim()) ||
    (data.items && data.items.length > 0 ? data.items.map((i) => i.name).join(' + ') : data.actName) ||
    'Consultation';

  const cashTendered = data.cashTendered ? Number(data.cashTendered) : null;
  const changeDue = data.changeDue ? Number(data.changeDue) : null;

  const bpVal =
    data.vitals?.bloodPressure ||
    (data.vitals?.systolicBP && data.vitals?.diastolicBP
      ? `${data.vitals.systolicBP}/${data.vitals.diastolicBP}`
      : '');
  const tempVal = data.vitals?.temperature ? `${data.vitals.temperature} °C` : '';
  const weightVal = data.vitals?.weight ? `${data.vitals.weight} kg` : '';
  const heightVal = data.vitals?.height ? `${data.vitals.height} cm` : '';
  const pulseVal = data.vitals?.heartRate ? `${data.vitals.heartRate} bpm` : '';
  const spo2Val = data.vitals?.oxygenSaturation ? `${data.vitals.oxygenSaturation} %` : '';

  const showPayment = mode === 'all' || mode === 'payment';
  const showVitals = mode === 'all' || mode === 'vitals';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ticket Consultation - ${escapeHtml(data.receiptNumber)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      -webkit-font-smoothing: none;
      text-rendering: geometricPrecision;
    }
    html, body {
      width: 80mm;
      max-width: 80mm;
      background: #ffffff;
      color: #000000;
      font-family: 'Arial', 'Helvetica Neue', 'Liberation Sans', 'DejaVu Sans', sans-serif;
      font-size: 12px;
      line-height: 1.35;
      font-weight: 700;
    }
    .ticket-container {
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 2.5mm 1mm 8mm 1mm;
      background: #ffffff;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 900; }
    .upper { text-transform: uppercase; }

    .header {
      text-align: center;
      margin-bottom: 5px;
    }
    .clinic-title {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      line-height: 1.2;
      margin-bottom: 2px;
    }
    .clinic-subtitle {
      font-size: 10.5px;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .clinic-info {
      font-size: 10.5px;
      font-weight: 700;
      line-height: 1.3;
    }

    .sep-solid {
      border-top: 2px solid #000000;
      margin: 6px 0;
    }
    .sep-dashed {
      border-top: 1.5px dashed #000000;
      margin: 5px 0;
    }

    .badge-volet {
      display: block;
      width: 100%;
      border: 2px solid #000000;
      background: #000000;
      color: #ffffff !important;
      padding: 4px 6px;
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      text-align: center;
      letter-spacing: 0.5px;
      margin: 4px 0 3px 0;
    }
    .badge-sub {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      text-align: center;
      margin-bottom: 3px;
    }

    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
      margin-bottom: 3px;
      font-size: 11.5px;
      line-height: 1.3;
    }
    .row-label {
      font-weight: 700;
      flex-shrink: 0;
    }
    .row-val {
      text-align: right;
      font-weight: 800;
      word-break: break-word;
    }

    .patient-box {
      border: 2px solid #000000;
      padding: 5px 6px;
      margin: 5px 0;
      background: #ffffff;
    }
    .patient-name {
      font-size: 13.5px;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .total-box {
      border: 2.5px solid #000000;
      padding: 6px 7px;
      margin: 7px 0;
      background: #ffffff;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-title {
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .total-amount {
      font-size: 17px;
      font-weight: 900;
      text-align: right;
    }

    .status-stamp {
      display: inline-block;
      border: 2px solid #000000;
      padding: 3px 8px;
      font-weight: 900;
      font-size: 11px;
      margin: 5px 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .cut-line {
      margin: 12px 0;
      text-align: center;
    }
    .cut-line-dashes {
      border-top: 2px dashed #000000;
      margin: 4px 0;
    }
    .cut-text {
      font-size: 10.5px;
      font-weight: 900;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }

    /* Volet 2 */
    .order-number-banner {
      border: 2.5px solid #000000;
      padding: 5px 6px;
      margin: 6px 0;
      text-align: center;
      background: #ffffff;
    }
    .order-label {
      font-size: 10.5px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .order-val {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 1.5px;
      line-height: 1.15;
      margin: 2px 0;
    }
    .order-date {
      font-size: 10.5px;
      font-weight: 800;
    }

    .vitals-grid {
      border: 2px solid #000000;
      margin: 6px 0;
      padding: 5px 6px;
      background: #ffffff;
    }
    .vitals-grid-title {
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      text-align: center;
      border-bottom: 2px solid #000000;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .param-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      border-bottom: 1.5px dashed #000000;
      font-size: 11.5px;
    }
    .param-row:last-child {
      border-bottom: none;
    }
    .param-name {
      font-weight: 800;
    }
    .param-box {
      border: 1.5px solid #000000;
      padding: 2px 6px;
      min-width: 82px;
      min-height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 11.5px;
      background: #ffffff;
    }

    .signature-area {
      border: 1.5px solid #000000;
      padding: 5px 6px;
      margin-top: 6px;
      font-size: 10.5px;
      font-weight: 800;
    }
    .footer-note {
      font-size: 10px;
      font-weight: 800;
      text-align: center;
      margin-top: 6px;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="ticket-container">

    ${showPayment ? `
    <div class="section-volet-1">
      <div class="header">
        <div class="clinic-title">${escapeHtml(clinicName)}</div>
        ${clinicSlogan ? `<div class="clinic-subtitle">${escapeHtml(clinicSlogan)}</div>` : ''}
        <div class="clinic-info">
          ${escapeHtml(clinicAddress)}<br>
          Tel : ${escapeHtml(clinicPhone)}<br>
          ${escapeHtml(clinicTax)}
        </div>
      </div>

      <div class="sep-solid"></div>

      <div class="badge-volet">VOLET 1 : RECU DE PAIEMENT</div>
      <div class="badge-sub">CONSERVER COMME JUSTIFICATIF</div>

      <div class="sep-dashed"></div>

      <div class="row">
        <span class="row-label">Recu N° :</span>
        <span class="row-val bold">${escapeHtml(data.receiptNumber)}</span>
      </div>
      <div class="row">
        <span class="row-label">Date &amp; Heure :</span>
        <span class="row-val">${escapeHtml(dateStr)}</span>
      </div>
      <div class="row">
        <span class="row-label">Caissier(ere) :</span>
        <span class="row-val">${escapeHtml(cashier)}</span>
      </div>

      <div class="patient-box">
        <div class="patient-name">${escapeHtml(patientFullName)}</div>
        <div class="row" style="margin-bottom: 1px;">
          <span class="row-label">Dossier N° :</span>
          <span class="row-val">${escapeHtml(data.patient.patientNumber)}</span>
        </div>
        <div class="row" style="margin-bottom: 0;">
          <span class="row-label">Tel :</span>
          <span class="row-val">${escapeHtml(data.patient.phone || 'Neant')}</span>
        </div>
      </div>

      ${data.items && data.items.length > 1 ? `
      <div style="margin: 4px 0 3px 0; font-size: 11px; font-weight: 900; text-transform: uppercase;">
        Actes factures (${data.items.length}) :
      </div>
      ${data.items.map((it) => `
      <div class="row" style="font-size: 11px; margin-bottom: 2px;">
        <span class="row-label">- ${escapeHtml(it.name)}${it.quantity && it.quantity > 1 ? ` (x${it.quantity})` : ''}</span>
        <span class="row-val bold">${formatTicketMoney(it.price * (it.quantity || 1), currency)}</span>
      </div>
      `).join('')}
      ` : `
      <div class="row">
        <span class="row-label">Acte medical :</span>
        <span class="row-val bold">${escapeHtml(data.actName)}</span>
      </div>
      `}

      ${Number(data.amount) === 0 ? `
      <div class="total-box" style="text-align: center;">
        <div style="font-weight: 900; font-size: 14px; text-transform: uppercase;">
          CONSULTATION GRATUITE (0 Ar)
        </div>
        <div style="font-size: 10.5px; font-weight: 800; margin-top: 2px;">
          PRISE EN CHARGE CLINIQUE
        </div>
      </div>
      <div class="center">
        <span class="status-stamp">CONSULTATION EXONEREE</span>
      </div>
      ` : `
      <div class="total-box">
        <div class="total-row">
          <span class="total-title">TOTAL PAYE :</span>
          <span class="total-amount">${formatTicketMoney(data.amount, currency)}</span>
        </div>
      </div>

      <div class="row">
        <span class="row-label">Reglement :</span>
        <span class="row-val bold">${escapeHtml(paymentStr)}</span>
      </div>
      ${data.paymentReference ? `
      <div class="row">
        <span class="row-label">Ref. Trans. :</span>
        <span class="row-val bold">${escapeHtml(data.paymentReference)}</span>
      </div>
      ` : data.paymentMethod !== 'CASH' ? `
      <div class="row" style="margin-top: 3px; align-items: flex-end;">
        <span class="row-label">Ref. Trans. :</span>
        <span class="row-val" style="border-bottom: 1.5px solid #000; min-width: 120px; display: inline-block; height: 14px;">&nbsp;</span>
      </div>
      ` : ''}
      ${cashTendered !== null ? `
      <div class="row">
        <span class="row-label">Montant remis :</span>
        <span class="row-val">${formatTicketMoney(cashTendered, currency)}</span>
      </div>
      <div class="row">
        <span class="row-label">Monnaie rendue :</span>
        <span class="row-val bold">${formatTicketMoney(changeDue || 0, currency)}</span>
      </div>
      ` : ''}

      <div class="center">
        <span class="status-stamp">[OK] PAIEMENT VALIDE &amp; ENCAISSE</span>
      </div>
      `}

      <div class="footer-note">
        Merci pour votre confiance.<br>
        Valable pour la consultation du jour uniquement.
      </div>
    </div>
    ` : ''}

    ${mode === 'all' ? `
    <div class="cut-line">
      <div class="cut-line-dashes"></div>
      <div class="cut-text">--- DECOUPE / VOLET CONSULTATION ---</div>
      <div class="cut-line-dashes"></div>
    </div>
    ` : ''}

    ${showVitals ? `
    <div class="section-volet-2">
      <div class="center">
        <div style="font-size: 14px; font-weight: 900; text-transform: uppercase;">
          ${escapeHtml(clinicName)}
        </div>
      </div>
      <div class="badge-volet">VOLET 2 : FICHE NAVETTE MEDICALE</div>
      <div class="badge-sub">A PRESENTER AU CABINET DE CONSULTATION</div>

      <div class="order-number-banner">
        <div class="order-label">N° DE PASSAGE DU JOUR</div>
        <div class="order-val">#${escapeHtml(orderNumStr)}</div>
        <div class="order-date">${escapeHtml(dateOnlyStr)} - Heure : ${escapeHtml(timeOnlyStr)}</div>
      </div>

      <div class="patient-box">
        <div class="patient-name">${escapeHtml(patientFullName)}</div>
        <div class="row" style="margin-bottom: 1px;">
          <span class="row-label">N° Dossier :</span>
          <span class="row-val">${escapeHtml(data.patient.patientNumber)}</span>
        </div>
        <div class="row" style="margin-bottom: 0;">
          <span class="row-label">Motif :</span>
          <span class="row-val">${escapeHtml(volet2Motif)}</span>
        </div>
      </div>

      <div class="vitals-grid">
        <div class="vitals-grid-title">PARAMETRES VITAUX (CONSTANTES)</div>

        <div class="param-row">
          <span class="param-name">Tension (TA) :</span>
          <span class="param-box">${bpVal ? escapeHtml(bpVal) + ' mmHg' : '_____ / _____'}</span>
        </div>

        <div class="param-row">
          <span class="param-name">Poids :</span>
          <span class="param-box">${weightVal ? escapeHtml(weightVal) : '________ kg'}</span>
        </div>

        <div class="param-row">
          <span class="param-name">Taille :</span>
          <span class="param-box">${heightVal ? escapeHtml(heightVal) : '________ cm'}</span>
        </div>

        <div class="param-row">
          <span class="param-name">Temperature :</span>
          <span class="param-box">${tempVal ? escapeHtml(tempVal) : '________ °C'}</span>
        </div>

        <div class="param-row">
          <span class="param-name">Pouls / FC :</span>
          <span class="param-box">${pulseVal ? escapeHtml(pulseVal) : '_______ bpm'}</span>
        </div>

        <div class="param-row">
          <span class="param-name">SpO2 (O2) :</span>
          <span class="param-box">${spo2Val ? escapeHtml(spo2Val) : '________ %'}</span>
        </div>
      </div>

      <div class="signature-area">
        <div>Infirmier(ere) : ______________________</div>
        <div style="margin-top: 4px;">Heure prise : _____ : _____</div>
      </div>

      <div class="footer-note" style="border-top: 1.5px dashed #000000; padding-top: 5px;">
        A remettre obligatoirement au medecin praticien<br>
        lors de votre entree en salle de consultation.
      </div>
    </div>
    ` : ''}

  </div>
</body>
</html>`;
}

/**
 * Lance l'impression isolée via iframe pour imprimante thermique 80mm
 */
export function printConsultationDualTicket(
  data: ConsultationTicketData,
  mode: 'all' | 'payment' | 'vitals' = 'all'
): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    const existingFrame = document.getElementById('consultation-dual-ticket-iframe');
    if (existingFrame) {
      existingFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'consultation-dual-ticket-iframe';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '80mm';
    iframe.style.height = 'auto';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      resolve(false);
      return;
    }

    const htmlContent = generateConsultationDualTicketHtml(data, mode);
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve(true);
      } catch (err) {
        console.error('Consultation print error:', err);
        window.print();
        resolve(false);
      }
    }, 300);
  });
}
