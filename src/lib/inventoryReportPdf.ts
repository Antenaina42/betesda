import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InventoryBlankPdfItem {
  name: string;
  genericName?: string | null;
  dosage?: string | null;
  form?: string | null;
  location?: string | null;
  currentStock: number;
}

export interface InventoryBilanPdfItem {
  name: string;
  dosage?: string | null;
  form?: string | null;
  location?: string | null;
  theoreticalStock: number;
  countedStock: number;
  difference: number;
  financialImpact: number;
  motif: string;
  remark: string;
}

function cleanPdfText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    .replace(/[•·]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-');
}

function pdfMoney(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(rounded)
    .replace(/[\u00A0\u202F\u2009]/g, ' ');
  return `${formatted} Ar`;
}

function pdfDateTime(dateInput?: string | Date): { dateStr: string; timeStr: string } {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    return {
      dateStr: now.toLocaleDateString('fr-FR'),
      timeStr: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
  }
  return {
    dateStr: d.toLocaleDateString('fr-FR'),
    timeStr: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function addPdfHeader(
  doc: jsPDF,
  subtitle: string,
  metaRight: { ref: string; dateStr: string; timeStr: string; statusLabel: string }
) {
  // Bandeau supérieur
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 4, 'F');
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 4, 210, 1.2, 'F');

  // Gauche : Identité Clinique
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('CLINIQUE BETESDA', 12, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('OFFICINE PHARMACEUTIQUE - CONTROLE DE STOCK', 12, 17.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Tel : 034 51 365 45 / 034 53 689 59  |  Email : contact@betesda.com', 12, 22);
  doc.text('NIF : 3 005 710 430  -  N° Stat : 86201 11 2021 0 08027', 12, 25.5);

  // Droite : Encadré Référence
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(140, 8, 58, 19, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(cleanPdfText(metaRight.statusLabel), 169, 12, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text(cleanPdfText(metaRight.ref), 169, 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(`Date : ${metaRight.dateStr} a ${metaRight.timeStr}`, 169, 22.5, { align: 'center' });

  // Barre titre
  doc.setFillColor(15, 23, 42);
  doc.rect(12, 29, 186, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(cleanPdfText(subtitle), 105, 33.8, { align: 'center' });
}

function addSignaturesAndFooters(doc: jsPDF, finalY: number, leftTitle: string, rightTitle: string) {
  let y = finalY + 8;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  // Signatures
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.roundedRect(12, y, 88, 26, 1.5, 1.5, 'S');
  doc.roundedRect(110, y, 88, 26, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(cleanPdfText(leftTitle), 16, y + 6);
  doc.text(cleanPdfText(rightTitle), 114, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Nom, Date & Signature :', 16, y + 11);
  doc.text('Date, Signature & Cachet :', 114, y + 11);

  // Pagination & pied de page sur toutes les pages
  const totalPages = doc.getNumberOfPages();
  const generatedStamp = `Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(12, 286, 198, 286);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Clinique Betesda - Officine Pharmaceutique | ${generatedStamp}`, 12, 291);
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${p} / ${totalPages}`, 198, 291, { align: 'right' });
  }
}

/**
 * Télécharge une Fiche de Comptage Vierge A4 PDF (Étape 1)
 */
export function downloadBlankInventorySheetPdf(params: {
  title: string;
  operatorName: string;
  items: InventoryBlankPdfItem[];
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { dateStr, timeStr } = pdfDateTime();

  addPdfHeader(doc, 'FICHE DE COMPTAGE PHYSIQUE - INVENTAIRE PHARMACIE (VIERGE)', {
    ref: `FICHE-${new Date().toISOString().split('T')[0]}`,
    dateStr,
    timeStr,
    statusLabel: 'CONTROLE EN RAYON',
  });

  // Cartouche infos session
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(12, 38, 186, 12, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Session : ${cleanPdfText(params.title)}`, 15, 43);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Responsable : ${cleanPdfText(params.operatorName)}   |   Total articles a compter : ${params.items.length}`,
    15,
    47.5
  );

  const tableRows = params.items.map((m, idx) => [
    String(idx + 1),
    cleanPdfText(
      `${m.name}${m.dosage ? ` (${m.dosage})` : ''}\n${[m.genericName, m.form].filter(Boolean).join(' - ')}`
    ),
    cleanPdfText(m.location || 'Rayon general'),
    String(m.currentStock),
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 53,
    margin: { left: 12, right: 12, bottom: 16 },
    head: [['N°', 'Designation Medicament (DCI / Forme)', 'Rayon', 'Stock Syst.', 'COMPTAGE REEL', 'Remarque / Ecart']],
    body: tableRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
      lineColor: [148, 163, 184],
      lineWidth: 0.25,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 68, halign: 'left' },
      2: { cellWidth: 26, halign: 'left' },
      3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 26, halign: 'center', fillColor: [255, 255, 255], lineColor: [79, 70, 229], lineWidth: 0.4 },
      5: { cellWidth: 36, halign: 'left' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  addSignaturesAndFooters(doc, finalY, 'Pharmacien / Agent de comptage', 'Controle / Visa de la Direction');

  const safeSlug = cleanPdfText(params.title).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 45);
  doc.save(`Fiche_Comptage_${safeSlug}_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Télécharge le Procès-Verbal / Bilan d'Inventaire A4 PDF (Étape 2 ou Historique)
 */
export function downloadInventoryBilanPdf(params: {
  inventoryNumber?: string;
  title: string;
  date?: string | Date;
  operatorName: string;
  notes?: string | null;
  statusLabel?: string;
  items: InventoryBilanPdfItem[];
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { dateStr, timeStr } = pdfDateTime(params.date);
  const ref = params.inventoryNumber || `INV-BROUILLON-${new Date().toISOString().split('T')[0]}`;

  addPdfHeader(doc, "PROCES-VERBAL D'INVENTAIRE PHARMACIE & BILAN DES ECARTS", {
    ref,
    dateStr,
    timeStr,
    statusLabel: params.statusLabel || (params.inventoryNumber ? 'VALIDE & REGULARISE' : 'BILAN EN COURS'),
  });

  // Calculs synthétiques
  const totalItems = params.items.length;
  const perfectCount = params.items.filter((i) => i.difference === 0).length;
  const discrepancyCount = params.items.filter((i) => i.difference !== 0).length;
  const totalImpact = params.items.reduce((s, i) => s + (Number(i.financialImpact) || 0), 0);

  // Cartouche infos session
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(12, 38, 186, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Titre : ${cleanPdfText(params.title)}`, 15, 43.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Responsable / Operateur : ${cleanPdfText(params.operatorName)}`, 15, 48);
  doc.text(`Notes generales : ${cleanPdfText(params.notes?.trim() || 'Neant')}`, 15, 52);

  // 4 Boîtes KPI
  const kpiY = 57;
  const boxW = 44.5;
  const gap = 2.66;
  const kpis = [
    { label: 'ARTICLES CONTROLES', value: String(totalItems), color: [15, 23, 42] as [number, number, number] },
    { label: 'CONFORMES (0 ECART)', value: String(perfectCount), color: [5, 150, 105] as [number, number, number] },
    { label: 'ARTICLES AVEC ECART', value: String(discrepancyCount), color: [217, 119, 6] as [number, number, number] },
    {
      label: 'IMPACT FINANCIER NET',
      value: `${totalImpact > 0 ? '+' : ''}${pdfMoney(totalImpact)}`,
      color: (totalImpact < 0 ? [220, 38, 38] : totalImpact > 0 ? [37, 99, 235] : [5, 150, 105]) as [number, number, number],
    },
  ];

  kpis.forEach((k, idx) => {
    const x = 12 + idx * (boxW + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, kpiY, boxW, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, x + boxW / 2, kpiY + 4.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(k.color[0], k.color[1], k.color[2]);
    doc.text(cleanPdfText(k.value), x + boxW / 2, kpiY + 11, { align: 'center' });
  });

  const rows = params.items.map((it, idx) => {
    const diffStr = it.difference === 0 ? '0' : it.difference > 0 ? `+${it.difference}` : String(it.difference);
    const impStr =
      it.financialImpact === 0 ? '0 Ar' : `${it.financialImpact > 0 ? '+' : ''}${pdfMoney(it.financialImpact)}`;
    const medLabel = [it.name, [it.dosage, it.form].filter(Boolean).join(' - ')].filter(Boolean).join('\n');
    return [
      String(idx + 1),
      cleanPdfText(medLabel),
      String(it.theoreticalStock),
      String(it.countedStock),
      diffStr,
      impStr,
      cleanPdfText(it.motif || 'Conforme'),
      cleanPdfText(it.remark?.trim() || 'Neant'),
    ];
  });

  autoTable(doc, {
    startY: 75,
    margin: { left: 12, right: 12, bottom: 16 },
    head: [
      ['N°', 'Medicament', 'Syst.', 'Reel', 'Ecart', 'Impact (Ar)', 'Motif', "Remarque sur l'ecart"],
    ],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 44, halign: 'left' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 23, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 28, halign: 'left' },
      7: { cellWidth: 41, halign: 'left' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        const item = params.items[hookData.row.index];
        if (!item) return;
        if (item.difference !== 0) {
          hookData.cell.styles.fillColor = [255, 251, 235];
        }
        if (hookData.column.index === 4 || hookData.column.index === 5) {
          if (item.difference < 0) {
            hookData.cell.styles.textColor = [185, 28, 28];
          } else if (item.difference > 0) {
            hookData.cell.styles.textColor = [29, 78, 216];
          } else {
            hookData.cell.styles.textColor = [5, 150, 105];
          }
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 130;
  addSignaturesAndFooters(doc, finalY, 'Pharmacien Responsable', 'Visa de la Direction Medicale');

  const safeRef = cleanPdfText(ref).replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`PV_Inventaire_${safeRef}_Clinique_Betesda.pdf`);
}
