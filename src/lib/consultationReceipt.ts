/**
 * Utilitaire d'impression pour le double ticket de consultation thermique (80mm)
 * Clinique Betesda
 *
 * Sort en 2 étapes / volets :
 * Volet 1 : Ticket / Reçu de réception de paiement de consultation (remis au patient comme preuve d'encaissement)
 * Volet 2 : Fiche navette de consultation avec champs dédiés pour la prise de paramètres vitaux (Tension, Poids, Taille, T°, etc.)
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
  receiptNumber: string; // Ex: REC-CONS-2026-0042
  orderNumber?: number | string; // Ex: #008 (numéro d'ordre de passage du jour)
  consultationId?: string;
  date: string | Date;
  cashierName?: string | null; // Nom de l'agent d'accueil ou pharmacien
  patient: {
    id?: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    age?: number | string | null;
    gender?: string | null;
  };
  doctorName?: string | null; // Médecin affecté
  specialty?: string | null;
  actName: string; // Ex: Consultation Médecine Générale
  items?: Array<{ name: string; price: number; quantity?: number }>;
  amount: number;
  paymentMethod: string;
  paymentReference?: string | null;
  cashTendered?: number | string | null;
  changeDue?: number | string | null;
  reason?: string | null; // Motif de la consultation
  vitals?: {
    temperature?: number | string | null;
    bloodPressure?: string | null; // Ex: "120/80" ou "12/8"
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
  }).format(Number(amount));
  return `${formatted} ${currency}`;
}

export function formatTicketDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function formatTicketDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatTicketPaymentMethod(method: string): string {
  switch (method) {
    case 'CASH':
      return 'Espèces (Cash)';
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
      return 'Chèque';
    case 'BANK_TRANSFER':
      return 'Virement';
    default:
      return method || 'Espèces';
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
 * Génère le code HTML complet du ticket thermique 80mm (Double Volet)
 * Mode: 'all' (les deux volets), 'payment' (reçu uniquement), 'vitals' (fiche navette uniquement)
 */
