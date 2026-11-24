import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

function extractDoctorSpecialty(position: string, explicitDescription?: string | null): string {
  if (explicitDescription && explicitDescription.trim() && explicitDescription.trim() !== 'Néant') {
    return explicitDescription.trim();
  }
  const parts = position.split(/\s*[—\-|:]\s*/);
  if (parts.length > 1 && parts[1].trim() && parts[1].trim() !== 'Néant') {
    return parts.slice(1).join(' - ').trim();
  }
  return 'Médecine Générale';
}

function isDoctorPosition(position: string, staffCategory?: string | null): boolean {
  if (staffCategory && /^m[eé]decin$/i.test(staffCategory.trim())) return true;
  return /^m[eé]decin(\b|\s|[—\-|:])/i.test((position || '').trim());
}

async function syncDoctorFromEmployee(params: {
  clinicId: string;
  firstName: string;
  lastName: string;
  phone: string;
  position: string;
  staffCategory?: string | null;
  description?: string | null;
  isActive: boolean;
  previousFirstName?: string;
  previousLastName?: string;
}) {
  const shouldBeDoctor = isDoctorPosition(params.position, params.staffCategory);
  const clinicDoctors = await prisma.doctor.findMany({
    where: { clinicId: params.clinicId },
  });

  const norm = (s?: string | null) => (s || '').trim().toLowerCase();
  const findExisting = (f: string, l: string) =>
    clinicDoctors.find((d) => norm(d.firstName) === norm(f) && norm(d.lastName) === norm(l));

  const existing =
    findExisting(params.firstName, params.lastName) ||
    (params.previousFirstName && params.previousLastName
      ? findExisting(params.previousFirstName, params.previousLastName)
      : undefined);

  if (shouldBeDoctor) {
    const spec = extractDoctorSpecialty(params.position, params.description);
    if (existing) {
      await prisma.doctor.update({
        where: { id: existing.id },
        data: {
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
          specialtyName: spec,
          bio: params.description && params.description.trim() !== 'Néant' ? params.description.trim() : existing.bio,
          isActive: params.isActive,
        },
      });
    } else {
      await prisma.doctor.create({
        data: {
          clinicId: params.clinicId,
          firstName: params.firstName,
          lastName: params.lastName,
          title: 'Dr.',
          specialtyName: spec,
          phone: params.phone,
          bio: params.description && params.description.trim() !== 'Néant' ? params.description.trim() : null,
          isActive: params.isActive,
        },
      });
    }
  } else if (existing && !existing.userId) {
    await prisma.doctor.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const employees = await prisma.employee.findMany({
      where: {
        clinicId: session.clinicId,
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    return NextResponse.json({ success: true, employees });
  } catch (error: any) {
    console.error('Fetch employees error:', error);
    return NextResponse.json(
      { error: 'Erreur chargement employés : ' + error.message },
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
    const { lastName, firstName, phone, position, baseSalary, staffCategory, description } = body;

    if (!lastName || !lastName.trim() || !firstName || !firstName.trim()) {
      return NextResponse.json({ error: 'Le nom et le prénom de l’employé sont requis.' }, { status: 400 });
    }

    if (!position || !position.trim()) {
      return NextResponse.json({ error: 'Le poste de l’employé est requis.' }, { status: 400 });
    }

    const cleanLast = lastName.trim().toUpperCase();
    const cleanFirst = firstName.trim();
    const cleanPhone = phone?.trim() || 'Néant';
    const cleanPosition = position.trim();

    const employee = await prisma.employee.create({
      data: {
        clinicId: session.clinicId,
        lastName: cleanLast,
        firstName: cleanFirst,
        phone: cleanPhone,
        position: cleanPosition,
        baseSalary: parseFloat(baseSalary || '0') || 0,
        isActive: true,
      },
    });

    // Synchronisation automatique vers la liste des médecins si catégorie "Médecin"
    await syncDoctorFromEmployee({
      clinicId: session.clinicId,
      firstName: cleanFirst,
      lastName: cleanLast,
      phone: cleanPhone,
      position: cleanPosition,
      staffCategory,
      description,
      isActive: true,
    });

    return NextResponse.json({ success: true, employee }, { status: 201 });
  } catch (error: any) {
    console.error('Create employee error:', error);
    return NextResponse.json(
      { error: 'Erreur création employé : ' + error.message },
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
    const { id, lastName, firstName, phone, position, baseSalary, isActive, staffCategory, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de l’employé requis.' }, { status: 400 });
    }

    const existingEmp = await prisma.employee.findUnique({ where: { id } });

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        lastName: lastName !== undefined ? lastName.trim().toUpperCase() : undefined,
        firstName: firstName !== undefined ? firstName.trim() : undefined,
        phone: phone !== undefined ? (phone?.trim() || 'Néant') : undefined,
        position: position !== undefined ? position.trim() : undefined,
        baseSalary: baseSalary !== undefined ? (parseFloat(baseSalary) || 0) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    await syncDoctorFromEmployee({
      clinicId: session.clinicId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone || 'Néant',
      position: employee.position,
      staffCategory,
      description,
      isActive: employee.isActive,
      previousFirstName: existingEmp?.firstName,
      previousLastName: existingEmp?.lastName,
    });

    return NextResponse.json({ success: true, employee });
  } catch (error: any) {
    console.error('Update employee error:', error);
    return NextResponse.json(
      { error: 'Erreur modification employé : ' + error.message },
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
      return NextResponse.json({ error: 'ID de l’employé requis.' }, { status: 400 });
    }

    const existingEmp = await prisma.employee.findUnique({ where: { id } });

    await prisma.employee.delete({
      where: { id },
    });

    if (existingEmp && isDoctorPosition(existingEmp.position)) {
      const clinicDoctors = await prisma.doctor.findMany({
        where: { clinicId: session.clinicId, userId: null },
      });
      const norm = (s?: string | null) => (s || '').trim().toLowerCase();
      const matchedDoc = clinicDoctors.find(
        (d) => norm(d.firstName) === norm(existingEmp.firstName) && norm(d.lastName) === norm(existingEmp.lastName)
      );
      if (matchedDoc) {
        await prisma.doctor.update({
          where: { id: matchedDoc.id },
          data: { isActive: false },
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Employé supprimé avec succès.' });
  } catch (error: any) {
    console.error('Delete employee error:', error);
    return NextResponse.json(
      { error: 'Erreur suppression employé : ' + error.message },
      { status: 500 }
    );
  }
}
