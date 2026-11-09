/**
 * MIDDLEWARE - OCHRONA TRAS
 * =========================
 *
 * Cel: Sprawdza czy użytkownik jest zalogowany przed wejściem na chronione strony
 *
 * Chronione trasy:
 * - /dashboard - wymaga logowania
 * - /whiteboard - wymaga logowania (tablica demo bez konta jest pod /demo/*, poza matcherem)
 *
 * Logika:
 * - Sprawdza czy jest token w cookies
 * - Jeśli NIE → redirect do /login
 * - Jeśli TAK → przepuszcza
 *
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('refresh_token')?.value;

  const { pathname } = request.nextUrl;

  // Chronione trasy - wymagają logowania
  const protectedPaths = ['/dashboard', '/whiteboard'];
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  // Jeśli użytkownik próbuje wejść na chronioną trasę bez tokenu - redirect do logowania
  if (isProtectedPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

// Konfiguracja - na jakich ścieżkach middleware ma działać
export const config = {
  matcher: ['/dashboard/:path*', '/whiteboard/:path*'],
};
