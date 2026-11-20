import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction, StockExitReason } from '@prisma/client';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const [entries, exits] = await Promise.all([
      prisma.stockEntry.findMany({
        where: { medicine: { clinicId: session.clinicId } },
        include: {
          medicine: true,
          supplier: true,
        },
        orderBy: { entryDate: 'desc' },
        take: 50,
      }),
      prisma.stockExit.findMany({
        where: { medicine: { clinicId: session.clinicId } },
        include: {
          medicine: true,
        },
        orderBy: { exitDate: 'desc' },
        take: 50,
      }),
    ]);

    return NextResponse.json({ entries, exits });
  } catch (error) {
    console.error('Fetch stock movements error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      type,
      medicineId,
      supplierId,
      boxesCount,
      unitsPerBox,
      quantity,
      unitCost,
      boxCost,
      totalCost,
      batchNumber,
      expiryDate,
      reason,
      notes,
      attachmentUrl,
      attachmentName,
    } = body;

    if (!medicineId) {
      return NextResponse.json({ error: 'Médicament requis.' }, { status: 400 });
    }

    if (type === 'ENTRY') {
      const boxes = boxesCount ? parseInt(boxesCount, 10) : 0;
      const uPerBox = unitsPerBox ? parseInt(unitsPerBox, 10) : 1;
      
      // Si spécifié en boîtes, calculer le total en unités (ex: 5 boîtes * 30 unités = 150 unités)
      let totalUnits = 0;
      if (boxes > 0 && uPerBox > 0) {
        totalUnits = boxes * uPerBox;
      } else {
        totalUnits = parseInt(quantity, 10) || 0;
      }

      if (totalUnits <= 0) {
        return NextResponse.json(
          { error: 'Veuillez saisir un nombre valide de boîtes et d’unités par boîte.' },
          { status: 400 }
        );
      }

      // Calcul des coûts
      let costPerUnit = parseFloat(unitCost || '0');
      let calculatedTotal = parseFloat(totalCost || '0');
      if (boxCost && parseFloat(boxCost) > 0 && boxes > 0) {
        calculatedTotal = parseFloat(boxCost) * boxes;
        costPerUnit = calculatedTotal / totalUnits;
      } else if (costPerUnit > 0 && !calculatedTotal) {
        calculatedTotal = costPerUnit * totalUnits;
      }

      const [entry, updatedMed] = await prisma.$transaction([
        prisma.stockEntry.create({
          data: {
            medicineId,
            supplierId: supplierId || null,
            quantity: totalUnits, // Stock toujours compté en unités
            boxesCount: boxes > 0 ? boxes : null,
            unitsPerBox: uPerBox > 0 ? uPerBox : null,
            attachmentUrl: attachmentUrl || null,
            attachmentName: attachmentName || null,
            unitCost: costPerUnit,
            totalCost: calculatedTotal,
            batchNumber: batchNumber || null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            notes: notes || null,
            createdById: session.id,
          },
          include: { medicine: true },
        }),
        prisma.medicine.update({
          where: { id: medicineId },
          data: {
            currentStock: { increment: totalUnits },
            unitsPerBox: uPerBox > 0 ? uPerBox : undefined,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            ...(session.role === 'PHARMACIST' && costPerUnit > 0
              ? { sellingPrice: costPerUnit }
              : {}),
          },
        }),
      ]);

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.UPDATE,
        entity: 'MedicineStock',
        entityId: medicineId,
        details: `Entrée stock : +${totalUnits} unités (${boxes ? `${boxes} btes x ${uPerBox}` : `${totalUnits} u`}) de ${updatedMed.name}`,
      });

      return NextResponse.json({ success: true, entry });
    } else if (type === 'EXIT') {
      const qty = parseInt(quantity, 10) || 0;
      if (qty <= 0) {
        return NextResponse.json({ error: 'Quantité valide requise pour la sortie.' }, { status: 400 });
      }
      const med = await prisma.medicine.findUnique({ where: { id: medicineId } });
      if (!med || med.currentStock < qty) {
        return NextResponse.json(
          { error: `Stock insuffisant pour effectuer cette sortie. Stock actuel : ${med?.currentStock || 0}` },
          { status: 400 }
        );
      }

      const [exit, updatedMed] = await prisma.$transaction([
        prisma.stockExit.create({
          data: {
            medicineId,
            quantity: qty,
            reason: (reason as StockExitReason) || StockExitReason.EXPIRED,
            notes: notes || null,
            createdById: session.id,
          },
          include: { medicine: true },
        }),
        prisma.medicine.update({
          where: { id: medicineId },
          data: {
            currentStock: { decrement: qty },
          },
        }),
      ]);

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.UPDATE,
        entity: 'MedicineStock',
        entityId: medicineId,
        details: `Sortie de stock : -${qty} ${updatedMed.name} (Motif: ${reason})`,
      });

      return NextResponse.json({ success: true, exit });
    }

    return NextResponse.json({ error: 'Type de mouvement invalide' }, { status: 400 });
  } catch (error: any) {
    console.error('Stock operation error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du mouvement de stock : ' + error.message },
      { status: 500 }
    );
  }
}
