import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
  }

  try {
    const { id } = params;
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
      workingHours,
      bio,
      isActive,
    } = body;

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

    const updated = await prisma.doctor.update({
      where: { id },
      data: {
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        title: title !== undefined ? title : undefined,
        specialtyId: finalSpecialtyId !== undefined ? finalSpecialtyId : undefined,
        specialtyName: specialtyName !== undefined ? specialtyName : undefined,
        licenseNumber: licenseNumber !== undefined ? licenseNumber : undefined,
        phone: phone !== undefined ? phone : undefined,
        email: email !== undefined ? email : undefined,
        workingHours: workingHours !== undefined ? workingHours : undefined,
        bio: bio !== undefined ? bio : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
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

    return NextResponse.json({ success: true, doctor: updated });
  } catch (error: any) {
    console.error('Update doctor error:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la modification.' }, { status: 500 });
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

  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
  }

  try {
    const { id } = params;

    // Check if doctor has consultations
    const consultationsCount = await prisma.consultation.count({
      where: { doctorId: id },
    });

    if (consultationsCount > 0) {
      // Soft deactivate instead of hard delete to preserve consultation history
      await prisma.doctor.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, message: 'Médecin désactivé car des consultations y sont rattachées.' });
    }

    await prisma.doctor.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Médecin supprimé avec succès.' });
  } catch (error: any) {
    console.error('Delete doctor error:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la suppression.' }, { status: 500 });
  }
}
