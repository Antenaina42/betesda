import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction, CashTransactionType, PaymentMethod, SaleStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const sale = await prisma.pharmacySale.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: { medicine: true },
        },
        patient: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Commande pharmacie introuvable' }, { status: 404 });
    }

    return NextResponse.json({ sale });
  } catch (error: any) {
    console.error('Fetch sale error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
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

  try {
    const body = await request.json();
    const { action } = body;

    const existingSale = await prisma.pharmacySale.findUnique({
      where: { id: params.id },
      include: { items: true },
    });

    if (!existingSale) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    // =========================================================================
    // ACTION 1 : MODIFICATION PAR L'ACCUEIL (AVANT PAIEMENT)
    // =========================================================================
    if (action === 'UPDATE_ITEMS') {
      const { items, customerName, customerPhone, discount } = body;
      if (!items || !items.length) {
        return NextResponse.json({ error: 'La commande doit comporter au moins un médicament.' }, { status: 400 });
      }

      const disc = parseFloat(discount || '0');
      const subtotal = items.reduce(
        (sum: number, it: any) => sum + (parseFloat(it.unitPrice) * parseInt(it.quantity, 10)),
        0
      );
      const total = Math.max(0, subtotal - disc);

      const updatedSale = await prisma.$transaction(async (tx) => {
        // Supprimer anciens items
        await tx.pharmacySaleItem.deleteMany({
          where: { pharmacySaleId: existingSale.id },
        });

        // Réinsérer les items modifiés
        return await tx.pharmacySale.update({
          where: { id: existingSale.id },
          data: {
            customerName: customerName || existingSale.customerName,
            customerPhone: customerPhone !== undefined ? customerPhone : existingSale.customerPhone,
            subtotal,
            discount: disc,
            total,
            items: {
              create: items.map((it: any) => ({
                medicineId: it.medicineId,
                medicineName: it.medicineName || it.name,
                quantity: parseInt(it.quantity, 10),
                unitPrice: parseFloat(it.unitPrice),
                totalPrice: parseFloat(it.unitPrice) * parseInt(it.quantity, 10),
              })),
            },
          },
          include: {
            items: true,
            patient: true,
          },
        });
      });

      return NextResponse.json({ success: true, sale: updatedSale });
    }

    // =========================================================================
    // ACTION 2 : ENCAISSEMENT PAR L'ACCUEIL (PAIEMENT & SORTIE DE STOCK EN UNITÉS)
    // =========================================================================
    if (action === 'PAY') {
      const {
        items, // optionnellement modifiés juste avant de valider
        paymentMethod,
        paymentReference,
        discount,
        cashTendered,
      } = body;

      const itemsToUse = items && items.length > 0 ? items : existingSale.items;
      if (!itemsToUse || !itemsToUse.length) {
        return NextResponse.json({ error: 'La commande ne contient aucun article.' }, { status: 400 });
      }

      // 1. Vérification stricte des stocks disponibles en unités
      const medicineIds = itemsToUse.map((i: any) => i.medicineId);
      const dbMedicines = await prisma.medicine.findMany({
        where: { id: { in: medicineIds } },
      });
      const medMap = new Map(dbMedicines.map((m) => [m.id, m]));

      for (const item of itemsToUse) {
        const dbMed = medMap.get(item.medicineId);
        const reqQty = parseInt(item.quantity, 10);
        if (!dbMed) {
          return NextResponse.json({ error: `Médicament introuvable : ${item.medicineName || item.name}` }, { status: 400 });
        }
        if (isNaN(reqQty) || reqQty <= 0) {
          return NextResponse.json(
            { error: `Quantité invalide pour "${dbMed.name}". La quantité doit être supérieure à 0.` },
            { status: 400 }
          );
        }
        if (dbMed.currentStock < reqQty) {
          return NextResponse.json(
            {
              error: `Stock insuffisant pour "${dbMed.name}". Stock disponible : ${dbMed.currentStock} unités, Quantité demandée : ${reqQty} unités`,
            },
            { status: 400 }
          );
        }
      }

      // Calcul des montants
      const subtotal = itemsToUse.reduce(
        (sum: number, it: any) => sum + (parseFloat(it.unitPrice) * parseInt(it.quantity, 10)),
        0
      );
      const disc = parseFloat(discount || '0');
      const isFreeGift = body.isFreeGift !== undefined ? Boolean(body.isFreeGift) : Boolean(existingSale.isFreeGift);
      const total = isFreeGift ? 0 : Math.max(0, subtotal - disc);

      // Calcul du coût clinique au prix d'achat pour les dons gracieux
      const clinicExpenseAmount = itemsToUse.reduce((sum: number, it: any) => {
        const dbM = medMap.get(it.medicineId);
        const purchaseCost = dbM?.purchasePrice && dbM.purchasePrice > 0 ? dbM.purchasePrice : (parseFloat(it.unitPrice) * 0.7);
        return sum + (purchaseCost * parseInt(it.quantity, 10));
      }, 0);

      // Transaction atomique : Déduction de stock en unités + Statut PAID + Enregistrement Caisse
      const paidSale = await prisma.$transaction(async (tx) => {
        // Si les items ont été modifiés au moment du paiement, rafraîchir les items
        if (items && items.length > 0) {
          await tx.pharmacySaleItem.deleteMany({
            where: { pharmacySaleId: existingSale.id },
          });
          for (const it of items) {
            await tx.pharmacySaleItem.create({
              data: {
                pharmacySaleId: existingSale.id,
                medicineId: it.medicineId,
                medicineName: it.medicineName || it.name,
                quantity: parseInt(it.quantity, 10),
                unitPrice: parseFloat(it.unitPrice),
                totalPrice: parseFloat(it.unitPrice) * parseInt(it.quantity, 10),
              },
            });
          }
        }

        // Décrémenter les stocks en unités
        for (const item of itemsToUse) {
          const qty = parseInt(item.quantity, 10);
          await tx.medicine.update({
            where: { id: item.medicineId },
            data: {
              currentStock: {
                decrement: qty,
              },
            },
          });
        }

        // Mettre à jour la vente
        const updated = await tx.pharmacySale.update({
          where: { id: existingSale.id },
          data: {
            subtotal,
            discount: disc,
            total,
            isFreeGift,
            paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
            paymentReference: paymentReference || null,
            status: SaleStatus.PAID,
            cashierId: session.id,
          },
          include: {
            items: true,
            patient: true,
          },
        });

        // Enregistrer dans le journal de caisse (Petite Caisse Accueil)
        if (isFreeGift) {
          await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.EXPENSE,
              category: 'Prise en charge Médicaments',
              amount: clinicExpenseAmount,
              paymentMethod: PaymentMethod.CASH,
              reference: existingSale.saleNumber,
              description: `Prise en charge gracieuse de médicaments au prix d'achat #${existingSale.saleNumber} - Bénéficiaire : ${existingSale.customerName || 'Patient'}`,
              performedById: session.id,
              cashRegister: 'PETITE_CAISSE',
            },
          });
        } else {
          await tx.cashTransaction.create({
            data: {
              clinicId: session.clinicId,
              type: CashTransactionType.INCOME,
              category: 'Pharmacie',
              amount: total,
              paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
              reference: existingSale.saleNumber,
              description: existingSale.employeeId
                ? `Achat médicaments personnel au prix d'achat #${existingSale.saleNumber} (${existingSale.customerName})`
                : `Encaissement Pharmacie #${existingSale.saleNumber} - Client : ${existingSale.customerName || 'Passage'}`,
              performedById: session.id,
              cashRegister: 'PETITE_CAISSE',
            },
          });
        }

        return updated;
      });

      // Marquer la notification de demande de paiement comme traitée / lue
      await prisma.notification.updateMany({
        where: {
          clinicId: session.clinicId,
          title: { contains: existingSale.saleNumber },
        },
        data: {
          isRead: true,
        },
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.UPDATE,
        entity: 'PharmacySale',
        entityId: existingSale.id,
        details: `Paiement validé par l'accueil pour #${existingSale.saleNumber} (Montant : ${total} Ar)`,
      });

      return NextResponse.json({ success: true, sale: paidSale });
    }

    // =========================================================================
    // ACTION 3 : MARQUER COMME LIVRÉ PAR LA PHARMACIE (LORSQUE LE CLIENT PRÉSENTE LE TICKET)
    // =========================================================================
    if (action === 'DELIVER') {
      const deliveredSale = await prisma.pharmacySale.update({
        where: { id: existingSale.id },
        data: {
          status: SaleStatus.DELIVERED,
        },
        include: {
          items: true,
          patient: true,
        },
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.UPDATE,
        entity: 'PharmacySale',
        entityId: existingSale.id,
        details: `Médicaments délivrés au client pour la commande #${existingSale.saleNumber}`,
      });

      return NextResponse.json({ success: true, sale: deliveredSale });
    }

    // =========================================================================
    // ACTION 4 : ANNULATION DE COMMANDE
    // =========================================================================
    if (action === 'CANCEL') {
      const cancelledSale = await prisma.pharmacySale.update({
        where: { id: existingSale.id },
        data: {
          status: SaleStatus.CANCELLED,
        },
      });

      return NextResponse.json({ success: true, sale: cancelledSale });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error: any) {
    console.error('Update sale error:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la mise à jour' }, { status: 500 });
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

  try {
    const sale = await prisma.pharmacySale.findUnique({
      where: { id: params.id },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    if (sale.status === SaleStatus.PAID || sale.status === SaleStatus.DELIVERED) {
      return NextResponse.json({ error: 'Impossible de supprimer une commande déjà payée ou délivrée.' }, { status: 400 });
    }

    await prisma.pharmacySale.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete sale error:', error);
    return NextResponse.json({ error: error.message || 'Erreur suppression' }, { status: 500 });
  }
}
