import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction, PaymentMethod, StockExitReason } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const delivery = await prisma.consumableDelivery.findFirst({
      where: { id: params.id, clinicId: session.clinicId },
      include: {
        patient: true,
        items: {
          include: {
            medicine: true,
          },
          orderBy: [
            { category: 'asc' },
            { orderIndex: 'asc' },
          ],
        },
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 });
    }

    return NextResponse.json({ delivery });
  } catch (error: any) {
    console.error('Fetch consumable delivery error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement de la fiche : ' + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const allowedRoles = ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST', 'ACCOUNTANT'];
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  try {
    const existing = await prisma.consumableDelivery.findFirst({
      where: { id: params.id, clinicId: session.clinicId },
      include: {
        items: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 });
    }

    const body = await request.json();

    // Cas spécifique : Encaissement direct de la fiche
    if (body.action === 'pay') {
      const payMethod = (body.paymentMethod as PaymentMethod) || existing.paymentMethod || PaymentMethod.CASH;
      const updated = await prisma.$transaction(async (tx) => {
        const del = await tx.consumableDelivery.update({
          where: { id: existing.id },
          data: {
            paymentStatus: 'PAID',
            status: 'COMPLETED',
            paymentMethod: payMethod,
          },
          include: {
            patient: true,
            items: {
              include: { medicine: true },
              orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }],
            },
          },
        });

        if (del.totalAmount > 0) {
          const userExists = await tx.user.findUnique({ where: { id: session.id }, select: { id: true } });
          await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: 'INCOME',
              category: 'ACTES_HEBERGEMENT',
              amount: del.totalAmount,
              paymentMethod: payMethod,
              reference: del.sheetReference || del.deliveryNumber,
              description: `Paiement Fiche #${del.sheetReference || del.deliveryNumber} - ${del.patientName || del.recipientName}`,
              transactionDate: new Date(),
              performedById: userExists ? session.id : null,
            },
          });
        }
        return del;
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.UPDATE,
        entity: 'ConsumableDelivery',
        entityId: updated.id,
        details: `Encaissement fiche n° ${updated.sheetReference || updated.deliveryNumber} (${updated.totalAmount.toLocaleString('fr-FR')} Ar)`,
      });

      return NextResponse.json({ success: true, delivery: updated });
    }

    const {
      sheetReference,
      recipientName,
      recipientPhone,
      patientName,
      patientId,
      fileNumber,
      roomNumber,
      reason,
      date,
      paymentMethod,
      paymentStatus,
      notes,
      items,
      status,
    } = body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Restaurer les stocks des anciens médicaments de la fiche
      for (const oldItem of existing.items) {
        if (oldItem.category === 'MEDICAMENT' && oldItem.medicineId) {
          await tx.medicine.update({
            where: { id: oldItem.medicineId },
            data: { currentStock: { increment: oldItem.quantity } },
          });
        }
      }

      // 2. Supprimer les anciens items de la fiche
      await tx.consumableDeliveryItem.deleteMany({
        where: { deliveryId: existing.id },
      });

      // 3. Préparer et déduire les stocks des nouveaux items
      let totalAmount = 0;
      const preparedItems: {
        category: string;
        medicineId?: string | null;
        itemName: string;
        itemDate?: Date;
        unit: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        orderIndex: number;
      }[] = [];

      const safeItems = Array.isArray(items) ? items : [];

      for (let i = 0; i < safeItems.length; i++) {
        const item = safeItems[i];
        const qty = parseInt(item.quantity, 10) || 1;
        const price = parseFloat(item.unitPrice) || 0;
        const lineTotal = qty * price;
        totalAmount += lineTotal;

        const itemCategory = item.category || 'MEDICAMENT';

        if (itemCategory === 'MEDICAMENT' && item.medicineId) {
          const med = await tx.medicine.findUnique({
            where: { id: item.medicineId },
          });

          if (med) {
            await tx.medicine.update({
              where: { id: med.id },
              data: { currentStock: { decrement: qty } },
            });

            await tx.stockExit.create({
              data: {
                medicineId: med.id,
                quantity: qty,
                reason: StockExitReason.OTHER,
                notes: `Mise à jour fiche #${existing.sheetReference || existing.deliveryNumber}`,
                createdById: session.id,
              },
            });
          }
        }

        preparedItems.push({
          category: itemCategory,
          medicineId: item.medicineId || null,
          itemName: item.itemName || 'Article / Prestation',
          itemDate: item.itemDate ? new Date(item.itemDate) : (date ? new Date(date) : new Date()),
          unit: item.unit || (itemCategory === 'HEBERGEMENT' ? 'Jour' : itemCategory === 'ACTE_INFIRMIER' ? 'Acte' : 'Pièce'),
          quantity: qty,
          unitPrice: price,
          totalPrice: lineTotal,
          orderIndex: i,
        });
      }

      // 4. Mettre à jour la fiche
      const updated = await tx.consumableDelivery.update({
        where: { id: existing.id },
        data: {
          sheetReference: sheetReference !== undefined ? String(sheetReference).trim() : existing.sheetReference,
          roomNumber: roomNumber !== undefined ? (roomNumber ? String(roomNumber).trim() : null) : existing.roomNumber,
          fileNumber: fileNumber !== undefined ? (fileNumber ? String(fileNumber).trim() : null) : existing.fileNumber,
          patientId: patientId !== undefined ? (patientId || null) : existing.patientId,
          patientName: patientName !== undefined ? (patientName ? String(patientName).trim() : null) : existing.patientName,
          recipientName: recipientName ? String(recipientName).trim() : existing.recipientName,
          recipientPhone: recipientPhone !== undefined ? (recipientPhone ? String(recipientPhone).trim() : null) : existing.recipientPhone,
          reason: reason ? String(reason).trim() : existing.reason,
          date: date ? new Date(date) : existing.date,
          paymentMethod: paymentMethod ? (paymentMethod as PaymentMethod) : existing.paymentMethod,
          paymentStatus: paymentStatus || existing.paymentStatus,
          subtotal: totalAmount,
          totalAmount,
          notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
          status: status || existing.status,
          items: {
            create: preparedItems,
          },
        },
        include: {
          patient: true,
          items: {
            include: {
              medicine: true,
            },
            orderBy: [
              { category: 'asc' },
              { orderIndex: 'asc' },
            ],
          },
        },
      });

      // Si la fiche passe en PAYÉ et ne l'était pas encore
      if (
        (paymentStatus === 'PAID' || status === 'COMPLETED') &&
        existing.paymentStatus !== 'PAID' &&
        totalAmount > 0
      ) {
        const userExists = await tx.user.findUnique({ where: { id: session.id }, select: { id: true } });
        await tx.cashTransaction.create({
          data: {
            clinicId: session.clinicId,
            type: 'INCOME',
            category: 'ACTES_HEBERGEMENT',
            amount: totalAmount,
            paymentMethod: paymentMethod ? (paymentMethod as PaymentMethod) : existing.paymentMethod,
            reference: updated.sheetReference || updated.deliveryNumber,
            description: `Paiement Fiche #${updated.sheetReference || updated.deliveryNumber} - ${updated.patientName || updated.recipientName}`,
            transactionDate: date ? new Date(date) : new Date(),
            performedById: userExists ? session.id : null,
          },
        });
      }

      return updated;
    });

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.UPDATE,
      entity: 'ConsumableDelivery',
      entityId: result.id,
      details: `Modification de la fiche consommable (Réf: ${result.sheetReference || result.deliveryNumber}) - Total: ${result.totalAmount.toLocaleString('fr-FR')} Ar`,
    });

    return NextResponse.json({ success: true, delivery: result });
  } catch (error: any) {
    console.error('Update consumable delivery error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la modification de la fiche : ' + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const allowedRoles = ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST', 'ACCOUNTANT'];
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  try {
    const existing = await prisma.consumableDelivery.findFirst({
      where: { id: params.id, clinicId: session.clinicId },
      include: {
        items: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Restaurer les stocks des médicaments
      for (const item of existing.items) {
        if (item.category === 'MEDICAMENT' && item.medicineId) {
          await tx.medicine.update({
            where: { id: item.medicineId },
            data: { currentStock: { increment: item.quantity } },
          });
        }
      }

      // 2. Supprimer la fiche (les items sont en cascade)
      await tx.consumableDelivery.delete({
        where: { id: existing.id },
      });
    });

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.DELETE,
      entity: 'ConsumableDelivery',
      entityId: existing.id,
      details: `Suppression de la fiche consommable #${existing.sheetReference || existing.deliveryNumber}`,
    });

    return NextResponse.json({ success: true, message: 'Fiche supprimée avec succès' });
  } catch (error: any) {
    console.error('Delete consumable delivery error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la fiche : ' + error.message },
      { status: 500 }
    );
  }
}
