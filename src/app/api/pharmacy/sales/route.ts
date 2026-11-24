import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction, CashTransactionType, PaymentMethod, SaleStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    const whereClause: any = { clinicId: session.clinicId };
    if (statusParam) {
      whereClause.status = statusParam;
    }

    const sales = await prisma.pharmacySale.findMany({
      where: whereClause,
      include: {
        items: {
          include: { medicine: true },
        },
        patient: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(sales);
  } catch (error) {
    console.error('Fetch sales error:', error);
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
      prescriptionId,
      patientId,
      employeeId,
      isFreeGift = false,
      customerName,
      customerPhone,
      items,
      paymentMethod,
      paymentReference,
      discount,
    } = body;

    if (!items || !items.length) {
      return NextResponse.json(
        { error: 'Le panier ne contient aucun médicament.' },
        { status: 400 }
      );
    }

    // 1. Vérification stricte des stocks disponibles en base
    const medicineIds = items.map((i: any) => i.medicineId);
    const dbMedicines = await prisma.medicine.findMany({
      where: { id: { in: medicineIds } },
    });
    const medMap = new Map(dbMedicines.map((m) => [m.id, m]));

    for (const item of items) {
      const dbMed = medMap.get(item.medicineId);
      const reqQty = Number(item.quantity);
      if (!dbMed) {
        return NextResponse.json(
          { error: `Médicament introuvable : ${item.name}` },
          { status: 400 }
        );
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
            error: `Stock insuffisant pour "${dbMed.name}". Stock disponible : ${dbMed.currentStock}, Quantité demandée : ${reqQty}`,
          },
          { status: 400 }
        );
      }
    }

    // Calcul montants
    const subtotal = items.reduce(
      (sum: number, it: any) => sum + (it.unitPrice * it.quantity),
      0
    );
    const disc = parseFloat(discount || '0');
    const total = isFreeGift ? 0 : Math.max(0, subtotal - disc);

    // Calcul du coût clinique au prix d'achat pour les dons gracieux
    const clinicExpenseAmount = items.reduce((sum: number, it: any) => {
      const dbM = medMap.get(it.medicineId);
      const purchaseCost = dbM?.purchasePrice && dbM.purchasePrice > 0 ? dbM.purchasePrice : (parseFloat(it.unitPrice) * 0.7);
      return sum + (purchaseCost * parseInt(it.quantity, 10));
    }, 0);

    // Numéro de commande ou vente
    const count = await prisma.pharmacySale.count({ where: { clinicId: session.clinicId } });
    const currentYear = new Date().getFullYear();
    const isPendingOrder = body.status === 'PENDING_PAYMENT' || body.action === 'SEND_TO_RECEPTION';
    const saleNumber = isPendingOrder
      ? `CMD-${currentYear}-${String(count + 1).padStart(4, '0')}`
      : `VTE-${currentYear}-${String(count + 1).padStart(4, '0')}`;

    // Si c'est une demande envoyée à l'accueil (non payée encore) :
    // On crée la commande sans décrémenter le stock ni impacter la caisse
    if (isPendingOrder) {
      const createdSale = await prisma.pharmacySale.create({
        data: {
          saleNumber,
          clinicId: session.clinicId,
          prescriptionId: prescriptionId || null,
          patientId: patientId || null,
          employeeId: employeeId || null,
          isFreeGift: !!isFreeGift,
          customerName: customerName || 'Client de passage',
          customerPhone: customerPhone && String(customerPhone).trim() ? String(customerPhone).trim() : 'Néant',
          subtotal,
          discount: disc,
          total,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          paymentReference: paymentReference && String(paymentReference).trim() ? String(paymentReference).trim() : 'Néant',
          status: SaleStatus.PENDING_PAYMENT,
          cashierId: session.id,
          items: {
            create: items.map((it: any) => ({
              medicineId: it.medicineId,
              medicineName: it.name || it.medicineName,
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

      // Notification immédiate pour l'accueil : demande de paiement transmise par la pharmacie
      await prisma.notification.create({
        data: {
          clinicId: session.clinicId,
          type: 'PAYMENT_RECEIVED',
          title: `Demande de paiement : #${saleNumber}`,
          message: isFreeGift
            ? `Le pharmacien a transmis un bon de retrait gratuit #${saleNumber} (${customerName || 'Patient'}) - Prise en charge clinique.`
            : `Le pharmacien a transmis la commande #${saleNumber} (${customerName || 'Client de passage'}) pour encaissement de ${total.toLocaleString('fr-FR')} Ar.`,
          linkUrl: '/pharmacy/sales',
          isRead: false,
        },
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.CREATE,
        entity: 'PharmacySale',
        entityId: createdSale.id,
        details: isFreeGift
          ? `Bon de dispensation gratuite #${saleNumber} (${customerName}) valorisé à ${clinicExpenseAmount} Ar au prix de revient.`
          : `Demande de médicaments #${saleNumber} transmise à l'accueil pour encaissement (${total} Ar)`,
      });

      return NextResponse.json({ success: true, sale: createdSale, isPending: true });
    }

    // Transaction atomique : création vente + décrémentation stock + caisse
    const sale = await prisma.$transaction(async (tx) => {
      // Décrémenter chaque médicament
      for (const item of items) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: {
            currentStock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // Créer la vente
      const createdSale = await tx.pharmacySale.create({
        data: {
          saleNumber,
          clinicId: session.clinicId,
          prescriptionId: prescriptionId || null,
          patientId: patientId || null,
          employeeId: employeeId || null,
          isFreeGift: !!isFreeGift,
          customerName: customerName || 'Client de passage',
          customerPhone: customerPhone && String(customerPhone).trim() ? String(customerPhone).trim() : 'Néant',
          subtotal,
          discount: disc,
          total,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          paymentReference: paymentReference && String(paymentReference).trim() ? String(paymentReference).trim() : 'Néant',
          status: SaleStatus.PAID,
          cashierId: session.id,
          items: {
            create: items.map((it: any) => ({
              medicineId: it.medicineId,
              medicineName: it.name,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.unitPrice * it.quantity,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Enregistrer dans le journal de caisse (Petite Caisse Accueil)
      if (isFreeGift) {
        // La clinique prend en charge au prix d'achat -> Dépense Petite Caisse
        await tx.cashTransaction.create({
          data: {
            clinicId: session.clinicId,
            type: CashTransactionType.EXPENSE,
            category: 'Prise en charge Médicaments',
            amount: clinicExpenseAmount,
            paymentMethod: PaymentMethod.CASH,
            reference: saleNumber,
            description: `Prise en charge gracieuse de médicaments au prix d'achat #${saleNumber} - Bénéficiaire : ${customerName || 'Patient'}`,
            performedById: session.id,
            cashRegister: 'PETITE_CAISSE',
          },
        });
      } else {
        // Vente normale -> Entrée Petite Caisse
        await tx.cashTransaction.create({
          data: {
            clinicId: session.clinicId,
            type: CashTransactionType.INCOME,
            category: 'Pharmacie',
            amount: total,
            paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
            reference: saleNumber,
            description: employeeId
              ? `Achat médicaments personnel au prix d'achat ${saleNumber} (${customerName})`
              : `Vente pharmacie comptoir ${saleNumber} (${customerName || 'Client'})`,
            performedById: session.id,
            cashRegister: 'PETITE_CAISSE',
          },
        });
      }

      return createdSale;
    });

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.DISPENSE,
      entity: 'PharmacySale',
      entityId: sale.id,
      details: `Vente pharmacie ${sale.saleNumber} effectuée pour un montant de ${total} Ar. Stock déduit automatiquement.`,
    });

    return NextResponse.json({ success: true, sale }, { status: 201 });
  } catch (error: any) {
    console.error('Pharmacy sale error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vente pharmacie : ' + error.message },
      { status: 500 }
    );
  }
}
