import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const isPharmacist = session.role === 'PHARMACIST';
    const isReceptionist = session.role === 'RECEPTIONIST';

    // RÈGLE :
    // - Pharmacie : uniquement les alertes de rupture de stock (LOW_STOCK)
    // - Accueil : uniquement les demandes de paiement envoyées par le pharmacien
    const whereClause: any = {
      clinicId: session.clinicId,
    };

    if (isPharmacist) {
      whereClause.type = 'LOW_STOCK';

      // Vérifier et synchroniser en temps réel les médicaments en rupture critique (stock <= seuil)
      const lowStockMeds = await prisma.medicine.findMany({
        where: {
          clinicId: session.clinicId,
          isActive: true,
          currentStock: { lte: 15 },
        },
        take: 10,
      });

      for (const med of lowStockMeds) {
        const existing = await prisma.notification.findFirst({
          where: {
            clinicId: session.clinicId,
            type: 'LOW_STOCK',
            title: { contains: med.name },
          },
        });

        if (!existing) {
          const isCritical = med.currentStock <= 2;
          await prisma.notification.create({
            data: {
              clinicId: session.clinicId,
              type: 'LOW_STOCK',
              title: isCritical
                ? `Rupture de Stock : ${med.name}`
                : `Alerte Stock Faible : ${med.name}`,
              message: `Le stock de ${med.name} (${med.dosage || ''} ${med.form || ''}) est à ${med.currentStock} unité(s) restante(s) (seuil : ${med.minStockLevel || 10}). Réapprovisionnement requis.`,
              linkUrl: '/pharmacy/stock',
              isRead: false,
            },
          });
        }
      }
    } else if (isReceptionist) {
      // Pour l'accueil : Synchroniser les demandes de paiement transmises par le pharmacien
      const pendingSales = await prisma.pharmacySale.findMany({
        where: {
          clinicId: session.clinicId,
          status: 'PENDING_PAYMENT',
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      });

      for (const sale of pendingSales) {
        const existing = await prisma.notification.findFirst({
          where: {
            clinicId: session.clinicId,
            title: { contains: sale.saleNumber },
          },
        });

        if (!existing) {
          await prisma.notification.create({
            data: {
              clinicId: session.clinicId,
              type: 'PAYMENT_RECEIVED',
              title: `Demande de paiement : ${sale.saleNumber}`,
              message: `Le pharmacien a transmis la commande ${sale.saleNumber} (${sale.customerName || 'Client de passage'}) pour encaissement (${sale.total.toLocaleString('fr-FR')} Ar).`,
              linkUrl: '/pharmacy/sales',
              isRead: false,
            },
          });
        }
      }

      whereClause.OR = [
        { type: 'PAYMENT_RECEIVED' },
        { title: { contains: 'Demande de paiement' } },
      ];
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des notifications' }, { status: 500 });
  }
}

export async function PATCH() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const isPharmacist = session.role === 'PHARMACIST';
    const isReceptionist = session.role === 'RECEPTIONIST';
    const whereClause: any = {
      clinicId: session.clinicId,
      isRead: false,
    };

    if (isPharmacist) {
      whereClause.type = 'LOW_STOCK';
    } else if (isReceptionist) {
      whereClause.OR = [
        { type: 'PAYMENT_RECEIVED' },
        { title: { contains: 'Demande de paiement' } },
      ];
    }

    await prisma.notification.updateMany({
      where: whereClause,
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
