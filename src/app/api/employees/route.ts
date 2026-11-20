import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

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
    const { lastName, firstName, phone, position, baseSalary } = body;

    if (!lastName || !lastName.trim() || !firstName || !firstName.trim()) {
      return NextResponse.json({ error: 'Le nom et le prénom de l’employé sont requis.' }, { status: 400 });
    }

    if (!position || !position.trim()) {
      return NextResponse.json({ error: 'Le poste de l’employé est requis.' }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: {
        clinicId: session.clinicId,
        lastName: lastName.trim().toUpperCase(),
        firstName: firstName.trim(),
        phone: phone?.trim() || null,
        position: position.trim(),
        baseSalary: parseFloat(baseSalary || '0') || 0,
        isActive: true,
      },
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
    const { id, lastName, firstName, phone, position, baseSalary, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de l’employé requis.' }, { status: 400 });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        lastName: lastName !== undefined ? lastName.trim().toUpperCase() : undefined,
        firstName: firstName !== undefined ? firstName.trim() : undefined,
        phone: phone !== undefined ? (phone?.trim() || null) : undefined,
        position: position !== undefined ? position.trim() : undefined,
        baseSalary: baseSalary !== undefined ? (parseFloat(baseSalary) || 0) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
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

    await prisma.employee.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Employé supprimé avec succès.' });
  } catch (error: any) {
    console.error('Delete employee error:', error);
    return NextResponse.json(
      { error: 'Erreur suppression employé : ' + error.message },
      { status: 500 }
    );
  }
}
