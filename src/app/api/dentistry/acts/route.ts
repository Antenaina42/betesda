import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const DEFAULT_DENTAL_ACTS = [
  { name: 'Consultation & Diagnostic Dentaire', price: 15000, description: 'Examen bucco-dentaire initial et devis' },
  { name: 'Extraction Dentaire Simple', price: 30000, description: 'Extraction sous anesthésie locale' },
  { name: 'Extraction Dent de Sagesse', price: 50000, description: 'Extraction complexe ou dent incluse' },
  { name: 'Détartrage Complet & Polissage', price: 40000, description: 'Nettoyage ultrasonique et polissage des deux arcades' },
  { name: 'Soins de Carie & Obturation Composite', price: 35000, description: 'Restauration esthétique par dent' },
  { name: 'Dévitalisation & Traitement Canalaire', price: 60000, description: 'Traitement endodontique mono ou pluriradiculaire' },
  { name: 'Pansement Dentaire Provisoire', price: 15000, description: 'Soins d’urgence et pansement calmant' },
  { name: 'Radiographie Rétro-Alvéolaire', price: 20000, description: 'Cliché radiologique ciblé' },
];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    let acts = await prisma.dentalAct.findMany({
      where: {
        clinicId: session.clinicId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    // Initialisation automatique par défaut si la table est vide pour cette clinique
    if (acts.length === 0) {
      await prisma.dentalAct.createMany({
        data: DEFAULT_DENTAL_ACTS.map((act) => ({
          clinicId: session.clinicId,
          name: act.name,
          price: act.price,
          description: act.description,
          isActive: true,
        })),
      });

      acts = await prisma.dentalAct.findMany({
        where: {
          clinicId: session.clinicId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json({ success: true, acts });
  } catch (error: any) {
    console.error('Fetch dental acts error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement des actes dentaires : ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json(
      { error: 'Accès réservé aux administrateurs.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, price, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Le nom de l’action / soin dentaire est obligatoire.' }, { status: 400 });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'Le tarif doit être un montant valide supérieur ou égal à 0.' }, { status: 400 });
    }

    const newAct = await prisma.dentalAct.create({
      data: {
        clinicId: session.clinicId,
        name: name.trim(),
        price: numericPrice,
        description: description?.trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, act: newAct }, { status: 201 });
  } catch (error: any) {
    console.error('Create dental act error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de l’acte dentaire : ' + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json(
      { error: 'Accès réservé aux administrateurs.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { id, name, price, description, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de l’acte dentaire requis.' }, { status: 400 });
    }

    const updatedAct = await prisma.dentalAct.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    return NextResponse.json({ success: true, act: updatedAct });
  } catch (error: any) {
    console.error('Update dental act error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l’acte dentaire : ' + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json(
      { error: 'Accès réservé aux administrateurs.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de l’acte dentaire requis.' }, { status: 400 });
    }

    await prisma.dentalAct.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Acte dentaire supprimé avec succès.' });
  } catch (error: any) {
    console.error('Delete dental act error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression : ' + error.message },
      { status: 500 }
    );
  }
}
