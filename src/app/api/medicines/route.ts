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
  const q = searchParams.get('q')?.trim() || '';
  const categoryId = searchParams.get('categoryId');

  try {
    const whereClause: any = {
      clinicId: session.clinicId,
      isActive: true,
    };
    if (q) {
      whereClause.OR = [
        { name: { contains: q } },
        { genericName: { contains: q } },
      ];
    }
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    const medicines = await prisma.medicine.findMany({
      where: whereClause,
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    const isAdmin = session.role === 'SUPER_ADMIN' || session.role === 'CLINIC_ADMIN';
    const sanitized = isAdmin
      ? medicines
      : medicines.map((m) => ({ ...m, purchasePrice: 0 }));

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('Fetch medicines error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Seule l'administration peut ajouter des médicaments
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json(
      { error: "Accès refusé. Seule l'administration peut ajouter de nouveaux médicaments." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      genericName,
      categoryId,
      dosage,
      form,
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

    const initialQty = parseInt(currentStock || '0', 10);
    const uPerBox = parseInt(body.unitsPerBox || '30', 10);

    const med = await prisma.medicine.create({
      data: {
        clinicId: session.clinicId,
        name,
        genericName,
        categoryId: finalCategoryId,
        dosage,
        form,
        packaging: 'Boîte',
        unitsPerBox: uPerBox,
        purchasePrice: parseFloat(purchasePrice || '0'),
        sellingPrice: parseFloat(sellingPrice || '0'),
        currentStock: initialQty,
        minStockLevel: parseInt(minStockLevel || '10', 10),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        location: location || 'Rayon principal',
        manufacturer: manufacturer || null,
        isActive: true,
      },
      include: { category: true },
    });

    if (initialQty > 0) {
      const pPrice = parseFloat(purchasePrice || '0');
      await prisma.stockEntry.create({
        data: {
          medicineId: med.id,
          quantity: initialQty,
          boxesCount: parseInt(body.boxesCount || '1', 10),
          unitsPerBox: uPerBox,
          unitCost: pPrice,
          totalCost: pPrice * initialQty,
          createdById: session.id,
          notes: 'Initialisation stock catalogue',
          attachmentUrl: body.attachmentUrl || null,
          attachmentName: body.attachmentName || null,
        },
      });
    }

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.CREATE,
      entity: 'Medicine',
      entityId: med.id,
      details: `Ajout du médicament ${med.name} (${med.dosage}) au catalogue pharmacie`,
    });

    return NextResponse.json({ success: true, medicine: med }, { status: 201 });
  } catch (error: any) {
    console.error('Create medicine error:', error);
    return NextResponse.json(
      { error: 'Erreur création médicament : ' + error.message },
      { status: 500 }
    );
  }
}
