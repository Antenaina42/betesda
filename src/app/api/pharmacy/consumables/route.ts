import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction, PaymentMethod, StockExitReason } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deliveryId = searchParams.get('id');

  try {
    if (deliveryId) {
      const delivery = await prisma.consumableDelivery.findFirst({
        where: { id: deliveryId, clinicId: session.clinicId },
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
        return NextResponse.json({ error: 'Fiche de consommables introuvable' }, { status: 404 });
      }

      return NextResponse.json({ delivery });
    }

    const deliveries = await prisma.consumableDelivery.findMany({
      where: { clinicId: session.clinicId },
      include: {
        patient: {
          select: { id: true, patientNumber: true, firstName: true, lastName: true },
        },
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
      orderBy: { createdAt: 'desc' },
      take: 150,
    });

    return NextResponse.json({ deliveries });
  } catch (error: any) {
    console.error('Fetch consumable deliveries error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des fiches de consommables' },
      { status: 500 }
    );
  }
}

async function getNextSheetReference(clinicId: string): Promise<string> {
  const deliveries = await prisma.consumableDelivery.findMany({
    where: { clinicId },
    select: { sheetReference: true, deliveryNumber: true },
  });

  let maxSeq = 0;
  for (const d of deliveries) {
    const ref = d.sheetReference || d.deliveryNumber || '';
    const match = ref.match(/PF\s*-\s*(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  return `PF - ${String(maxSeq + 1).padStart(4, '0')}`;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const allowedRoles = ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST', 'ACCOUNTANT'];
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      action,
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

    // Cas 1 : Création et impression d'une fiche vierge A4 (enregistrement immédiat dans l'historique avec PF-XXXX)
    if (action === 'create-blank') {
      const nextRef = await getNextSheetReference(session.clinicId);
      const deliveryNumber = `BON-${nextRef.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`;

      const blankDelivery = await prisma.consumableDelivery.create({
        data: {
          clinicId: session.clinicId,
          deliveryNumber,
          sheetReference: nextRef,
          recipientName: recipientName?.trim() || 'Infirmière / Service de soins',
          recipientPhone: recipientPhone?.trim() || null,
          patientName: 'Fiche Vierge (En attente de saisie)',
          reason: 'Fiche vierge imprimée pour soins',
          date: new Date(),
          paymentMethod: PaymentMethod.CASH,
          paymentStatus: 'UNPAID',
          subtotal: 0,
          totalAmount: 0,
          status: 'BLANK',
          deliveredById: session.id,
          deliveredByName: `${session.firstName} ${session.lastName}`.trim(),
        },
        include: {
          patient: true,
          items: {
            include: { medicine: true },
            orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }],
          },
        },
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.CREATE,
        entity: 'ConsumableDelivery',
        entityId: blankDelivery.id,
        details: `Impression de la fiche vierge n° ${nextRef} (auto-incrémentée)`,
      });

      return NextResponse.json({ success: true, delivery: blankDelivery, sheetReference: nextRef }, { status: 201 });
    }

    // Cas 2 : Simple génération de la référence suivante
    if (action === 'generate-blank-ref') {
      const nextRef = await getNextSheetReference(session.clinicId);
      return NextResponse.json({ success: true, sheetReference: nextRef });
    }

    // Validation
    const cleanRecipient = recipientName?.trim() || 'Infirmière / Soignant';

    // Génération du numéro de bon unique préfixé par PF -
    const nextRef = await getNextSheetReference(session.clinicId);
    const cleanSheetRef = sheetReference?.trim() || nextRef;
    const deliveryNumber = `BON-${cleanSheetRef.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`;

    // Vérifier si une fiche vierge avec cette référence existe déjà
    const existingBlank = await prisma.consumableDelivery.findFirst({
      where: {
        clinicId: session.clinicId,
        sheetReference: cleanSheetRef,
        status: 'BLANK',
      },
      include: { items: true },
    });

    // Transaction pour enregistrer la délivrance et décrémenter les stocks si médicaments
    const result = await prisma.$transaction(async (tx) => {
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

        // Si l'article est dans la catégorie MEDICAMENT et relié à un médicament de la pharmacie, décrémenter le stock
        if (itemCategory === 'MEDICAMENT' && item.medicineId) {
          const med = await tx.medicine.findUnique({
            where: { id: item.medicineId },
          });

          if (med) {
            await tx.medicine.update({
              where: { id: med.id },
              data: {
                currentStock: { decrement: qty },
              },
            });

            await tx.stockExit.create({
              data: {
                medicineId: med.id,
                quantity: qty,
                reason: StockExitReason.OTHER,
                notes: `Consommable / Fiche #${cleanSheetRef} à ${cleanRecipient}`,
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

      let delivery;

      // Si une fiche vierge préexistante avec ce numéro existait, on la met à jour
      if (existingBlank) {
        await tx.consumableDeliveryItem.deleteMany({
          where: { deliveryId: existingBlank.id },
        });

        delivery = await tx.consumableDelivery.update({
          where: { id: existingBlank.id },
          data: {
            roomNumber: roomNumber ? String(roomNumber).trim() : null,
            fileNumber: fileNumber ? String(fileNumber).trim() : null,
            patientId: patientId || null,
            patientName: patientName ? String(patientName).trim() : null,
            recipientName: cleanRecipient,
            recipientPhone: recipientPhone ? String(recipientPhone).trim() : null,
            reason: reason ? String(reason).trim() : 'Hospitalisation / Soins infirmiers',
            date: date ? new Date(date) : new Date(),
            paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
            paymentStatus: paymentStatus || 'PAID',
            subtotal: totalAmount,
            totalAmount,
            notes: notes ? String(notes).trim() : null,
            status: status || 'COMPLETED',
            items: {
              create: preparedItems,
            },
          },
          include: {
            patient: true,
            items: {
              include: { medicine: true },
              orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }],
            },
          },
        });
      } else {
        // Sinon, création d'une nouvelle fiche
        delivery = await tx.consumableDelivery.create({
          data: {
            clinicId: session.clinicId,
            deliveryNumber,
            sheetReference: cleanSheetRef,
            roomNumber: roomNumber ? String(roomNumber).trim() : null,
            fileNumber: fileNumber ? String(fileNumber).trim() : null,
            patientId: patientId || null,
            patientName: patientName ? String(patientName).trim() : null,
            recipientName: cleanRecipient,
            recipientPhone: recipientPhone ? String(recipientPhone).trim() : null,
            reason: reason ? String(reason).trim() : 'Hospitalisation / Soins infirmiers',
            date: date ? new Date(date) : new Date(),
            paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
            paymentStatus: paymentStatus || 'PAID',
            subtotal: totalAmount,
            totalAmount,
            notes: notes ? String(notes).trim() : null,
            deliveredById: session.id,
            deliveredByName: `${session.firstName} ${session.lastName}`.trim(),
            status: status || 'COMPLETED',
            items: {
              create: preparedItems,
            },
          },
          include: {
            patient: true,
            items: {
              include: { medicine: true },
              orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }],
            },
          },
        });
      }

      // Si payé immédiatement et montant > 0, enregistrer la transaction dans le flux de caisse
      if ((paymentStatus === 'PAID' || status === 'COMPLETED') && totalAmount > 0) {
        const userExists = await tx.user.findUnique({ where: { id: session.id }, select: { id: true } });
        await tx.cashTransaction.create({
          data: {
            clinicId: session.clinicId,
            type: 'INCOME',
            category: 'ACTES_HEBERGEMENT',
            amount: totalAmount,
            paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
            reference: cleanSheetRef,
            description: `Paiement Fiche #${cleanSheetRef} - ${patientName || cleanRecipient}`,
            transactionDate: date ? new Date(date) : new Date(),
            performedById: userExists ? session.id : null,
          },
        });
      }

      return delivery;
    });

    // Journal d'audit
    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.CREATE,
      entity: 'ConsumableDelivery',
      entityId: result.id,
      details: `Fiche de consommables enregistrée (Réf: ${result.sheetReference || result.deliveryNumber}) pour patient "${result.patientName || result.recipientName}" (Total: ${result.totalAmount.toLocaleString('fr-FR')} Ar)`,
    });

    return NextResponse.json({ success: true, delivery: result }, { status: 201 });
  } catch (error: any) {
    console.error('Create consumable delivery error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement de la fiche : ' + error.message },
      { status: 500 }
    );
  }
}
