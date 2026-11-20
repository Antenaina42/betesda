import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = params;

  try {
    const medicine = await prisma.medicine.findFirst({
      where: {
        id,
        clinicId: session.clinicId,
      },
      include: {
        category: true,
      },
    });

    if (!medicine) {
      return NextResponse.json({ error: 'Médicament non trouvé' }, { status: 404 });
    }

    return NextResponse.json(medicine);
  } catch (error: any) {
    console.error('Get medicine error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
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

  // Seule l'administration peut modifier des médicaments
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json(
      { error: "Accès refusé. Seule l'administration peut modifier les médicaments." },
      { status: 403 }
    );
  }

  const { id } = params;

  try {
    const existing = await prisma.medicine.findFirst({
      where: { id, clinicId: session.clinicId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Médicament non trouvé' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      genericName,
      categoryId,
      dosage,
      form,
      packaging,
      purchasePrice,
      sellingPrice,
      currentStock,
      minStockLevel,
      expiryDate,
      location,
      manufacturer,
    } = body;

    let finalCategoryId = categoryId;
    if (body.newCategoryName && body.newCategoryName.trim()) {
      const trimmedCat = body.newCategoryName.trim();
      let cat = await prisma.medicineCategory.findFirst({
        where: { name: trimmedCat },
      });
      if (!cat) {
        cat = await prisma.medicineCategory.create({
          data: { name: trimmedCat },
        });
      }
      finalCategoryId = cat.id;
    }

    if (!name || !genericName || (!finalCategoryId || finalCategoryId === '__OTHER__') || !dosage || !form) {
      return NextResponse.json(
        { error: 'Nom, DCI, Catégorie, Dosage et Forme sont obligatoires.' },
        { status: 400 }
      );
    }

    const updated = await prisma.medicine.update({
      where: { id },
      data: {
        name,
        genericName,
        categoryId: finalCategoryId,
        dosage,
        form,
        packaging: 'Boîte',
        unitsPerBox: body.unitsPerBox !== undefined ? parseInt(body.unitsPerBox, 10) : existing.unitsPerBox,
        purchasePrice: purchasePrice !== undefined ? parseFloat(purchasePrice) : existing.purchasePrice,
        sellingPrice: sellingPrice !== undefined ? parseFloat(sellingPrice) : existing.sellingPrice,
        currentStock: currentStock !== undefined ? parseInt(currentStock, 10) : existing.currentStock,
        minStockLevel: minStockLevel !== undefined ? parseInt(minStockLevel, 10) : existing.minStockLevel,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        location: location !== undefined ? location : existing.location,
        manufacturer: manufacturer !== undefined ? manufacturer : existing.manufacturer,
      },
      include: {
        category: true,
      },
    });

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.UPDATE,
      entity: 'Medicine',
      entityId: updated.id,
      details: `Modification du médicament ${updated.name} (${updated.dosage})`,
    });

    return NextResponse.json({ success: true, medicine: updated });
  } catch (error: any) {
    console.error('Update medicine error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour : ' + error.message },
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

  // Seule l'administration peut supprimer des médicaments
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json(
      { error: "Accès refusé. Seule l'administration peut supprimer des médicaments." },
      { status: 403 }
    );
  }

  const { id } = params;

  try {
    const existing = await prisma.medicine.findFirst({
      where: { id, clinicId: session.clinicId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Médicament non trouvé' }, { status: 404 });
    }

    // Essayer de supprimer définitivement, ou basculer isActive: false si lié à des ventes/consommables/ordonnances
    try {
      await prisma.medicine.delete({
        where: { id },
      });
    } catch (fkError) {
      // Contrainte de clé étrangère : archivage soft delete
      await prisma.medicine.update({
        where: { id },
        data: { isActive: false },
      });
    }

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.DELETE,
      entity: 'Medicine',
      entityId: id,
      details: `Suppression du médicament ${existing.name} (${existing.dosage})`,
    });

    return NextResponse.json({ success: true, message: 'Médicament supprimé avec succès' });
  } catch (error: any) {
    console.error('Delete medicine error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression : ' + error.message },
      { status: 500 }
    );
  }
}
