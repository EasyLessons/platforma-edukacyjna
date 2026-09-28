/**
 * board-cache.ts
 *
 * Rejestr lokalnych kopii tablic (IndexedDB) i ich sprzątanie.
 *
 * - jedna baza na (użytkownik, tablica): `easylesson-wb-v{CACHE_VERSION}-u{userId}-b{boardId}`.
 * - rejestr w localStorage trzyma tylko nazwy baz, czas otwarcia i flagę `dirty` (lokalne zmiany nie potwierdzone przez serwer) - bez treści.
 * - limity: `MAX_CACHED_BOARDS` i `CACHE_TTL_MS`. Nigdy nie jest usuwana bieżąca tablica i `dirty`.
 * - CACHE_VERSION to awaryjny wyłącznik: podbicie + deploy = wszystkie stare kopie zostaną usunięte.
 */
import { createLogger } from '@/_new/lib/logger';

const log = createLogger('lib/board-cache');

export const CACHE_VERSION = 1;
export const MAX_CACHED_BOARDS = 10;
export const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const DB_PREFIX = 'easylesson-wb-';
const REGISTRY_PREFIX = 'easylesson-wb-cache-v';
const REGISTRY_KEY = `${REGISTRY_PREFIX}${CACHE_VERSION}`;
const NAME_RE = /^easylesson-wb-v(\d+)-u(\d+)-b(.+)$/;

export interface BoardCacheEntry {
  lastOpenedMs: number;
  dirty: boolean;
}

type Registry = Record<string, BoardCacheEntry>;

interface ParsedName {
  version: number;
  userId: number;
  boardId: string;
}

export function boardCacheName(userId: number, boardId: number | string): string {
  return `${DB_PREFIX}v${CACHE_VERSION}-u${userId}-b${boardId}`;
}

function parseName(name: string): ParsedName | null {
  const match = NAME_RE.exec(name);
  return match ? { version: Number(match[1]), userId: Number(match[2]), boardId: match[3] } : null;
}

function readRegistry(): Registry {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Registry) : {};
  } catch {
    return {};
  }
}

function writeRegistry(registry: Registry): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // Tryb prywatny / pełna pamięć - kopie działają dalej, tylko bez limitów rejestru.
  }
}

function deleteDatabase(name: string): void {
  try {
    const request = indexedDB.deleteDatabase(name);
    request.onblocked = () =>
      log.warn(`usunięcie ${name} czeka na zamknięcie innej karty z tą tablicą`);
  } catch {
    // Brak IndexedDb - nie ma czego usuwać.
  }
}

function removeEntries(names: string[]): void {
  if (names.length === 0) return;
  const registry = readRegistry();
  for (const name of names) {
    delete registry[name];
    deleteDatabase(name);
  }
  writeRegistry(registry);
}

/** Usuwa bazy z prefiksem, których nie ma w rejestrze (rozjechany rejestr). */
async function sweepDatabases(shouldDelete: (name: string) => boolean): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return;
    const databases = await indexedDB.databases();
    for (const { name } of databases) {
      if (name?.startsWith(DB_PREFIX) && shouldDelete(name)) deleteDatabase(name);
    }
  } catch {
    // Najwyżej zostanie baza, której rejestr nie znał - usunie ją kolejne sprzątanie.
  }
}

/** Zapisuje czas otwarcia tablicy (wołane przy każdym wejściu). */
export function touchBoardCache(name: string, now = Date.now()): void {
  const registry = readRegistry();
  registry[name] = { lastOpenedMs: now, dirty: registry[name]?.dirty ?? false };
  writeRegistry(registry);
}

/** Flaga lokalnych zmian niepotwierdzonych przez serwer. */
export function markBoardCacheDirty(name: string, dirty: boolean): void {
  const registry = readRegistry();
  const entry = registry[name];
  if (!entry || entry.dirty === dirty) return;
  registry[name] = { ...entry, dirty };
  writeRegistry(registry);
}

/**
 * Usuwa kopie starsze niż CACHE_TTL_MS i ponad MAX_CACHED_BOARDS.
 * Nie rusza bieżącej tablicy ani tablic `dirty`.
 */
export function evictBoardCaches(currentName: string, now = Date.now()): string[] {
  const registry = readRegistry();
  const candidates = Object.entries(registry).filter(
    ([name, entry]) => name !== currentName && !entry.dirty
  );

  const expired = candidates
    .filter(([, entry]) => now - entry.lastOpenedMs > CACHE_TTL_MS)
    .map(([name]) => name);

  const overLimit = Object.keys(registry).length - expired.length - MAX_CACHED_BOARDS;
  const leastRecent =
    overLimit > 0
      ? candidates
          .filter(([name]) => !expired.includes(name))
          .sort(([, a], [, b]) => b.lastOpenedMs - a.lastOpenedMs)
          .slice(-overLimit)
          .map(([name]) => name)
      : [];

  const removed = [...expired, ...leastRecent];
  removeEntries(removed);
  return removed;
}

/** Nazwy baz użytkownika z niewysłanymi zmianami (ostrzeżenie przy wylogowaniu). */
export function getDirtyBoardCaches(userId: number): string[] {
  return Object.entries(readRegistry())
    .filter(([name, entry]) => entry.dirty && parseName(name)?.userId === userId)
    .map(([name]) => name);
}

/** Utrata dostępu / usunięta tablica: usuwa kopie tej tablicy wszystkich użytkowników. */
export function clearBoardCache(boardId: number | string): void {
  const isThisBoard = (name: string) => parseName(name)?.boardId === String(boardId);

  removeEntries(Object.keys(readRegistry()).filter(isThisBoard));
  void sweepDatabases(isThisBoard);
}

/** Wylogowanie. */
export function clearAllBoardCaches({ keepDirty }: { keepDirty: boolean }): void {
  const registry = readRegistry();
  const shouldDelete = (name: string) => !(keepDirty && registry[name]?.dirty === true);
  removeEntries(Object.keys(registry).filter(shouldDelete));
  void sweepDatabases(shouldDelete);
}

/** Po zalogowaniu: usuwa kopie innych użytkowników (także dirty) i starych wersji cache. */
export function sweepForeignBoardCaches(currentUserId: number): void {
  const isForeign = (name: string) => {
    const parsed = parseName(name);
    return !parsed || parsed.userId !== currentUserId || parsed.version !== CACHE_VERSION;
  };

  removeEntries(Object.keys(readRegistry()).filter(isForeign));
  void sweepDatabases(isForeign);

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(REGISTRY_PREFIX) && key !== REGISTRY_KEY) localStorage.removeItem(key);
    }
  } catch {
    // Brak localStorage - nie ma starych rejestrów.
  }
}
