/**
 * MIDDLEWARE - OCHRONA TRAS
 * =========================
 *
 * Cel: Sprawdza czy użytkownik jest zalogowany przed wejściem na chronione strony
 *
 * Chronione trasy:
 * - /dashboard - wymaga logowania
 * - /tablica - wymaga logowania (normalny użytkownik) LUB tryb demo
 *
 * Logika:
 * - Sprawdza czy jest token w cookies
 * - Jeśli NIE → redirect do /login
 * - Jeśli TAK → przepuszcza
 *
 * Powiązane pliki:
 * - src/auth_api/api.ts (getToken, saveToken)
 * - src/app/login/page.tsx (zapisuje token)
 * - src/app/rejestracja/page.tsx (zapisuje token po weryfikacji)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Pobierz token z cookies lub localStorage (przez header)
  const token = request.cookies.get('access_token')?.value;

  const { pathname } = request.nextUrl;

  // Chronione trasy - wymagają logowania
  const protectedPaths = ['/dashboard', '/tablica'];
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  // Jeśli użytkownik próbuje wejść na chronioną trasę bez tokenu
  if (isProtectedPath && !token) {
    // Sprawdź czy to nie tryb demo dla tablicy
    const isDemoMode = request.cookies.get('demo_mode')?.value === 'true';

    if (pathname === '/tablica' && isDemoMode) {
      // Przepuść - tryb demo
      return NextResponse.next();
    }

    // Redirect do logowania
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

// Konfiguracja - na jakich ścieżkach middleware ma działać
export const config = {
  matcher: ['/dashboard/:path*', '/tablica/:path*'],
};
