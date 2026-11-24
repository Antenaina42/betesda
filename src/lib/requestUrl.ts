import type { NextRequest } from 'next/server';

/**
 * Reconstruit l'origine publique (protocole + domaine) derrière un reverse-proxy
 * (Hostinger, Nginx, LiteSpeed) pour éviter les redirections vers l'adresse interne
 * d'écoute du conteneur (ex: http://0.0.0.0:3000 ou https://0.0.0.0:3000).
 */
export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = request.headers.get('host')?.split(',')[0]?.trim();
  const rawHost = forwardedHost || hostHeader;

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const urlProto = request.nextUrl.protocol.replace(':', '');

  const isInternalHost =
    !rawHost ||
    rawHost.startsWith('0.0.0.0') ||
    rawHost.startsWith('127.0.0.1') ||
    rawHost.startsWith('[::]');

  if (!isInternalHost) {
    const isLocal = rawHost.startsWith('localhost');
    const proto = forwardedProto || (isLocal ? 'http' : urlProto || 'https');
    return `${proto}://${rawHost}`;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }

  return request.nextUrl.origin;
}

export function buildPublicUrl(request: NextRequest, path: string): URL {
  return new URL(path, getPublicOrigin(request));
}
