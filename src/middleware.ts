import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { hasModuleAccess } from '@/lib/permissions';
import { buildPublicUrl } from '@/lib/requestUrl';
import { RoleType } from '@/types';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'betesda_jwt_secret_key_2026_super_secure_987654321_hospital'
);

const COOKIE_NAME = 'betesda_session';

// Chemins publics exemptés de vérification
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignorer les fichiers statiques et assets internes Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/logo') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Vérifier si c'est un chemin public
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path));

  // Récupérer le jeton de session
  const token = request.cookies.get(COOKIE_NAME)?.value;

  let sessionUser: { role: RoleType; id: string; clinicId: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      sessionUser = payload as any;
    } catch {
      sessionUser = null;
    }
  }

  // 1. Utilisateur connecté tentant d'accéder à /login -> Rediriger vers /dashboard
  if (isPublicPath && pathname === '/login' && sessionUser) {
    return NextResponse.redirect(buildPublicUrl(request, '/dashboard'));
  }

  // 2. Utilisateur non connecté sur une route protégée -> Rediriger vers /login
  if (!isPublicPath && !sessionUser) {
    const loginUrl = buildPublicUrl(request, '/login');
    return NextResponse.redirect(loginUrl);
  }

  // 3. Contrôle des autorisations d'accès par rôle (RBAC)
  if (sessionUser && !isPublicPath) {
    const isAllowed = hasModuleAccess(sessionUser.role, pathname);

    if (!isAllowed) {
      // Redirection immédiate vers le dashboard avec alerte d'accès non autorisé
      const redirectUrl = buildPublicUrl(request, '/dashboard');
      redirectUrl.searchParams.set('unauthorized', '1');
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