export function generateConsultationDualTicketHtml(
  data: ConsultationTicketData,
  mode: 'all' | 'payment' | 'vitals' = 'all'
): string {
  const currency = data.clinic?.currency || 'Ar';
  const clinicName = data.clinic?.name || 'CLINIQUE BETESDA';
  const clinicSlogan = data.clinic?.slogan || 'Soins, Bienveillance & Gestion Intelligente';
  const clinicAddress = data.clinic?.address || 'Lot IVG 35 Rue Pasteur, Antananarivo, Madagascar';
  const clinicPhone = data.clinic?.phone || '034 51 365 45 / 034 53 689 59';
  const clinicTax = data.clinic?.taxId || 'NIF: 3 005 710 430 - N° Stat: 86201 11 2021 0 08027';

  const dateStr = formatTicketDateTime(data.date);
  const dateOnlyStr = formatTicketDate(data.date);
  const paymentStr = formatTicketPaymentMethod(data.paymentMethod);
  const patientFullName = `${data.patient.lastName.toUpperCase()} ${data.patient.firstName}`;
  const cashier = data.cashierName || 'Accueil Clinique';
  const rawDoctor = data.doctorName ? data.doctorName.trim() : 'Médecin de consultation';
  const doctor = (rawDoctor !== 'Médecin de consultation' && rawDoctor !== 'Médecin consultant')
    ? (rawDoctor.replace(/^(Dr\.?\s*)+/i, 'Dr. ').startsWith('Dr. ') || rawDoctor.startsWith('Prof.') ? rawDoctor.replace(/^(Dr\.?\s*)+/i, 'Dr. ') : `Dr. ${rawDoctor}`)
    : rawDoctor;
  const orderNumStr = data.orderNumber
    ? String(data.orderNumber).padStart(3, '0')
    : '001';

  const cashTendered = data.cashTendered ? Number(data.cashTendered) : null;
  const changeDue = data.changeDue ? Number(data.changeDue) : null;

  // Constantes vitals pré-remplies ou vides
  const bpVal = data.vitals?.bloodPressure || (
    data.vitals?.systolicBP && data.vitals?.diastolicBP
      ? `${data.vitals.systolicBP}/${data.vitals.diastolicBP}`
      : ''
  );
  const tempVal = data.vitals?.temperature ? `${data.vitals.temperature} °C` : '';
  const weightVal = data.vitals?.weight ? `${data.vitals.weight} kg` : '';
  const heightVal = data.vitals?.height ? `${data.vitals.height} cm` : '';
  const pulseVal = data.vitals?.heartRate ? `${data.vitals.heartRate} bpm` : '';
  const spo2Val = data.vitals?.oxygenSaturation ? `${data.vitals.oxygenSaturation} %` : '';
  const bloodSugarVal = data.vitals?.bloodSugar ? `${data.vitals.bloodSugar} g/L` : '';

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
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Courier New', Courier, monospace, 'Lucida Console', Monaco;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: 76mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 4mm 2.5mm;
    }
    .ticket-container {
      width: 100%;
    }
    .center {
      text-align: center;
    }
    .right {
      text-align: right;
    }
    .bold {
      font-weight: bold;
    }
    .header {
      text-align: center;
      margin-bottom: 5px;
    }
    .clinic-title {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 1px;
    }
    .clinic-subtitle {
      font-size: 8.5px;
      font-style: italic;
      color: #333;
      margin-bottom: 3px;
    }
    .clinic-info {
      font-size: 8.5px;
      color: #444;
      line-height: 1.25;
    }
    .sep-solid {
      border-top: 1.5px solid #000;
      margin: 5px 0;
    }
    .sep-double {
      border-top: 2.5px double #000;
      margin: 6px 0;
    }
    .sep-dashed {
      border-top: 1px dashed #444;
      margin: 5px 0;
    }
    .badge-volet {
      display: inline-block;
      border: 1.5px solid #000;
      padding: 2px 7px;
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      margin: 3px auto 4px auto;
      letter-spacing: 0.5px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2.5px;
      font-size: 10.5px;
    }
    .row-label {
      font-weight: bold;
      color: #222;
      flex-shrink: 0;
    }
    .row-val {
      text-align: right;
      word-break: break-word;
    }
    .total-box {
      border: 1.5px solid #000;
      padding: 5px 6px;
      margin: 6px 0;
      background: #fafafa;
    }
    .total-title {
      font-size: 10px;
      font-weight: bold;
    }
    .total-amount {
      font-size: 16px;
      font-weight: 900;
      text-align: right;
    }
    .status-stamp {
      border: 1px solid #000;
      padding: 2px 6px;
      display: inline-block;
      font-weight: bold;
      font-size: 10px;
      margin: 4px 0;
      text-transform: uppercase;
    }
    /* Ligne de découpe thermique */
    .cut-line {
      margin: 10px 0;
      text-align: center;
      position: relative;
    }
    .cut-line-dashes {
      border-top: 2px dashed #000;
      margin-bottom: 4px;
    }
    .cut-text {
      font-size: 8.5px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #333;
    }

    /* Volet 2 : Fiche navette & Paramètres */
    .order-number-banner {
      border: 2px solid #000;
      padding: 4px 6px;
      margin: 5px 0;
      text-align: center;
      background: #f4f4f4;
    }
    .order-label {
      font-size: 8.5px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .order-val {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 1.5px;
      line-height: 1.1;
    }
    .vitals-grid {
      border: 1.5px solid #000;
      margin: 6px 0;
      padding: 5px;
      background: #fff;
    }
    .vitals-grid-title {
      font-weight: 900;
      font-size: 10px;
      text-transform: uppercase;
      text-align: center;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .param-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
      border-bottom: 1px dotted #888;
      font-size: 10px;
    }
    .param-row:last-child {
      border-bottom: none;
    }
    .param-name {
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .param-box {
      border: 1px solid #333;
      padding: 1px 6px;
      min-width: 65px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 10px;
      background: #fafafa;
    }
    .param-fill {
      font-weight: 900;
      color: #000;
    }
    .signature-area {
      border: 1px dashed #666;
      padding: 4px 6px;
      margin-top: 6px;
      font-size: 8.5px;
    }
    .footer-note {
      font-size: 8px;
      text-align: center;
      color: #444;
      margin-top: 5px;
      line-height: 1.25;
    }
  </style>
</head>
<body>
  <div class="ticket-container">

    ${showPayment ? `
    <!-- ============================================================= -->
    <!-- VOLET 1 : REÇU DE PAIEMENT DE CONSULTATION (POUR LE PATIENT)   -->
    <!-- ============================================================= -->
    <div class="section-volet-1">
      <div class="header">
        <div class="clinic-title">${escapeHtml(clinicName)}</div>
        <div class="clinic-subtitle">${escapeHtml(clinicSlogan)}</div>
        <div class="clinic-info">
          ${escapeHtml(clinicAddress)}<br>
          Tél : ${escapeHtml(clinicPhone)} • ${escapeHtml(clinicTax)}
        </div>
      </div>

      <div class="sep-solid"></div>

      <div class="center">
        <div class="badge-volet">VOLET 1 : REÇU DE PAIEMENT</div>
        <div style="font-size: 8.5px; font-weight: bold; color: #333;">CONSERVER COMME JUSTIFICATIF</div>
      </div>

      <div class="sep-dashed"></div>

      <div class="row">
        <span class="row-label">Reçu N° :</span>
        <span class="row-val bold">${escapeHtml(data.receiptNumber)}</span>
      </div>
      <div class="row">
        <span class="row-label">Date &amp; Heure :</span>
        <span class="row-val">${escapeHtml(dateStr)}</span>
      </div>
      <div class="row">
        <span class="row-label">Caissier(ère) :</span>
        <span class="row-val">${escapeHtml(cashier)}</span>
      </div>

      <div class="sep-dashed"></div>

      <div class="row">
        <span class="row-label">PATIENT :</span>
        <span class="row-val bold">${escapeHtml(patientFullName)}</span>
      </div>
      <div class="row">
        <span class="row-label">Dossier N° :</span>
        <span class="row-val">${escapeHtml(data.patient.patientNumber)}</span>
      </div>
      ${data.patient.phone ? `
      <div class="row">
        <span class="row-label">Téléphone :</span>
        <span class="row-val">${escapeHtml(data.patient.phone)}</span>
      </div>
      ` : ''}

      <div class="sep-dashed"></div>

      ${data.items && data.items.length > 1 ? `
      <div style="margin: 4px 0 2px 0; font-size: 9px; font-weight: bold; text-transform: uppercase; color: #222;">
        Actes &amp; Prestations facturés (${data.items.length}) :
      </div>
      ${data.items.map(it => `
      <div class="row" style="font-size: 9.5px; margin: 1px 0;">
        <span class="row-label">• ${escapeHtml(it.name)}${it.quantity && it.quantity > 1 ? ` (x${it.quantity})` : ''}</span>
        <span class="row-val bold">${formatTicketMoney(it.price * (it.quantity || 1), currency)}</span>
      </div>
      `).join('')}
      ` : `
      <div class="row">
        <span class="row-label">Acte médical :</span>
        <span class="row-val bold">${escapeHtml(data.actName)}</span>
      </div>
      `}
      ${Number(data.amount) === 0 ? `
      <div class="total-box" style="border: 2px dashed #000; padding: 5px; background: #fff;">
        <div style="font-weight: 900; font-size: 13px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
          CONSULTATION GRATUITE (0 Ar)
        </div>
        <div style="font-size: 9.5px; font-weight: 800; text-align: center; color: #111; margin-top: 2px;">
          PRISE EN CHARGE CLINIQUE GRACIEUSE
        </div>
      </div>
      <div class="center" style="margin-top: 4px;">
        <span class="status-stamp" style="font-weight: 900; border: 2px solid #000;">★ CONSULTATION EXONÉRÉE • ACCUEIL ★</span>
      </div>
      ` : `
      <div class="total-box">
        <div class="row" style="margin-bottom: 0;">
          <span class="total-title">TOTAL PAYÉ :</span>
          <span class="total-amount">${formatTicketMoney(data.amount, currency)}</span>
        </div>
      </div>

      <div class="row">
        <span class="row-label">Règlement :</span>
        <span class="row-val bold">${escapeHtml(paymentStr)}</span>
      </div>
      ${data.paymentReference ? `
      <div class="row">
        <span class="row-label">Réf. Trans. :</span>
        <span class="row-val bold">${escapeHtml(data.paymentReference)}</span>
      </div>
      ` : (data.paymentMethod !== 'CASH' ? `
      <div class="row" style="margin-top: 3px; align-items: flex-end;">
        <span class="row-label">Réf. Trans. :</span>
        <span class="row-val" style="border-bottom: 1.5px dotted #333; min-width: 135px; display: inline-block; height: 14px;">&nbsp;</span>
      </div>
      ` : '')}
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

      <div class="center" style="margin-top: 4px;">
        <span class="status-stamp">✓ PAIEMENT VALIDÉ &amp; ENCAISSÉ</span>
      </div>
      `}

      <div class="footer-note">
        Merci pour votre confiance.<br>
        Valable pour la consultation du jour uniquement.
      </div>
    </div>
    ` : ''}

    ${mode === 'all' ? `
    <!-- ============================================================= -->
    <!-- LIGNE DE DÉCOUPE / PERFORATION THERMIQUE                      -->
    <!-- ============================================================= -->
    <div class="cut-line">
      <div class="cut-line-dashes"></div>
      <div class="cut-text">✂ - - - DÉCOUPE / VOLET CONSULTATION - - - ✂</div>
      <div class="cut-line-dashes" style="margin-top: 4px;"></div>
    </div>
    ` : ''}

    ${showVitals ? `
    <!-- ============================================================= -->
    <!-- VOLET 2 : FICHE NAVETTE DE PRISE DE CONSTANTES & CONSULTATION -->
    <!-- ============================================================= -->
    <div class="section-volet-2">
      <div class="center">
        <div style="font-size: 13px; font-weight: 900; text-transform: uppercase;">
          ${escapeHtml(clinicName)}
        </div>
        <div class="badge-volet" style="margin-top: 2px;">
          VOLET 2 : FICHE NAVETTE MÉDICALE
        </div>
        <div style="font-size: 8.5px; font-weight: bold; color: #222;">
          À PRÉSENTER AU CABINET DE CONSULTATION
        </div>
      </div>

      <!-- BANNIÈRE NUMÉRO DE PASSAGE -->
      <div class="order-number-banner">
        <div class="order-label">N° DE PASSAGE DU JOUR</div>
        <div class="order-val">#${escapeHtml(orderNumStr)}</div>
        <div style="font-size: 8.5px; color: #444;">${escapeHtml(dateOnlyStr)} • Heure : ${escapeHtml(dateStr.split(' ')[1] || '')}</div>
      </div>

      <div class="row">
        <span class="row-label">PATIENT :</span>
        <span class="row-val bold" style="font-size: 12px;">${escapeHtml(patientFullName)}</span>
      </div>
      <div class="row">
        <span class="row-label">N° Dossier :</span>
        <span class="row-val bold">${escapeHtml(data.patient.patientNumber)}</span>
      </div>
      <div class="row">
        <span class="row-label">Genre / Âge :</span>
        <span class="row-val">
          ${escapeHtml(data.patient.gender === 'MALE' ? 'Masculin' : data.patient.gender === 'FEMALE' ? 'Féminin' : (data.patient.gender || '-'))}
          ${data.patient.age ? ` • ${escapeHtml(String(data.patient.age))} ans` : ''}
        </span>
      </div>
      ${data.reason ? `
      <div class="row">
        <span class="row-label">Motif :</span>
        <span class="row-val">${escapeHtml(data.reason)}</span>
      </div>
      ` : ''}
      <div class="row">
        <span class="row-label">Actes demandés :</span>
        <span class="row-val bold" style="font-size: 10px;">
          ${escapeHtml(data.items && data.items.length > 0 ? data.items.map(i => i.name).join(' + ') : data.actName)}
        </span>
      </div>

      <!-- GRILLE DÉDIÉE PRISE DES PARAMÈTRES VITAUX -->
      <div class="vitals-grid">
        <div class="vitals-grid-title">
          ★ PRISE DES PARAMÈTRES VITAUX (CONSTANTES) ★
        </div>

        <!-- Tension -->
        <div class="param-row">
          <span class="param-name">🩺 Tension Artérielle (TA) :</span>
          <span class="param-box ${bpVal ? 'param-fill' : ''}">
            ${bpVal ? escapeHtml(bpVal) + ' mmHg' : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; mmHg'}
          </span>
        </div>

        <!-- Poids -->
        <div class="param-row">
          <span class="param-name">⚖️ Poids :</span>
          <span class="param-box ${weightVal ? 'param-fill' : ''}">
            ${weightVal ? escapeHtml(weightVal) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; kg'}
          </span>
        </div>

        <!-- Taille -->
        <div class="param-row">
          <span class="param-name">📏 Taille :</span>
          <span class="param-box ${heightVal ? 'param-fill' : ''}">
            ${heightVal ? escapeHtml(heightVal) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; cm'}
          </span>
        </div>

        <!-- Température -->
        <div class="param-row">
          <span class="param-name">🌡️ Température (T°) :</span>
          <span class="param-box ${tempVal ? 'param-fill' : ''}">
            ${tempVal ? escapeHtml(tempVal) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; °C'}
          </span>
        </div>

        <!-- Pouls / Fréquence cardiaque -->
        <div class="param-row">
          <span class="param-name">❤️ Pouls / Fréq. Card. :</span>
          <span class="param-box ${pulseVal ? 'param-fill' : ''}">
            ${pulseVal ? escapeHtml(pulseVal) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; bpm'}
          </span>
        </div>

        <!-- SpO2 -->
        <div class="param-row">
          <span class="param-name">🫁 Saturation O2 (SpO2) :</span>
          <span class="param-box ${spo2Val ? 'param-fill' : ''}">
            ${spo2Val ? escapeHtml(spo2Val) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; %'}
          </span>
        </div>
      </div>

      <!-- Signature Soignant / Infirmier -->
      <div class="signature-area">
        <div class="row" style="margin-bottom: 0;">
          <span>Infirmier(ère) : ________________</span>
          <span>Heure : ____:____</span>
        </div>
      </div>

      <div class="footer-note" style="margin-top: 6px; font-weight: bold; border-top: 1px dashed #666; padding-top: 4px;">
        ⚠️ À remettre obligatoirement au médecin praticien<br>
        lors de votre entrée en salle de consultation.
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
    iframe.style.height = '150mm';
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
    }, 280);
  });
}
