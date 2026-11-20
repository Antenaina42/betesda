import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  try {
    const where: any = {
      clinicId: session.clinicId,
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    const items = await prisma.consumableCatalogItem.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { orderIndex: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('Fetch consumable catalog items error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement du catalogue : ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const allowedRoles = ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST'];
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { category, name, description, unit, price, medicineId } = body;

    if (!category || !name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'La catégorie et le nom de l\'élément sont obligatoires.' },
        { status: 400 }
      );
    }

    const validCategories = ['MEDICAMENT', 'ACTE_INFIRMIER', 'HEBERGEMENT', 'AUTRE'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Catégorie invalide. Doit être MEDICAMENT, ACTE_INFIRMIER, HEBERGEMENT ou AUTRE.' },
        { status: 400 }
      );
    }

    const maxOrder = await prisma.consumableCatalogItem.aggregate({
      where: { clinicId: session.clinicId, category },
      _max: { orderIndex: true },
    });
    const nextOrder = (maxOrder._max.orderIndex ?? -1) + 1;

    const item = await prisma.consumableCatalogItem.create({
      data: {
        clinicId: session.clinicId,
        category,
        name: name.trim(),
        description: description ? String(description).trim() : null,
        unit: unit ? String(unit).trim() : (category === 'HEBERGEMENT' ? 'Jour' : 'Acte'),
        price: parseFloat(price) || 0,
        medicineId: medicineId || null,
        orderIndex: nextOrder,
      },
    });

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.CREATE,
      entity: 'ConsumableCatalogItem',
      entityId: item.id,
      details: `Ajout au catalogue ${category} : ${item.name} (${item.price} Ar)`,
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error: any) {
    console.error('Create consumable catalog item error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'élément de catalogue : ' + error.message },
      { status: 500 }
    );
  }
}
