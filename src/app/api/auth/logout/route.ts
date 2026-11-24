import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { AuditAction } from '@prisma/client';

function createLoginRedirectResponse() {
  // Redirection relative (Location: /login) en 303 See Other :
  // - Convertit POST -> GET vers /login
  // - Évite toute redirection vers l'adresse interne du conteneur (ex: https://0.0.0.0:3000/login) derrière un reverse-proxy Hostinger
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: '/login',
    },
  });
  response.cookies.set('betesda_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export async function POST(_request: NextRequest) {
  const session = await getSession();
  if (session) {
    try {
      await logAuditAction({
        clinicId: session.clinicId,
        userId: session.id,
        action: AuditAction.LOGOUT,
        entity: 'User',
        entityId: session.id,
        details: `Déconnexion de ${session.firstName} ${session.lastName}`,
      });
    } catch {
      // Ne jamais bloquer la déconnexion si le log d'audit échoue
    }
  }

  await clearSessionCookie();
  return createLoginRedirectResponse();
}

export async function GET(_request: NextRequest) {
  await clearSessionCookie();
  return createLoginRedirectResponse();
}
