import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const doctors = await prisma.doctor.findMany({
      where: { clinicId: session.clinicId },
      include: {
        user: true,
        specialty: true,
        _count: {
          select: {
            consultations: true,
            prescriptions: true,
            appointments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(doctors);
  } catch (error) {
    console.error('Fetch doctors error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      title = 'Dr.',
      specialtyId,
      specialtyName,
      licenseNumber,
      phone,
      email,
      workingHours = 'Lun - Ven: 08h00 - 17h00',
      bio,
    } = body;

    if (!lastName && !firstName) {
      return NextResponse.json({ error: 'Le nom du médecin est obligatoire.' }, { status: 400 });
    }

    let finalSpecialtyId = specialtyId;
    if (!finalSpecialtyId && specialtyName && specialtyName.trim()) {
      let spec = await prisma.specialty.findUnique({
        where: { name: specialtyName.trim() },
      });
      if (!spec) {
        spec = await prisma.specialty.create({
          data: { name: specialtyName.trim() },
        });
      }
      finalSpecialtyId = spec.id;
    }

    if (!finalSpecialtyId) {
      let defaultSpec = await prisma.specialty.findFirst();
      if (!defaultSpec) {
        defaultSpec = await prisma.specialty.create({
          data: { name: 'Médecine Générale', description: 'Consultations de médecine générale' },
        });
      }
      finalSpecialtyId = defaultSpec.id;
    }

    const doctor = await prisma.doctor.create({
      data: {
        clinicId: session.clinicId,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        title: title || 'Dr.',
        specialtyId: finalSpecialtyId,
        specialtyName: specialtyName?.trim() || null,
        licenseNumber: licenseNumber?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        workingHours: workingHours || 'Lun - Ven: 08h00 - 17h00',
        bio: bio?.trim() || null,
        isActive: true,
      },
      include: {
        user: true,
        specialty: true,
        _count: {
          select: {
            consultations: true,
            prescriptions: true,
            appointments: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, doctor }, { status: 201 });
  } catch (error: any) {
    console.error('Create doctor error:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la création du médecin.' }, { status: 500 });
  }
}
