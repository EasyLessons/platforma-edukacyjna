/**
 * tokenService — logika JWT: dekodowanie, sprawdzanie ważności, refresh.
 *
 * Refresh token flow:
 *   1. Response interceptor w client.ts dostaje 401
 *   2. Woła tokenService.refresh()
 *   3. POST /api/v1/auth/refresh — przeglądarka wysyła HttpOnly cookie automatycznie
 *   4. Backend zwraca nowy access token
 *   5. tokenStore.setAccessToken(newToken)
 *   6. Interceptor ponawia oryginalny request
 *
 * Jeśli refresh się nie powiedzie (refresh token wygasł) → clearSession() + redirect.
 *
 */
import { getAccessToken, setAccessToken, clearSession } from './tokenStore';
import { RefreshUnavailableError } from './refresh-error';

interface JwtPayload {
  sub: string; // user_id
  exp: number; // Unix timestamp
  iat: number;
}

// DECODE

/**
 * Dekoduje payload JWT bez weryfikacji podpisu.
 * Weryfikacja podpisu dzieje się na backendzie — tu tylko czytamy dane.
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

// EXPIRY

const EXPIRY_BUFFER_SECONDS = 30;

/**
 * Sprawdza czy token wygasł (lub wygaśnie za mniej niż 30 sekund).
 * Buffer 30s zapobiega sytuacji gdzie token wygaśnie między sprawdzeniem a requestem.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp < nowInSeconds + EXPIRY_BUFFER_SECONDS;
}

export function getTokenUserId(token: string): number | null {
  const payload = decodeToken(token);
  if (!payload) return null;
  return parseInt(payload.sub, 10);
}

export function isCurrentTokenValid(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  return !isTokenExpired(token);
}

// REFRESH

let refreshPromise: Promise<string> | null = null;

/**
 * Odświeża access token używając refresh token z HttpOnly cookie.
 * Kolejkuje równoczesne requesty — tylko jeden refresh na raz.
 */
export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      let response: Response;
      try {
        response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include', // wysyła HttpOnly cookie
        });
      } catch {
        // Brak sieci / serwer nieosiągalny - sesja może być nadal ważna.
        throw new RefreshUnavailableError();
      }

      if (response.status >= 500 || response.status === 429) {
        // Błąd po stronie serwera albo limit żądań (429) - nie przesądza o sesji.
        throw new RefreshUnavailableError(`Refresh: HTTP ${response.status}`);
      }
      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      const newToken: string = data?.data?.access_token;

      if (!newToken) throw new Error('No token on refresh response');

      setAccessToken(newToken);
      return newToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Trasy wymagające zalogowania - ta sama lista co `matcher` w src/middleware.ts.
 * Tylko z nich wolno przekierować na /login po nieudanym odświeżeniu tokenu.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/whiteboard'];

/**
 * Ścieżka publiczna = każda poza chronionymi. AuthProvider (root layout) woła /auth/me na
 * KAŻDEJ stronie, więc dla gościa bez konta 401 jest stanem normalnym na landingu,
 * /register, /reset-password, /verify, /docs, stronach prawnych, /login i /demo - tam
 * nie przekierowujemy (wcześniej lista publicznych miała tylko /login, /rejestracja, /auth,
 * /demo i gość z landingu lądował na /login).
 *
 * UWAGA: tej funkcji używa też interceptor w lib/api/client.ts, żeby na tych
 * ścieżkach ODRZUCIĆ błąd zamiast zwracać promise, który nigdy się nie
 * rozwiązuje. Zmieniając ją, sprawdź oba miejsca.
 */
export function isPublicPath(pathname: string): boolean {
  return !PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Logout — czyści sesję i przekierowuje na /login.
 * Wywoływane gdy refresh się nie powiedzie lub token jest nieważny.
 */
export function logoutAndRedirect(): void {
  clearSession();
  if (typeof window !== 'undefined') {
    if (isPublicPath(window.location.pathname)) {
      return;
    }
    window.location.href = '/login';
  }
}
