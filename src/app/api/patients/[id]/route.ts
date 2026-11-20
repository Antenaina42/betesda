import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Gender } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const patient = await prisma.patient.findFirst({
      where: { id: params.id, clinicId: session.clinicId, deletedAt: null },
      include: {
        medicalRecord: true,
        primaryDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            specialty: { select: { name: true } },
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 });
    }

    return NextResponse.json(patient);
  } catch (error) {
    console.error('Fetch patient error:', error);
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
      idCardNumber,
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

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: 'Le nom et le prénom du patient sont obligatoires.' },
        { status: 400 }
      );
    }

    const existing = await prisma.patient.findFirst({
      where: { id: params.id, clinicId: session.clinicId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 });
    }

    const updated = await prisma.patient.update({
      where: { id: params.id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender: gender === 'FEMALE' ? Gender.FEMALE : Gender.MALE,
        birthDate: birthDate ? new Date(birthDate) : existing.birthDate,
        bloodGroup: bloodGroup || 'Non défini',
        phone: phone ? phone.trim() : existing.phone,
        email: email !== undefined ? (email ? email.trim() : null) : existing.email,
        address: address !== undefined ? (address ? address.trim() : null) : existing.address,
        city: city !== undefined ? (city ? city.trim() : 'Antananarivo') : existing.city,
        idCardNumber: idCardNumber !== undefined ? (idCardNumber ? idCardNumber.trim() : null) : existing.idCardNumber,
        emergencyContactName: emergencyContactName !== undefined ? (emergencyContactName ? emergencyContactName.trim() : null) : existing.emergencyContactName,
        emergencyContactPhone: emergencyContactPhone !== undefined ? (emergencyContactPhone ? emergencyContactPhone.trim() : null) : existing.emergencyContactPhone,
        emergencyContactRel: emergencyContactRel !== undefined ? (emergencyContactRel ? emergencyContactRel.trim() : null) : existing.emergencyContactRel,
        primaryDoctorId: primaryDoctorId || null,
        medicalRecord: {
          upsert: {
            create: {
              allergies: allergies || null,
              chronicDiseases: chronicDiseases || null,
              surgicalHistory: surgicalHistory || null,
              familyHistory: familyHistory || null,
              habits: habits || null,
              generalNotes: generalNotes || 'Dossier mis à jour.',
            },
            update: {
              allergies: allergies !== undefined ? (allergies || null) : undefined,
              chronicDiseases: chronicDiseases !== undefined ? (chronicDiseases || null) : undefined,
              surgicalHistory: surgicalHistory !== undefined ? (surgicalHistory || null) : undefined,
              familyHistory: familyHistory !== undefined ? (familyHistory || null) : undefined,
              habits: habits !== undefined ? (habits || null) : undefined,
              generalNotes: generalNotes !== undefined ? (generalNotes || null) : undefined,
            },
          },
        },
      },
      include: {
        primaryDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            specialty: { select: { name: true } },
          },
        },
        medicalRecord: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update patient error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour du patient' },
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

  try {
    const existing = await prisma.patient.findFirst({
      where: { id: params.id, clinicId: session.clinicId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 });
    }

    // Soft delete avec archivage
    await prisma.patient.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Patient archivé et supprimé de la liste avec succès.',
    });
  } catch (error: any) {
    console.error('Delete patient error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du patient' },
      { status: 500 }
    );
  }
}
