import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate, formatDateTime } from './formatters';

export interface ClinicInfo {
  name?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  address?: string;
}

const DEFAULT_CLINIC: ClinicInfo = {
  name: 'CLINIQUE BETESDA',
  phone: '034 51 365 45 / 034 53 689 59',
  email: 'contact@betesda.com',
  taxId: 'NIF: 3 005 710 430 - N° Stat: 86201 11 2021 0 08027',
  address: 'Lot IVG 35 Rue Pasteur, Antananarivo',
};

/**
 * Dessine l'en-tête officiel de la Clinique Betesda sur une page A4 (Design Clair & Lumineux)
 */
function drawOfficialHeader(doc: jsPDF, title: string, subtitle?: string, refStr?: string) {
  // Fine bande supérieure élégante et claire (Bleu royal & bleu ciel, aucun noir sombre)
  doc.setFillColor(37, 99, 235); // #2563eb
  doc.rect(0, 0, 210, 2.5, 'F');
  doc.setFillColor(14, 165, 233); // #0ea5e9
  doc.rect(0, 2.5, 210, 0.8, 'F');

  // En-tête Clinique
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 58, 138); // Bleu marine clinique profond
  doc.text(`+ ${DEFAULT_CLINIC.name}`, 10, 12.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(13, 148, 136); // Teal médical
  doc.text('DÉPARTEMENT GESTION COMPTABLE & FINANCIÈRE', 10, 16.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tél : ${DEFAULT_CLINIC.phone}  |  Email : ${DEFAULT_CLINIC.email}`, 10, 20.5);
  doc.setTextColor(100, 116, 139);
  doc.text(DEFAULT_CLINIC.taxId!, 10, 24);

  // Cadre Référence & Date (Droite) - Fond blanc et bordure légère
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(138, 7.5, 62, 18.5, 1.2, 1.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text('DOCUMENT COMPTABLE OFFICIEL', 169, 11, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text(refStr || `FIN-${new Date().getFullYear()}`, 169, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(`Édité le : ${formatDateTime(new Date())}`, 169, 20, { align: 'center' });
  doc.text('Format : A4 Normalisé', 169, 23.5, { align: 'center' });

  // Titre principal de la fiche (Fond clair perle, bordure fine, texte bleu marine lisible)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.roundedRect(10, 28, 190, 8, 1.2, 1.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text(title.toUpperCase(), 105, subtitle ? 32 : 33.5, { align: 'center' });

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 105, 34.8, { align: 'center' });
  }
}

/**
 * Dessine la grille de signatures officielle en bas de page (Fond blanc clair)
 */
function drawSignaturesFooter(doc: jsPDF, startY: number) {
  const sigY = Math.min(startY, 258);
  const boxW = 60;
  const boxH = 24;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);

  // Bloc 1 : Responsable financier
  doc.roundedRect(10, sigY, boxW, boxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('Le Responsable Caisse / Comptable', 10 + boxW / 2, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('Visa & Date', 10 + boxW / 2, sigY + boxH - 2, { align: 'center' });

  // Bloc 2 : Contrôle interne / Pharmacie
  doc.roundedRect(75, sigY, boxW, boxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('Contrôle de Gestion / Pharmacie', 75 + boxW / 2, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('Signature', 75 + boxW / 2, sigY + boxH - 2, { align: 'center' });

  // Bloc 3 : Direction
  doc.roundedRect(140, sigY, boxW, boxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('La Direction de la Clinique', 140 + boxW / 2, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('Cachet officiel & Approbation', 140 + boxW / 2, sigY + boxH - 2, { align: 'center' });

  // Mention légale de bas de page
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Clinique Betesda • Rapport d\'état financier certifié conforme • Extrait fidèle des flux d\'encaissement',
    105,
    292,
    { align: 'center' }
  );
}

/**
 * 1. RAPPORT FINANCIER GLOBAL (/reports)
 */
export function generateGeneralFinancialReportPDF(data: {
  financial: {
    totalBilled: number;
    totalCollected: number;
    totalUnpaid: number;
    invoicesCount: number;
  };
  topMedicines?: Array<{
    medicineName: string;
    _sum: { quantity: number; totalPrice: number };
  }>;
  patientsCount?: { total: number; male: number; female: number };
}): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawOfficialHeader(
    doc,
    'RAPPORT FINANCIER & BILAN DE RENTABILITÉ GLOBALE',
    'Bilan consolidé facturation, encaissements et pharmacie',
    `BIL-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );

  // 3 Blocs KPI
  const kpiY = 38.5;
  const kpiW = 60;
  const kpiH = 18;

  // KPI 1 : Facturé
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, kpiY, kpiW, kpiH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL FACTURÉ ÉMIS', 14, kpiY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(data.financial.totalBilled), 14, kpiY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.financial.invoicesCount} pièces de facturation`, 14, kpiY + 15.5);

  // KPI 2 : Encaissé
  doc.roundedRect(75, kpiY, kpiW, kpiH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(13, 148, 136);
  doc.text('TOTAL ENCAISSÉ (RECETTES)', 79, kpiY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13, 148, 136);
  doc.text(formatCurrency(data.financial.totalCollected), 79, kpiY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  const recoveryRate = data.financial.totalBilled > 0
    ? Math.round((data.financial.totalCollected / data.financial.totalBilled) * 100)
    : 100;
  doc.text(`Taux de recouvrement : ${recoveryRate}%`, 79, kpiY + 15.5);

  // KPI 3 : Impayés
  doc.roundedRect(140, kpiY, kpiW, kpiH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(225, 29, 72);
  doc.text('RESTE À RECOUVRER (CRÉANCES)', 144, kpiY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(225, 29, 72);
  doc.text(formatCurrency(data.financial.totalUnpaid), 144, kpiY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Créances patients en attente', 144, kpiY + 15.5);

  // Tableau récapitulatif comptable
  const summaryRows = [
    ['1', 'Recettes globales d\'encaissements (Consultations + Soins)', 'Recouvert', formatCurrency(data.financial.totalCollected)],
    ['2', 'Total des prestations et soins facturés au dossier', 'Émis', formatCurrency(data.financial.totalBilled)],
    ['3', 'Solde débiteur restant (Impayés / En attente de règlement)', 'À percevoir', formatCurrency(data.financial.totalUnpaid)],
  ];

  autoTable(doc, {
    startY: 61,
    margin: { left: 10, right: 10 },
    head: [
      [
        { content: 'N°', styles: { halign: 'center', cellWidth: 10 } },
        { content: 'Poste Comptable & Libellé Financier', styles: { halign: 'left' } },
        { content: 'Statut', styles: { halign: 'center', cellWidth: 32 } },
        { content: 'Montant Total (Ar)', styles: { halign: 'right', cellWidth: 45 } },
      ],
    ],
    body: summaryRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [100, 116, 139],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138] },
    },
  });

  let nextY = (doc as any).lastAutoTable?.finalY + 8 || 95;

  // Tableau Top Ventes Pharmacie si fourni
  if (data.topMedicines && data.topMedicines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('RÉSULTATS DE VENTES PHARMACIE — PALMARÈS PRINCIPAL', 10, nextY);

    const pharmaRows = data.topMedicines.slice(0, 8).map((it, idx) => [
      `#${idx + 1}`,
      it.medicineName,
      `${it._sum.quantity} unité${it._sum.quantity > 1 ? 's' : ''}`,
      formatCurrency(it._sum.totalPrice),
    ]);

    autoTable(doc, {
      startY: nextY + 3,
      margin: { left: 10, right: 10 },
      head: [
        [
          { content: 'Rang', styles: { halign: 'center', cellWidth: 16 } },
          { content: 'Désignation Médicament', styles: { halign: 'left' } },
          { content: 'Quantité Écoulée', styles: { halign: 'center', cellWidth: 38 } },
          { content: 'Chiffre d\'Affaires (Ar)', styles: { halign: 'right', cellWidth: 45 } },
        ],
      ],
      body: pharmaRows,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [148, 163, 184],
        lineWidth: 0.18,
      },
      headStyles: {
        fillColor: [13, 148, 136],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
    });

    nextY = (doc as any).lastAutoTable?.finalY + 8 || 170;
  }

  // Signatures officielles
  drawSignaturesFooter(doc, nextY + 4);

  return doc;
}

/**
 * 2. RAPPORT FINANCIER PHARMACIE & BÉNÉFICES (/pharmacy/financials)
 */
export function generatePharmacyFinancialReportPDF(data: {
  periodLabel: string;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  averageMargin: number;
  salesCount: number;
  sales: Array<{
    saleDate: Date | string;
    saleNumber: string;
    clientName: string;
    total: number;
    cost: number;
    profit: number;
    paymentMethod: string;
    itemsSummary?: string;
  }>;
}): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawOfficialHeader(
    doc,
    'ÉTAT FINANCIER & RENTABILITÉ PHARMACIE (A4)',
    `Période : ${data.periodLabel}`,
    `PHAR-${new Date().toISOString().split('T')[0]}`
  );

  // 4 Blocs KPI Synthétiques
  const kpiY = 38.5;
  const kpiW = 45;
  const kpiH = 17;

  // CA Total
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, kpiY, kpiW, kpiH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('CHIFFRE D\'AFFAIRES BRUT', 13, kpiY + 4.5);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(data.totalRevenue), 13, kpiY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text(`${data.salesCount} ventes enregistrées`, 13, kpiY + 14.5);

  // Coût Achat
  doc.roundedRect(58, kpiY, kpiW, kpiH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('COÛT D\'ACHAT TOTAL', 61, kpiY + 4.5);
  doc.setFontSize(9.5);
  doc.setTextColor(225, 29, 72);
  doc.text(formatCurrency(data.totalCost), 61, kpiY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('Valorisation stock sorti', 61, kpiY + 14.5);

  // Bénéfice Net
  doc.roundedRect(106, kpiY, kpiW, kpiH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(13, 148, 136);
  doc.text('BÉNÉFICE NET RÉALISÉ', 109, kpiY + 4.5);
  doc.setFontSize(9.5);
  doc.setTextColor(13, 148, 136);
  doc.text(formatCurrency(data.netProfit), 109, kpiY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('Marge brute d\'exploitation', 109, kpiY + 14.5);

  // Taux de Marge
  doc.roundedRect(154, kpiY, 46, kpiH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(30, 58, 138);
  doc.text('TAUX DE MARGE MOYEN', 157, kpiY + 4.5);
  doc.setFontSize(10.5);
  doc.setTextColor(30, 58, 138);
  doc.text(`${data.averageMargin.toFixed(1)} %`, 157, kpiY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('Rentabilité globale', 157, kpiY + 14.5);

  // Tableau détaillé des ventes
  const tableRows = data.sales.slice(0, 32).map((s, idx) => {
    const profitMargin = s.total > 0 ? ((s.profit / s.total) * 100).toFixed(0) : '0';
    return [
      String(idx + 1),
      formatDate(s.saleDate),
      s.saleNumber,
      s.clientName || 'Client comptoir',
      formatCurrency(s.total),
      formatCurrency(s.cost),
      formatCurrency(s.profit),
      `${profitMargin}%`,
      s.paymentMethod || 'Espèces',
    ];
  });

  autoTable(doc, {
    startY: 59,
    margin: { left: 10, right: 10, bottom: 32 },
    head: [
      [
        { content: 'N°', styles: { halign: 'center', cellWidth: 7 } },
        { content: 'Date', styles: { halign: 'center', cellWidth: 16 } },
        { content: 'Ticket N°', styles: { halign: 'left', cellWidth: 24 } },
        { content: 'Client / Bénéficiaire', styles: { halign: 'left', cellWidth: 'auto' } },
        { content: 'Vente (Ar)', styles: { halign: 'right', cellWidth: 24 } },
        { content: 'Achat (Ar)', styles: { halign: 'right', cellWidth: 22 } },
        { content: 'Bénéfice (Ar)', styles: { halign: 'right', cellWidth: 24 } },
        { content: 'Marge', styles: { halign: 'center', cellWidth: 14 } },
        { content: 'Règlement', styles: { halign: 'center', cellWidth: 20 } },
      ],
    ],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 1.2,
      lineColor: [148, 163, 184],
      lineWidth: 0.18,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', textColor: [100, 116, 139] },
      1: { halign: 'center' },
      2: { halign: 'left', fontStyle: 'bold', textColor: [30, 58, 138] },
      3: { halign: 'left' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right', textColor: [100, 116, 139] },
      6: { halign: 'right', fontStyle: 'bold', textColor: [13, 148, 136] },
      7: { halign: 'center', fontStyle: 'bold' },
      8: { halign: 'center' },
    },
    foot: [
      [
        { content: 'TOTAUX PÉRIODE', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCurrency(data.totalRevenue), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCurrency(data.totalCost), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCurrency(data.netProfit), styles: { halign: 'right', fontStyle: 'bold', textColor: [13, 148, 136] } },
        { content: `${data.averageMargin.toFixed(1)}%`, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: '-', styles: { halign: 'center' } },
      ],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 7,
      lineWidth: 0.25,
      lineColor: [15, 23, 42],
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 240;
  drawSignaturesFooter(doc, finalY + 5);

  return doc;
}

/**
 * 3. BORDEREAU JOURNALIER / PÉRIODIQUE DE CAISSE (/payments)
 * Design clair, net et lumineux (pas de fond sombre)
 */
export function generateDailyCashSheetPDF(data: {
  date?: string;
  generatedBy: string;
  title?: string;
  periodLabel?: string;
  categoryLabel?: string;
  totalConsult: number;
  countConsult: number;
  totalPharma: number;
  countPharma: number;
  totalInfirmerie?: number;
  countInfirmerie?: number;
  totalConsumables?: number;
  countConsumables?: number;
  grandTotal: number;
  totalCash: number;
  totalMobileMoney: number;
  rows: Array<{
    timeStr: string;
    source: 'CONSULTATION' | 'PHARMACY' | 'INFIRMERIE' | 'HOSPITALISATION' | string;
    refNumber: string;
    clientName: string;
    details: string;
    paymentMethod: string;
    cashier: string;
    amount: number;
  }>;
}): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const dateStr = data.date || new Date().toISOString().split('T')[0];
  const refCode = `CAISSE-${dateStr.replace(/-/g, '')}`;
  const docTitle = data.title || 'BORDEREAU DES ENTRÉES DE CAISSE (A4)';
  const docSubtitle = data.periodLabel || `Journée du : ${formatDate(dateStr + 'T00:00:00')}`;

  drawOfficialHeader(doc, docTitle, docSubtitle, refCode);

  const infirmerieTotal = (data.totalInfirmerie || 0) + (data.totalConsumables || 0);
  const infirmerieCount = (data.countInfirmerie || 0) + (data.countConsumables || 0);

  // 4 Blocs KPI Synthétiques (Clairs, Fond Blanc, Liserés colorés)
  const kpiY = 38.5;
  const kpiW = 45;
  const kpiH = 17;

  // 1. Recettes Pharmacie
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(10, kpiY, kpiW, kpiH, 1.2, 1.2, 'FD');
  doc.setFillColor(79, 70, 229); // Accent indigo
  doc.rect(10, kpiY, kpiW, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(79, 70, 229);
  doc.text('1. PHARMACIE (VENTES)', 13, kpiY + 4.5);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(data.totalPharma), 13, kpiY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.countPharma} ventes enregistrées`, 13, kpiY + 14.5);

  // 2. Recettes Consultations
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(58, kpiY, kpiW, kpiH, 1.2, 1.2, 'FD');
  doc.setFillColor(2, 132, 199); // Accent bleu ciel
  doc.rect(58, kpiY, kpiW, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(2, 132, 199);
  doc.text('2. CONSULTATIONS', 61, kpiY + 4.5);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(data.totalConsult), 61, kpiY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.countConsult} consultations`, 61, kpiY + 14.5);

  // 3. Recettes Infirmerie & Actes
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(106, kpiY, kpiW, kpiH, 1.2, 1.2, 'FD');
  doc.setFillColor(13, 148, 136); // Accent teal
  doc.rect(106, kpiY, kpiW, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(13, 148, 136);
  doc.text('3. SOINS & HÉBERGEMENTS', 109, kpiY + 4.5);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(infirmerieTotal), 109, kpiY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${infirmerieCount} prestations & actes`, 109, kpiY + 14.5);

  // 4. Total Général Entrées
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(154, kpiY, 46, kpiH, 1.2, 1.2, 'FD');
  doc.setFillColor(16, 185, 129); // Accent émeraude
  doc.rect(154, kpiY, 46, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(5, 150, 105);
  doc.text('TOTAL ENTRÉES NET', 157, kpiY + 4.5);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(data.grandTotal), 157, kpiY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.setTextColor(71, 85, 105);
  doc.text(`Espèces: ${formatCurrency(data.totalCash)} | Mob: ${formatCurrency(data.totalMobileMoney)}`, 157, kpiY + 14.5);

  // Tableau détaillé (Design clair, en-tête doux gris-bleu clair, pas de noir sombre)
  const tableRows = data.rows.slice(0, 36).map((r, idx) => {
    let sourceLabel = 'Consult.';
    if (r.source === 'PHARMACY') sourceLabel = 'Pharmacie';
    else if (r.source === 'INFIRMERIE') sourceLabel = 'Infirmerie';
    else if (r.source === 'HOSPITALISATION' || r.source === 'CONSUMABLES') sourceLabel = 'Actes/Héb.';

    return [
      String(idx + 1),
      r.timeStr,
      sourceLabel,
      r.refNumber,
      r.clientName,
      r.details,
      r.paymentMethod === 'CASH' ? 'Espèces' : r.paymentMethod,
      r.cashier,
      formatCurrency(r.amount),
    ];
  });

  autoTable(doc, {
    startY: 59,
    margin: { left: 10, right: 10, bottom: 32 },
    head: [
      [
        { content: 'N°', styles: { halign: 'center', cellWidth: 7 } },
        { content: 'Heure', styles: { halign: 'center', cellWidth: 14 } },
        { content: 'Source', styles: { halign: 'center', cellWidth: 16 } },
        { content: 'Réf. Ticket', styles: { halign: 'left', cellWidth: 24 } },
        { content: 'Bénéficiaire', styles: { halign: 'left', cellWidth: 32 } },
        { content: 'Détail Prestation / Produits', styles: { halign: 'left', cellWidth: 'auto' } },
        { content: 'Règlement', styles: { halign: 'center', cellWidth: 16 } },
        { content: 'Caissier', styles: { halign: 'left', cellWidth: 20 } },
        { content: 'Montant (Ar)', styles: { halign: 'right', cellWidth: 24 } },
      ],
    ],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      fontSize: 6.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [250, 252, 254],
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', textColor: [100, 116, 139] },
      1: { halign: 'center' },
      2: { halign: 'center', fontStyle: 'bold' },
      3: { halign: 'left', fontStyle: 'bold', textColor: [30, 58, 138] },
      4: { halign: 'left' },
      5: { halign: 'left' },
      6: { halign: 'center' },
      7: { halign: 'left' },
      8: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
    },
    foot: [
      [
        { content: 'TOTAL GÉNÉRAL DES ENTRÉES', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCurrency(data.grandTotal), styles: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] } },
      ],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 7,
      lineWidth: 0.2,
      lineColor: [203, 213, 225],
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 240;
  drawSignaturesFooter(doc, finalY + 5);

  return doc;
}
