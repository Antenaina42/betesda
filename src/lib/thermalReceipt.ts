/**
 * Utilitaire d'impression pour imprimante de ticket thermique pharmacie (80mm)
 * Compatible Epson TM-T20, TM-T88, Star Micronics, Xprinter, etc.
 * Haute netteté monochrome : 100% noir pur (#000000) sur fond blanc (#ffffff),
 * police sans-serif grasse anti-flou, zéro nuance de gris, code-barres crispEdges.
 */

export interface ThermalReceiptItem {
  medicineName: string;
  dosage?: string | null;
  form?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ThermalReceiptData {
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
  saleNumber: string;
  saleDate: string | Date;
  cashierName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethod: string;
  paymentReference?: string | null;
  items: ThermalReceiptItem[];
  subtotal: number;
  discount?: number | null;
  total: number;
  isFreeGift?: boolean | null;
  cashTendered?: number | string | null;
  changeDue?: number | string | null;
}

export function formatPaymentMethod(method: string): string {
  switch (method) {
    case 'CASH':
      return 'Especes (Cash)';
    case 'MOBILE_MONEY':
      return 'Mobile Money';
    case 'CREDIT_CARD':
      return 'Carte Bancaire';
    case 'BANK_TRANSFER':
      return 'Virement Bancaire';
    default:
      return method || 'Especes';
  }
}

export function formatReceiptMoney(amount: number | null | undefined, currency: string = 'Ar'): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return `0 ${currency}`;
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(Number(amount))
    .replace(/[\u00A0\u202F]/g, ' ');
  return `${formatted} ${currency}`;
}

