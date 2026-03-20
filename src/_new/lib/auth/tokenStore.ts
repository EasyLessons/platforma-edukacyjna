/**
 * tokenStore — przechowywanie access tokenu.
 *
 * Access token: localStorage + cookie (dla middleware Next.js).
 * Refresh token: HttpOnly cookie — JS go nie widzi, przeglądarka wysyła automatycznie.
 *
 * Dlaczego dwa miejsca dla access tokenu?
 *   - localStorage: szybki dostęp z JS (Axios interceptor)
 *   - cookie: middleware Next.js (src/middleware.ts) sprawdza czy user jest zalogowany
 *     przed renderowaniem chronionych stron — nie ma dostępu do localStorage
 */

const ACCESS_TOKEN_KEY = 'access_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

// Access token

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  document.cookie = [
    `${ACCESS_TOKEN_KEY}=${token}`,
    'path=/',
    `max-age=${COOKIE_MAX_AGE}`,
    'SameSite=Strict',
  ].join('; ');
}

export function removeAccessToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  document.cookie = `${ACCESS_TOKEN_KEY}=; path=/; max-age=0`;
}

// User data
// Przechowuje podstawowe dane usera, żeby nie dekodować JWT przy każdym renderze

const USER_KEY = 'user';

export interface StoredUser {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeStoredUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
}

// Logout helper

/** Czyści dane sesji z localStorage i cookies */
export function clearSession(): void {
  removeAccessToken();
  removeStoredUser();
}
