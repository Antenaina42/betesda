import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './formatters';

export interface ConsumableBlankSheetData {
  reference: string;
  date?: Date | string;
  clinic?: {
    name?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    address?: string;
  };
  lineCounts: {
    MEDICAMENT: number;
    ACTE_INFIRMIER: number;
    HEBERGEMENT: number;
    AUTRE: number;
  };
}

export interface ConsumableFilledSheetData {
  reference: string;
  deliveryDate: Date | string;
  patientName: string;
  patientNumber?: string | null;
  roomNumber?: string | null;
  nurseName?: string | null;
  paymentMethod?: string;
  totalAmount: number;
  clinic?: {
    name?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    address?: string;
  };
  items: Array<{
    category: 'MEDICAMENT' | 'ACTE_INFIRMIER' | 'HEBERGEMENT' | 'AUTRE';
    itemName: string;
    unit?: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    itemDate?: string | Date | null;
  }>;
}

/**
 * Génère un document PDF A4 (1 page stricte) pour la fiche de consommable vierge
 * Sans aucun en-tête ni pied de page du navigateur (aucun "Firefox Developer Edition", aucune URL).
 */
export function generateConsumableBlankSheetPDF(data: ConsumableBlankSheetData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const clinicName = data.clinic?.name || 'CLINIQUE BETESDA';
  const clinicPhone = data.clinic?.phone || '034 51 365 45 / 034 53 689 59';
  const clinicEmail = data.clinic?.email || 'contact@betesda.com';
  const clinicTax = data.clinic?.taxId || 'NIF: 3 005 710 430 - N° Stat: 86201 11 2021 0 08027';

  // 1. Bandeau supérieur coloré fin
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(0, 0, 210, 3.5, 'F');
  doc.setFillColor(13, 148, 136); // #0d9488
  doc.rect(0, 3.5, 210, 1, 'F');

  // 2. En-tête Clinique (Gauche)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`+ ${clinicName.toUpperCase()}`, 8, 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(13, 148, 136);
  doc.text('ÉTABLISSEMENT HOSPITALIER & MÉDICAL', 8, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Tél : ${clinicPhone}  |  Email : ${clinicEmail}`, 8, 17.5);
  doc.setTextColor(100, 116, 139);
  doc.text(clinicTax, 8, 20.5);

  // 3. Cadre Référence (Droite)
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(144, 6, 58, 15, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  doc.text('RÉFÉRENCE FICHE MANUSCRITE', 173, 9.5, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138); // Bleu soutenu
  doc.text(data.reference || 'PF - 0001', 173, 14.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  const dateStr = formatDate(data.date || new Date());
  doc.text(`Émise le : ${dateStr}`, 173, 19, { align: 'center' });

  // 4. Titre du document
  doc.setFillColor(15, 23, 42);
  doc.rect(8, 22.5, 194, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('FICHE DE CONSOMMABLES, ACTES & HÉBERGEMENT', 105, 26, { align: 'center' });

  // 5. Cadre Patient & Séjour (2 lignes compactes)
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(8, 28.5, 194, 11, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);

  // Ligne 1
  doc.text('Patient / Client :', 11, 32.5);
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([0.8, 0.8], 0);
  doc.line(32, 33, 95, 33);

  doc.text('N° Dossier :', 100, 32.5);
  doc.line(116, 33, 148, 33);

  doc.text('Chambre / Lit :', 153, 32.5);
  doc.line(174, 33, 199, 33);

  // Ligne 2
  doc.text("Date d'admission :", 11, 37);
  doc.line(36, 37.5, 80, 37.5);

  doc.text('Infirmière / Soignant responsable :', 88, 37);
  doc.line(134, 37.5, 199, 37.5);
  doc.setLineDashPattern([], 0); // Reset dash

  // 6. Construction des lignes du tableau (4 catégories)
  const tableBody: any[] = [];

  // Catégorie I : Médicaments
  tableBody.push([
    {
      content: 'I. MÉDICAMENTS (Pharmacie)',
      colSpan: 6,
      styles: {
        fillColor: [224, 231, 255], // #e0e7ff
        textColor: [30, 27, 75],
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: { top: 0.8, bottom: 0.8, left: 2, right: 2 },
      },
    },
  ]);
  const medCount = Math.max(1, data.lineCounts.MEDICAMENT || 35);
  for (let i = 1; i <= medCount; i++) {
    tableBody.push([String(i), '', '', '', '', '']);
  }

  // Catégorie II : Actes Infirmiers
  tableBody.push([
    {
      content: 'II. ACTES INFIRMIERS & SOINS',
      colSpan: 6,
      styles: {
        fillColor: [204, 251, 241], // #ccfbf1
        textColor: [17, 94, 89],
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: { top: 0.8, bottom: 0.8, left: 2, right: 2 },
      },
    },
  ]);
  const actCount = Math.max(1, data.lineCounts.ACTE_INFIRMIER || 5);
  for (let i = 1; i <= actCount; i++) {
    tableBody.push([String(i), '', '', '', '', '']);
  }

  // Catégorie III : Hébergement
  tableBody.push([
    {
      content: 'III. HÉBERGEMENT & SÉJOUR',
      colSpan: 6,
      styles: {
        fillColor: [254, 243, 199], // #fef3c7
        textColor: [120, 53, 15],
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: { top: 0.8, bottom: 0.8, left: 2, right: 2 },
      },
    },
  ]);
  const hebCount = Math.max(1, data.lineCounts.HEBERGEMENT || 5);
  for (let i = 1; i <= hebCount; i++) {
    tableBody.push([String(i), '', '', '', '', '']);
  }

  // Catégorie IV : Autre
  tableBody.push([
    {
      content: 'IV. AUTRES FOURNITURES & SERVICES',
      colSpan: 6,
      styles: {
        fillColor: [243, 232, 255], // #f3e8ff
        textColor: [88, 28, 135],
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: { top: 0.8, bottom: 0.8, left: 2, right: 2 },
      },
    },
  ]);
  const autCount = Math.max(1, data.lineCounts.AUTRE || 5);
  for (let i = 1; i <= autCount; i++) {
    tableBody.push([String(i), '', '', '', '', '']);
  }

  // Total de lignes vierges = 50. Total de headers = 4. Total = 54 lignes.
  // 54 lignes * 3.7mm = 199.8mm.
  autoTable(doc, {
    startY: 40.5,
    margin: { left: 8, right: 8, top: 40.5, bottom: 32 },
    head: [
      [
        { content: 'N°', styles: { halign: 'center', cellWidth: 8 } },
        { content: 'Date', styles: { halign: 'center', cellWidth: 16 } },
        { content: 'Désignation de la prestation / article', styles: { halign: 'left', cellWidth: 'auto' } },
        { content: 'Qté', styles: { halign: 'center', cellWidth: 10 } },
        { content: 'P.U (Ar)', styles: { halign: 'right', cellWidth: 24 } },
        { content: 'Montant Total', styles: { halign: 'right', cellWidth: 26 } },
      ],
    ],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 5.8,
      cellPadding: { top: 0.7, bottom: 0.7, left: 1, right: 1 },
      lineColor: [100, 116, 139],
      lineWidth: 0.18,
      textColor: [15, 23, 42],
      minCellHeight: 3.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [226, 232, 240], // #e2e8f0
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 6,
      lineWidth: 0.22,
      lineColor: [71, 85, 105],
    },
    columnStyles: {
      0: { halign: 'center', textColor: [100, 116, 139], fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'left' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    pageBreak: 'avoid',
  });

  // Position Y après la fin du tableau
  const lastTableY = (doc as any).lastAutoTable?.finalY || 248;

  // 7. Barre Total Général
  const totalBarY = Math.min(lastTableY + 1.5, 252);
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(8, totalBarY, 194, 6.5, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL GÉNÉRAL CALCULÉ (Ar) :', 12, totalBarY + 4.3);

  doc.setDrawColor(71, 85, 105);
  doc.setLineDashPattern([0.8, 0.8], 0);
  doc.line(60, totalBarY + 4.5, 115, totalBarY + 4.5);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Document manuscrit officiel — À remettre à l\'administration pour encaissement.', 198, totalBarY + 4.3, { align: 'right' });

  // 8. Grille de 3 Signatures
  const sigY = totalBarY + 8;
  const boxW = 62;
  const boxH = 22;

  // Cadre 1 : Infirmière
  doc.setDrawColor(148, 163, 184);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(8, sigY, boxW, boxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(30, 41, 59);
  doc.text("L'Infirmière / Soignant", 8 + boxW / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Signature & Date', 8 + boxW / 2, sigY + boxH - 2, { align: 'center' });

  // Cadre 2 : Patient
  doc.roundedRect(74, sigY, boxW, boxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(30, 41, 59);
  doc.text('Le Bénéficiaire / Patient', 74 + boxW / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Signature', 74 + boxW / 2, sigY + boxH - 2, { align: 'center' });

  // Cadre 3 : Administration
  doc.roundedRect(140, sigY, boxW, boxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(30, 41, 59);
  doc.text("L'Administration / Caisse", 140 + boxW / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Visa & Cachet', 140 + boxW / 2, sigY + boxH - 2, { align: 'center' });

  // 9. Mention de bas de page discret
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(148, 163, 184);
  doc.text('Clinique Betesda • Système Intégré de Gestion Hospitalière & Pharmaceutique (A4 - 1 Page)', 105, 293, { align: 'center' });

  return doc;
}

/**
 * Génère un document PDF A4 pour une fiche remplie et enregistrée
 */
export function generateConsumableFilledSheetPDF(data: ConsumableFilledSheetData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const clinicName = data.clinic?.name || 'CLINIQUE BETESDA';
  const clinicPhone = data.clinic?.phone || '034 51 365 45 / 034 53 689 59';
  const clinicEmail = data.clinic?.email || 'contact@betesda.com';
  const clinicTax = data.clinic?.taxId || 'NIF: 3 005 710 430 - N° Stat: 86201 11 2021 0 08027';

  // 1. Bandeau supérieur coloré
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 4, 'F');
  doc.setFillColor(13, 148, 136);
  doc.rect(0, 4, 210, 1, 'F');

  // 2. En-tête Clinique
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`+ ${clinicName.toUpperCase()}`, 10, 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(13, 148, 136);
  doc.text('ÉTABLISSEMENT HOSPITALIER & MÉDICAL', 10, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(`Tél : ${clinicPhone}  |  Email : ${clinicEmail}`, 10, 20);
  doc.setTextColor(100, 116, 139);
  doc.text(clinicTax, 10, 23.5);

  // 3. Cadre Référence
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(138, 7, 62, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('RÉFÉRENCE FICHE CONSOMMABLES', 169, 11, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text(data.reference || 'PF - 0001', 169, 16.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date : ${formatDate(data.deliveryDate)}`, 169, 21, { align: 'center' });

  // 4. Titre
  doc.setFillColor(15, 23, 42);
  doc.rect(10, 26.5, 190, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('RÉCAPITULATIF DE DÉLIVRANCE CONSOMMABLES & ACTES', 105, 30.5, { align: 'center' });

  // 5. Cadre Patient
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, 34, 190, 13, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  doc.text(`Patient / Bénéficiaire : ${data.patientName || 'Non spécifié'}`, 13, 38.5);
  doc.text(`N° Dossier : ${data.patientNumber || '-'}`, 125, 38.5);
  doc.text(`Chambre / Lit : ${data.roomNumber || '-'}`, 165, 38.5);

  doc.text(`Soignant / Infirmier : ${data.nurseName || 'Non spécifié'}`, 13, 43.5);
  doc.text(`Mode de règlement : ${data.paymentMethod || 'Espèces'}`, 125, 43.5);

  // 6. Tableau des articles
  const tableRows = data.items.map((it, idx) => {
    const itemDateStr = it.itemDate ? formatDate(it.itemDate) : '-';
    return [
      String(idx + 1),
      itemDateStr,
      it.itemName,
      it.unit || 'Pièce',
      String(it.quantity),
      formatCurrency(it.unitPrice),
      formatCurrency(it.totalPrice),
    ];
  });

  autoTable(doc, {
    startY: 49,
    margin: { left: 10, right: 10, top: 49, bottom: 35 },
    head: [
      [
        { content: 'N°', styles: { halign: 'center', cellWidth: 8 } },
        { content: 'Date', styles: { halign: 'center', cellWidth: 18 } },
        { content: 'Désignation de la prestation / article', styles: { halign: 'left', cellWidth: 'auto' } },
        { content: 'Unité', styles: { halign: 'center', cellWidth: 16 } },
        { content: 'Qté', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'P.U (Ar)', styles: { halign: 'right', cellWidth: 26 } },
        { content: 'Montant Total', styles: { halign: 'right', cellWidth: 28 } },
      ],
    ],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [100, 116, 139],
      lineWidth: 0.18,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', textColor: [100, 116, 139] },
      1: { halign: 'center' },
      2: { halign: 'left', fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    foot: [
      [
        { content: 'TOTAL GÉNÉRAL À RECOUVRER (Ar)', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCurrency(data.totalAmount), styles: { halign: 'right', fontStyle: 'bold', fontSize: 8.5 } },
      ],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      lineWidth: 0.3,
      lineColor: [15, 23, 42],
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 240;

  // Signatures
  const sigY = Math.min(finalY + 6, 255);
  const boxW = 60;
  const boxH = 24;

  doc.setDrawColor(148, 163, 184);
  doc.setFillColor(255, 255, 255);

  doc.roundedRect(10, sigY, boxW, boxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("L'Infirmière / Soignant", 10 + boxW / 2, sigY + 5, { align: 'center' });

  doc.roundedRect(75, sigY, boxW, boxH, 1, 1, 'FD');
  doc.text('Le Bénéficiaire / Patient', 75 + boxW / 2, sigY + 5, { align: 'center' });

  doc.roundedRect(140, sigY, boxW, boxH, 1, 1, 'FD');
  doc.text("L'Administration / Caisse", 140 + boxW / 2, sigY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('Clinique Betesda • Fiche officielle certifiée', 105, 292, { align: 'center' });

  return doc;
}
