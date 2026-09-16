/**
 * ============================================================================
 * guest-identity.ts - tozsamosc goscia w sesji demo
 * ============================================================================
 *
 * Gosc nie ma konta, a caly realtime (Broadcast + Presence) wymaga
 * `user_id: number` - patrz realtime/types.ts, gdzie to pole jest liczba
 * w KAZDYM ksztalcie wiadomosci.
 *
 * Dlatego gosc dostaje UJEMNE id. Prawdziwe id z bazy sa dodatnie, wiec
 * kolizja jest niemozliwa, a zaden typ ani payload nie wymaga zmiany.
 *
 * Tozsamosc trzymamy w sessionStorage (per karta):
 *  - odswiezenie strony NIE zmienia tozsamosci (kursor/nick zostaja te same),
 *  - druga karta = drugi gosc, wiec wspoldzielenie testuje sie samemu.
 *
 * sessionStorage bywa niedostepny (tryb prywatny, zablokowane dane witryny),
 * dlatego kazdy dostep jest w try/catch, a przy braku dostepu tozsamosc zyje
 * tylko w pamieci modulu - demo dziala dalej, po prostu nie przezyje F5.
 */

export interface GuestIdentity {
  id: number;
  username: string;
  isGuest: true;
}

const STORAGE_KEY = 'easylesson.demo.guest';

/** Fallback, gdy sessionStorage jest niedostepny. */
let inMemoryGuest: GuestIdentity | null = null;

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(out);
    return out;
  }
  // Srodowisko bez Web Crypto (bardzo stare przegladarki, SSR). Nie jest to
  // material kryptograficzny - to tylko nick i kolor kursora.
  for (let i = 0; i < length; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/** 4 znaki [A-Z0-9] do nicku, np. "Gosc-7K2P". */
function randomSuffix(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez I/O/0/1 - mylace
  const bytes = randomBytes(4);
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Ujemne id w zakresie -(1 .. 2^31-1). */
function randomGuestId(): number {
  const b = randomBytes(4);
  const raw = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  const positive = (raw % 2147483646) + 1; // 1 .. 2^31-2
  return -positive;
}

function readStored(): GuestIdentity | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestIdentity>;
    if (typeof parsed.id === 'number' && parsed.id < 0 && typeof parsed.username === 'string') {
      return { id: parsed.id, username: parsed.username, isGuest: true };
    }
    return null;
  } catch {
    return null;
  }
}

function writeStored(guest: GuestIdentity): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
  } catch {
    // Brak dostepu do sessionStorage - trudno, zostaje kopia w pamieci.
  }
}

/**
 * Zwraca tozsamosc goscia dla tej karty, tworzac ja przy pierwszym wywolaniu.
 * Wolac TYLKO po stronie klienta (w useEffect), zeby nie rozjechac hydracji:
 * serwer nie ma sessionStorage i wylosowalby inne id niz przegladarka.
 */
export function getOrCreateGuestIdentity(): GuestIdentity {
  if (inMemoryGuest) return inMemoryGuest;

  const stored = readStored();
  if (stored) {
    inMemoryGuest = stored;
    return stored;
  }

  const guest: GuestIdentity = {
    id: randomGuestId(),
    username: `Gosc-${randomSuffix()}`,
    isGuest: true,
  };
  inMemoryGuest = guest;
  writeStored(guest);
  return guest;
}

/**
 * Nowy identyfikator sesji demo: 22 znaki base64url ze 128 bitow losowosci.
 * Uzywane przez przycisk "Wyprobuj demo" na landingu - link nie do zgadniecia.
 */
export function createDemoSessionId(): string {
  const bytes = randomBytes(16);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
