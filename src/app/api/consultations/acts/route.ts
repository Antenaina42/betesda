import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { DEFAULT_CONSULTATION_ACTS, ConsultationAct } from '@/lib/consultationActs';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: {
        clinicId_key: {
          clinicId: session.clinicId,
          key: 'consultation_acts',
        },
      },
    });

    if (setting && setting.value) {
      try {
        const acts: ConsultationAct[] = JSON.parse(setting.value);
        if (Array.isArray(acts) && acts.length > 0) {
          return NextResponse.json({ success: true, acts });
        }
      } catch (err) {
        console.error('Failed to parse consultation_acts setting:', err);
      }
    }

    return NextResponse.json({ success: true, acts: DEFAULT_CONSULTATION_ACTS });
  } catch (error: any) {
    console.error('Fetch consultation acts error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement des actes : ' + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Seuls les administrateurs peuvent modifier la grille officielle des tarifs
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json(
      { error: 'Accès refusé : Seuls les administrateurs peuvent modifier la grille officielle des tarifs.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { acts } = body;

    if (!Array.isArray(acts) || acts.length === 0) {
      return NextResponse.json(
        { error: 'Une liste valide d’actes médicaux est requise.' },
        { status: 400 }
      );
    }

    // Validation et assainissement des actes
    const validatedActs: ConsultationAct[] = acts.map((a: any, idx: number) => ({
      id: a.id || `act-${Date.now()}-${idx}`,
      name: String(a.name || 'Acte Médical').trim(),
      price: Math.max(0, parseFloat(a.price) || 0),
      icon: a.icon || '🩺',
      description: a.description ? String(a.description).trim() : undefined,
    }));

    await prisma.setting.upsert({
      where: {
        clinicId_key: {
          clinicId: session.clinicId,
          key: 'consultation_acts',
        },
      },
      create: {
        clinicId: session.clinicId,
        key: 'consultation_acts',
        value: JSON.stringify(validatedActs),
        category: 'medical_pricing',
      },
      update: {
        value: JSON.stringify(validatedActs),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Grille tarifaire des actes mise à jour avec succès.',
      acts: validatedActs,
    });
  } catch (error: any) {
    console.error('Update consultation acts error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des actes : ' + error.message },
      { status: 500 }
    );
  }
}
