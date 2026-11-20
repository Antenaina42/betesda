import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction } from '@prisma/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const allowedRoles = ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST'];
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  try {
    const existing = await prisma.consumableCatalogItem.findFirst({
      where: { id: params.id, clinicId: session.clinicId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Élément introuvable' }, { status: 404 });
    }

    const body = await request.json();
    const { category, name, description, unit, price, isActive, orderIndex } = body;

    const updated = await prisma.consumableCatalogItem.update({
      where: { id: params.id },
      data: {
        ...(category ? { category } : {}),
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(unit !== undefined ? { unit: String(unit).trim() } : {}),
        ...(price !== undefined ? { price: parseFloat(price) || 0 } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(orderIndex !== undefined ? { orderIndex: parseInt(orderIndex, 10) } : {}),
      },
    });

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.UPDATE,
      entity: 'ConsumableCatalogItem',
      entityId: updated.id,
      details: `Modification de l'élément de catalogue ${updated.name} (${updated.price} Ar)`,
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('Update catalog item error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'élément : ' + error.message },
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

  const allowedRoles = ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST'];
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  try {
    const existing = await prisma.consumableCatalogItem.findFirst({
      where: { id: params.id, clinicId: session.clinicId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Élément introuvable' }, { status: 404 });
    }

    await prisma.consumableCatalogItem.delete({
      where: { id: params.id },
    });

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.DELETE,
      entity: 'ConsumableCatalogItem',
      entityId: existing.id,
      details: `Suppression de l'élément de catalogue ${existing.name}`,
    });

    return NextResponse.json({ success: true, message: 'Élément supprimé avec succès' });
  } catch (error: any) {
    console.error('Delete catalog item error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'élément : ' + error.message },
      { status: 500 }
    );
  }
}
