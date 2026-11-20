import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction, StockExitReason } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const inventoryId = searchParams.get('id');

  try {
    if (inventoryId) {
      const inventory = await prisma.pharmacyInventory.findFirst({
        where: { id: inventoryId, clinicId: session.clinicId },
        include: {
          items: {
            include: {
              medicine: {
                select: {
                  id: true,
                  name: true,
                  genericName: true,
                  dosage: true,
                  form: true,
                  location: true,
                  category: { select: { name: true } },
                },
              },
            },
            orderBy: { medicineName: 'asc' },
          },
        },
      });

      if (!inventory) {
        return NextResponse.json({ error: 'Inventaire introuvable' }, { status: 404 });
      }

      return NextResponse.json({ inventory });
    }

    const inventories = await prisma.pharmacyInventory.findMany({
      where: { clinicId: session.clinicId },
      include: {
        items: {
          include: {
            medicine: {
              select: {
                name: true,
                dosage: true,
                form: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ inventories });
  } catch (error: any) {
    console.error('Fetch inventories error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des inventaires' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Vérification du rôle
  const allowedRoles = ['SUPER_ADMIN', 'CLINIC_ADMIN', 'PHARMACIST'];
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, notes, items } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Le titre de l\'inventaire est requis.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Veuillez sélectionner au moins un médicament à inventorier.' },
        { status: 400 }
      );
    }

    // Génération du numéro d'inventaire unique INV-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const totalInventoriesThisYear = await prisma.pharmacyInventory.count({
      where: {
        clinicId: session.clinicId,
        createdAt: {
          gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
        },
      },
    });
    const nextSeq = String(totalInventoriesThisYear + 1).padStart(4, '0');
    const inventoryNumber = `INV-${currentYear}-${nextSeq}`;

    // Récupérer tous les médicaments concernés en une requête pour garantir l'intégrité
    const medicineIds = items.map((i: any) => i.medicineId);
    const existingMedicines = await prisma.medicine.findMany({
      where: {
        id: { in: medicineIds },
        clinicId: session.clinicId,
      },
    });

    const medicineMap = new Map(existingMedicines.map((m) => [m.id, m]));

    // Transaction pour l'inventaire et les ajustements de stock
    const result = await prisma.$transaction(async (tx) => {
      let totalFinancialImpact = 0;
      let discrepancyCount = 0;

      const preparedItems: {
        medicineId: string;
        medicineName: string;
        theoreticalStock: number;
        countedStock: number;
        difference: number;
        purchasePrice: number;
        financialImpact: number;
        reason: string | null;
      }[] = [];

      for (const item of items) {
        const med = medicineMap.get(item.medicineId);
        if (!med) continue;

        const theoreticalStock = med.currentStock;
        const countedStock = Math.max(0, parseInt(item.countedStock, 10) || 0);
        const difference = countedStock - theoreticalStock;
        const purchasePrice = med.purchasePrice;
        const financialImpact = difference * purchasePrice;
        const reason = item.reason ? String(item.reason).trim() : null;

        totalFinancialImpact += financialImpact;
        if (difference !== 0) {
          discrepancyCount++;

          // 1. Si manquant (difference < 0) : créer une sortie de stock d'ajustement
          if (difference < 0) {
            const exitQty = Math.abs(difference);
            await tx.stockExit.create({
              data: {
                medicineId: med.id,
                quantity: exitQty,
                reason: StockExitReason.INVENTORY_ADJUSTMENT,
                notes: `Régularisation inventaire ${inventoryNumber} : ${reason || 'Manquant constaté'}`,
                createdById: session.id,
              },
            });
          }

          // 2. Si surplus (difference > 0) : créer une entrée de stock d'ajustement
          if (difference > 0) {
            await tx.stockEntry.create({
              data: {
                medicineId: med.id,
                quantity: difference,
                unitCost: purchasePrice,
                totalCost: difference * purchasePrice,
                notes: `Régularisation inventaire surplus ${inventoryNumber} : ${reason || 'Surplus physique constaté'}`,
                createdById: session.id,
              },
            });
          }

          // 3. Mettre à jour le stock actuel du médicament pour qu'il corresponde exactement au comptage réel
          await tx.medicine.update({
            where: { id: med.id },
            data: { currentStock: countedStock },
          });
        }

        preparedItems.push({
          medicineId: med.id,
          medicineName: med.name,
          theoreticalStock,
          countedStock,
          difference,
          purchasePrice,
          financialImpact,
          reason,
        });
      }

      // Création de l'entête d'inventaire avec ses lignes
      const newInventory = await tx.pharmacyInventory.create({
        data: {
          clinicId: session.clinicId,
          inventoryNumber,
          title: title.trim(),
          status: 'VALIDATED',
          notes: notes ? String(notes).trim() : null,
          totalItemsCount: preparedItems.length,
          discrepancyCount,
          totalFinancialImpact,
          createdById: session.id,
          createdByName: `${session.firstName} ${session.lastName}`.trim(),
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: true,
        },
      });

      return newInventory;
    });

    // Enregistrement dans les logs d'audit
    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.CREATE,
      entity: 'PharmacyInventory',
      entityId: result.id,
      details: `Inventaire régularisé ${result.inventoryNumber} - "${result.title}" (${result.totalItemsCount} articles, ${result.discrepancyCount} écarts, Impact: ${result.totalFinancialImpact.toLocaleString('fr-FR')} Ar)`,
    });

    return NextResponse.json({ success: true, inventory: result }, { status: 201 });
  } catch (error: any) {
    console.error('Inventory creation error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la validation de l\'inventaire : ' + error.message },
      { status: 500 }
    );
  }
}