export function formatReceiptDateTime(date: string | Date | null | undefined): string {
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

/**
 * Génère le code HTML haute netteté optimisé pour imprimante thermique 80mm (largeur utile 72mm)
 */
export function generateThermalReceiptHtml(data: ThermalReceiptData): string {
  const currency = data.clinic?.currency || 'Ar';
  const clinicName = data.clinic?.name || 'CLINIQUE BETESDA';
  const clinicSlogan = data.clinic?.slogan || 'Soins & Pharmacie';
  const clinicAddress = data.clinic?.address || 'Lot IVG 35 Rue Pasteur, Antananarivo';
  const clinicPhone = data.clinic?.phone || '034 51 365 45 / 034 53 689 59';
  const clinicTax = data.clinic?.taxId || 'NIF: 3 005 710 430 - Stat: 86201 11 2021 0 08027';
  const clinicEmail = data.clinic?.email || 'contact@betesda.com';

  const cashier = data.cashierName || 'Caisse Pharmacie';
  const customer = data.customerName || 'Client de passage';
  const dateStr = formatReceiptDateTime(data.saleDate);
  const paymentStr = formatPaymentMethod(data.paymentMethod);

  const subtotal = Number(data.subtotal || 0);
  const discount = Number(data.discount || 0);
  const total = Number(data.total || 0);
  const cashTendered = data.cashTendered ? Number(data.cashTendered) : null;
  const changeDue = data.changeDue ? Number(data.changeDue) : null;

  const totalQuantity = (data.items || []).reduce((acc, item) => acc + item.quantity, 0);

  const itemsHtml = (data.items || [])
    .map((it) => {
      const unit = formatReceiptMoney(it.unitPrice, currency);
      const lineTotal = formatReceiptMoney(it.totalPrice, currency);
      return `
        <div class="item-row">
          <div class="item-name">${escapeHtml(it.medicineName)}</div>
          <div class="item-details">
            <span class="item-qty-pu">${it.quantity} x ${unit}</span>
            <span class="item-total">${lineTotal}</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Ticket - ${escapeHtml(data.saleNumber)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    *, *:before, *:after {
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
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Arial', 'Helvetica Neue', 'Liberation Sans', 'DejaVu Sans', sans-serif;
      font-size: 12px;
      line-height: 1.35;
      font-weight: 700;
      width: 80mm;
      max-width: 80mm;
    }
    .ticket-container {
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 2.5mm 1mm 10mm 1mm;
      background: #ffffff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: 900; }
    .uppercase { text-transform: uppercase; }

    /* Header Clinique */
    .clinic-title {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.4px;
      line-height: 1.2;
      margin-bottom: 2px;
    }
    .clinic-slogan {
      font-size: 10.5px;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .clinic-meta {
      font-size: 10.5px;
      font-weight: 700;
      line-height: 1.3;
    }
    .clinic-tax {
      font-size: 10px;
      margin-top: 2px;
      font-weight: 800;
    }

    /* Séparateurs nets 100% noir */
    .sep-solid {
      border-top: 2px solid #000000;
      margin: 6px 0;
    }
    .sep-dashed {
      border-top: 1.5px dashed #000000;
      margin: 5px 0;
    }

    /* En-tête Ticket */
    .ticket-badge {
      display: block;
      width: 100%;
      background: #000000;
      color: #ffffff !important;
      border: 2px solid #000000;
      padding: 4px 6px;
      font-size: 12.5px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-align: center;
      margin: 4px 0 3px 0;
    }
    .ticket-sub-banner {
      border: 1.5px solid #000000;
      padding: 3px 4px;
      font-size: 10px;
      font-weight: 900;
      text-align: center;
      margin-bottom: 5px;
      text-transform: uppercase;
    }

    .info-table {
      width: 100%;
      font-size: 11.5px;
      border-collapse: collapse;
      margin: 3px 0;
    }
    .info-table td {
      padding: 1.5px 0;
      vertical-align: top;
    }
    .info-label {
      width: 34%;
      font-weight: 700;
    }
    .info-val {
      width: 66%;
      font-weight: 900;
    }

    /* Articles */
    .items-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 900;
      padding: 2px 0;
      text-transform: uppercase;
    }
    .item-row {
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px dashed #000000;
      page-break-inside: avoid;
    }
    .item-row:last-child {
      border-bottom: none;
      margin-bottom: 2px;
      padding-bottom: 0;
    }
    .item-name {
      font-weight: 900;
      font-size: 12px;
      word-break: break-word;
      margin-bottom: 1px;
    }
    .item-details {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      padding-left: 4px;
    }
    .item-qty-pu {
      font-weight: 700;
    }
    .item-total {
      font-weight: 900;
    }

    /* Totaux financiers */
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 11.5px;
    }
    .totals-table td {
      padding: 2px 0;
      font-weight: 800;
    }
    .net-box {
      border: 2.5px solid #000000;
      padding: 6px 7px;
      margin: 6px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 15px;
      font-weight: 900;
      background: #ffffff;
    }

    /* Pied de ticket */
    .barcode-container {
      margin: 8px 0 4px 0;
      text-align: center;
    }
    .barcode-svg {
      width: 210px;
      height: 42px;
      margin: 0 auto;
      display: block;
    }
    .barcode-text {
      font-size: 11.5px;
      letter-spacing: 1.5px;
      font-weight: 900;
      margin-top: 3px;
    }
    .disclaimer {
      font-size: 10px;
      font-weight: 700;
      line-height: 1.35;
      margin-top: 4px;
    }
    .thanks {
      font-size: 12.5px;
      font-weight: 900;
      letter-spacing: 0.4px;
      margin: 6px 0 2px 0;
    }
    .cut-guide {
      text-align: center;
      font-size: 10px;
      font-weight: 800;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="ticket-container">
    <div class="text-center">
      <div class="clinic-title uppercase">${escapeHtml(clinicName)}</div>
      ${clinicSlogan ? `<div class="clinic-slogan">${escapeHtml(clinicSlogan)}</div>` : ''}
      ${clinicAddress ? `<div class="clinic-meta">${escapeHtml(clinicAddress)}</div>` : ''}
      ${clinicPhone ? `<div class="clinic-meta">Tel : ${escapeHtml(clinicPhone)}</div>` : ''}
      ${clinicEmail ? `<div class="clinic-meta">${escapeHtml(clinicEmail)}</div>` : ''}
      ${clinicTax ? `<div class="clinic-tax">${escapeHtml(clinicTax)}</div>` : ''}
    </div>

    <div class="sep-solid"></div>

    <div class="ticket-badge">TICKET CAISSE PHARMACIE</div>
    <div class="ticket-sub-banner">
      PAYE A L'ACCUEIL - A PRESENTER A LA PHARMACIE
    </div>

    <table class="info-table">
      <tr>
        <td class="info-label">Ticket N°</td>
        <td class="info-val">: ${escapeHtml(data.saleNumber)}</td>
      </tr>
      <tr>
        <td class="info-label">Date</td>
        <td class="info-val">: ${escapeHtml(dateStr)}</td>
      </tr>
      <tr>
        <td class="info-label">Caissier</td>
        <td class="info-val">: ${escapeHtml(cashier)}</td>
      </tr>
      <tr>
        <td class="info-label">Client</td>
        <td class="info-val">: ${escapeHtml(customer)}</td>
      </tr>
      ${data.customerPhone ? `
      <tr>
        <td class="info-label">Contact</td>
        <td class="info-val">: ${escapeHtml(data.customerPhone)}</td>
      </tr>` : ''}
      <tr>
        <td class="info-label">Reglement</td>
        <td class="info-val">: ${escapeHtml(paymentStr)}</td>
      </tr>
      ${data.paymentReference ? `
      <tr>
        <td class="info-label">Ref. Trans.</td>
        <td class="info-val">: ${escapeHtml(data.paymentReference)}</td>
      </tr>` : data.paymentMethod !== 'CASH' ? `
      <tr>
        <td class="info-label">Ref. Trans.</td>
        <td class="info-val" style="border-bottom: 1.5px solid #000; min-width: 110px;">: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
      </tr>` : ''}
    </table>

    <div class="sep-solid"></div>

    <div class="items-header">
      <span>DESIGNATION / QTE x P.U</span>
      <span>TOTAL</span>
    </div>
    <div class="sep-solid" style="margin-top: 3px;"></div>

    <div class="items-list">
      ${itemsHtml}
    </div>

    <div class="sep-solid"></div>

    <table class="totals-table">
      <tr>
        <td>Nombre d'articles :</td>
        <td class="text-right bold">${totalQuantity}</td>
      </tr>
      <tr>
        <td>Sous-total :</td>
        <td class="text-right">${formatReceiptMoney(subtotal, currency)}</td>
      </tr>
      ${discount > 0 ? `
      <tr>
        <td>Remise accordee :</td>
        <td class="text-right bold">- ${formatReceiptMoney(discount, currency)}</td>
      </tr>` : ''}
    </table>

    ${data.isFreeGift || total === 0 ? `
    <div class="net-box" style="display:block; text-align:center; padding: 6px;">
      <div style="font-size: 13.5px; font-weight: 900;">DISPENSATION GRATUITE (0 Ar)</div>
      <div style="font-size: 10.5px; font-weight: 800; margin-top: 2px; text-transform: uppercase;">Prise en charge 100% Clinique Betesda</div>
    </div>
    ` : `
    <div class="net-box">
      <span>NET A PAYER :</span>
      <span>${formatReceiptMoney(total, currency)}</span>
    </div>
    `}

    ${cashTendered !== null && cashTendered > 0 ? `
    <table class="totals-table">
      <tr>
        <td>Montant verse :</td>
        <td class="text-right">${formatReceiptMoney(cashTendered, currency)}</td>
      </tr>
      <tr>
        <td>Monnaie rendue :</td>
        <td class="text-right bold">${formatReceiptMoney(changeDue || 0, currency)}</td>
      </tr>
    </table>
    ` : ''}

    <div class="sep-dashed"></div>

    <div class="barcode-container">
      ${generateBarcodeSvg(data.saleNumber)}
      <div class="barcode-text">*${escapeHtml(data.saleNumber)}*</div>
    </div>

    <div class="text-center">
      <div class="thanks">MERCI DE VOTRE VISITE</div>
      <div style="font-weight: 900; font-size: 11.5px; margin-bottom: 4px;">Bon retablissement !</div>
      <div class="disclaimer">
        Les medicaments ne sont ni repris ni echanges.<br>
        Conserver hors de portee des enfants (&lt; 25°C).
      </div>
      <div class="sep-dashed" style="margin: 6px auto; width: 70%;"></div>
      <div style="font-size: 10px; font-weight: 800;">
        Clinique Betesda - Officine Pharmaceutique
      </div>
    </div>

    <div class="cut-guide">---------- DECOUPE TICKET ----------</div>
  </div>
</body>
</html>`;
}

/**
 * Lance l'impression isolée sur l'imprimante ticket sans afficher les boutons ni l'interface du dashboard
 */
export function printThermalReceipt(data: ThermalReceiptData): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    const existingFrame = document.getElementById('thermal-receipt-iframe');
    if (existingFrame) {
      existingFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'thermal-receipt-iframe';
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

    const htmlContent = generateThermalReceiptHtml(data);
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve(true);
      } catch (err) {
        console.error('Thermal print error:', err);
        window.print();
        resolve(false);
      }
    }, 300);
  });
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
 * Génère un SVG de code-barres haute netteté (crispEdges, barres épaisses)
 * pour impression thermique 203 DPI sans flou ni bavure.
 */
function generateBarcodeSvg(text: string): string {
  const bars: Array<{ x: number; w: number }> = [];
  let currentX = 8;
  const safeText = text || 'VTE';
  const hash = safeText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Guard bars
  bars.push({ x: currentX, w: 3 });
  currentX += 6;
  bars.push({ x: currentX, w: 3 });
  currentX += 6;

  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i);
    const w1 = (code % 3) + 2; // 2..4 px (évite les barres fines 1px floues)
    const s1 = ((code + i) % 2) + 3;
    const w2 = ((code * 2) % 3) + 2;
    const s2 = ((code + hash) % 2) + 3;

    bars.push({ x: currentX, w: w1 });
    currentX += w1 + s1;
    bars.push({ x: currentX, w: w2 });
    currentX += w2 + s2;
  }

  // End guard bars
  bars.push({ x: currentX, w: 3 });
  currentX += 6;
  bars.push({ x: currentX, w: 3 });
  currentX += 8;

  const rects = bars
    .map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="40" fill="#000000" />`)
    .join('');

  return `<svg viewBox="0 0 ${currentX} 40" class="barcode-svg" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${currentX}" height="40" fill="#ffffff" />${rects}</svg>`;
}
