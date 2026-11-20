import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, hashPassword } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction } from '@prisma/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // Droits administrateur requis
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json({ error: 'Accès interdit. Droits insuffisants.' }, { status: 403 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        id: params.id,
        clinicId: session.clinicId,
      },
      include: {
        role: true,
        doctorProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const body = await request.json();

    // Cas 1 : Simple bascule de statut actif/inactif
    if (Object.keys(body).length === 1 && typeof body.isActive === 'boolean') {
      if (params.id === session.id && body.isActive === false) {
        return NextResponse.json(
          { error: 'Vous ne pouvez pas désactiver votre propre compte administrateur.' },
          { status: 400 }
        );
      }

      const updated = await prisma.user.update({
        where: { id: params.id },
        data: { isActive: body.isActive },
      });

      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.UPDATE,
        entity: 'User',
        entityId: user.id,
        details: `${body.isActive ? 'Activation' : 'Désactivation'} du compte de ${user.firstName} ${user.lastName}`,
      });

      return NextResponse.json({
        success: true,
        message: `Compte ${body.isActive ? 'activé' : 'désactivé'} avec succès`,
        user: updated,
      });
    }

    // Cas 2 : Modification complète des informations
    const {
      firstName,
      lastName,
      phone,
      password,
      roleId,
      isActive,
      specialtyId,
      licenseNumber,
      workingHours,
      bio,
    } = body;

    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (typeof isActive === 'boolean') {
      if (params.id === session.id && isActive === false) {
        return NextResponse.json(
          { error: 'Vous ne pouvez pas désactiver votre propre compte administrateur.' },
          { status: 400 }
        );
      }
      updateData.isActive = isActive;
    }

    if (roleId) {
      const roleExists = await prisma.role.findUnique({ where: { id: roleId } });
      if (!roleExists) {
        return NextResponse.json({ error: 'Rôle sélectionné invalide' }, { status: 400 });
      }
      updateData.roleId = roleId;
    }

    if (password && password.trim().length >= 6) {
      updateData.passwordHash = await hashPassword(password.trim());
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      include: {
        role: true,
        doctorProfile: {
          include: {
            specialty: true,
          },
        },
      },
    });

    // Mettre à jour le profil médecin si applicable
    if (licenseNumber || specialtyId || workingHours || bio) {
      if (user.doctorProfile) {
        await prisma.doctor.update({
          where: { id: user.doctorProfile.id },
          data: {
            ...(licenseNumber ? { licenseNumber } : {}),
            ...(specialtyId ? { specialtyId } : {}),
            ...(workingHours ? { workingHours } : {}),
            ...(bio !== undefined ? { bio } : {}),
          },
        });
      }
    }

    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: user.id,
      details: `Mise à jour des informations de l'utilisateur ${user.firstName} ${user.lastName}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour de l’utilisateur' },
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
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // Droits administrateur requis
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLINIC_ADMIN') {
    return NextResponse.json({ error: 'Accès interdit. Droits insuffisants.' }, { status: 403 });
  }

  try {
    const userToDelete = await prisma.user.findFirst({
      where: {
        id: params.id,
        clinicId: session.clinicId,
      },
      include: {
        role: true,
        doctorProfile: true,
      },
    });

    if (!userToDelete) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    // Interdiction de supprimer son propre compte en cours de session
    if (params.id === session.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte utilisateur actuellement connecté.' },
        { status: 400 }
      );
    }

    // Vérifier s'il s'agit du dernier SUPER_ADMIN de la clinique
    if (userToDelete.role.name === 'SUPER_ADMIN') {
      const superAdminCount = await prisma.user.count({
        where: {
          clinicId: session.clinicId,
          role: { name: 'SUPER_ADMIN' },
        },
      });

      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Action impossible : il s’agit du seul Super Administrateur de la clinique.' },
          { status: 400 }
        );
      }
    }

    // Nettoyage et dissociation préventive des relations :
    // 1. Dissocier le profil médecin sans perdre les consultations historiques
    if (userToDelete.doctorProfile) {
      await prisma.doctor.update({
        where: { id: userToDelete.doctorProfile.id },
        data: { userId: null },
      });
    }

    // 2. Dissocier les transactions de caisse effectuées par l'utilisateur
    await prisma.cashTransaction.updateMany({
      where: { performedById: userToDelete.id },
      data: { performedById: null },
    });

    // 3. Dissocier les logs d'audit
    await prisma.auditLog.updateMany({
      where: { userId: userToDelete.id },
      data: { userId: null },
    });

    // 4. Supprimer les notifications et messages liés
    await prisma.notification.deleteMany({
      where: { userId: userToDelete.id },
    });

    await prisma.chatMessage.deleteMany({
      where: {
        OR: [
          { senderId: userToDelete.id },
          { receiverId: userToDelete.id },
        ],
      },
    });

    // 5. Suppression de l'utilisateur
    await prisma.user.delete({
      where: { id: userToDelete.id },
    });

    // 6. Enregistrement dans les logs d'audit
    await logAuditAction({
      clinicId: session.clinicId,
      userId: session.id,
      action: AuditAction.DELETE,
      entity: 'User',
      entityId: userToDelete.id,
      details: `Suppression définitive du compte collaborateur ${userToDelete.firstName} ${userToDelete.lastName} (${userToDelete.email}) - Rôle: ${userToDelete.role.displayName}`,
    });

    return NextResponse.json({
      success: true,
      message: `Le collaborateur ${userToDelete.firstName} ${userToDelete.lastName} a été supprimé avec succès.`,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression du collaborateur' },
      { status: 500 }
    );
  }
}
