import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction, Gender } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);
  const skip = (page - 1) * limit;

  try {
    const whereClause: any = {
      clinicId: session.clinicId,
      deletedAt: null,
    };

    if (q) {
      whereClause.OR = [
        { lastName: { contains: q } },
        { firstName: { contains: q } },
        { patientNumber: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const [total, patients] = await Promise.all([
      prisma.patient.count({ where: whereClause }),
      prisma.patient.findMany({
        where: whereClause,
        include: {
          primaryDoctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              specialty: { select: { name: true } },
            },
          },
          _count: {
            select: {
              consultations: true,
              prescriptions: true,
              invoices: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      patients,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Fetch patients error:', error);
    return NextResponse.json({ error: 'Erreur lors du chargement des patients' }, { status: 500 });
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
      firstName,
      lastName,
      gender,
      birthDate,
      bloodGroup,
      phone,
      email,
      address,
      city,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRel,
      primaryDoctorId,
      allergies,
      chronicDiseases,
      surgicalHistory,
      familyHistory,
      habits,
      generalNotes,
    } = body;

    if (!firstName || !lastName || !birthDate) {
      return NextResponse.json(
        { error: 'Le prénom, nom et date de naissance sont obligatoires.' },
        { status: 400 }
      );
    }

    // Génération automatique du numéro patient PAT-2026-XXXX
    const count = await prisma.patient.count({ where: { clinicId: session.clinicId } });
    const currentYear = new Date().getFullYear();
    const patientNumber = `PAT-${currentYear}-${String(count + 1).padStart(4, '0')}`;

    const patient = await prisma.patient.create({
      data: {
        clinicId: session.clinicId,
        patientNumber,
        firstName,
        lastName,
        gender: gender === 'FEMALE' ? Gender.FEMALE : Gender.MALE,
        birthDate: new Date(birthDate),
        bloodGroup: bloodGroup || 'Néant',
        phone: phone && String(phone).trim() && String(phone).trim() !== '+261 34' ? String(phone).trim() : 'Néant',
        email: email && String(email).trim() ? String(email).trim() : null,
        address: address && String(address).trim() ? String(address).trim() : 'Néant',
        city: city && String(city).trim() ? String(city).trim() : 'Antananarivo',
        emergencyContactName: emergencyContactName && String(emergencyContactName).trim() ? String(emergencyContactName).trim() : 'Néant',
        emergencyContactPhone: emergencyContactPhone && String(emergencyContactPhone).trim() ? String(emergencyContactPhone).trim() : 'Néant',
        emergencyContactRel: emergencyContactRel && String(emergencyContactRel).trim() ? String(emergencyContactRel).trim() : 'Néant',
        primaryDoctorId: primaryDoctorId || null,
        isActive: true,
        medicalRecord: {
          create: {
            allergies: allergies && String(allergies).trim() ? String(allergies).trim() : 'Néant',
            chronicDiseases: chronicDiseases && String(chronicDiseases).trim() ? String(chronicDiseases).trim() : 'Néant',
            surgicalHistory: surgicalHistory && String(surgicalHistory).trim() ? String(surgicalHistory).trim() : 'Néant',
            familyHistory: familyHistory && String(familyHistory).trim() ? String(familyHistory).trim() : 'Néant',
            habits: habits && String(habits).trim() ? String(habits).trim() : 'Néant',
            generalNotes: generalNotes && String(generalNotes).trim() ? String(generalNotes).trim() : 'Néant',
          },
        },
      },
      include: {
        medicalRecord: true,
      },
    });

    // Journal d'audit
    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.CREATE,
      entity: 'Patient',
      entityId: patient.id,
      details: `Création du patient ${patient.lastName} ${patient.firstName} (${patient.patientNumber})`,
    });

    return NextResponse.json({ success: true, patient }, { status: 201 });
  } catch (error: any) {
    console.error('Create patient error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du patient : ' + (error.message || '') },
      { status: 500 }
    );
  }
}
