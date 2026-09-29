import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CACHE_TTL_MS,
  boardCacheName,
  touchBoardCache,
  markBoardCacheDirty,
  evictBoardCaches,
  getDirtyBoardCaches,
  clearBoardCache,
  clearAllBoardCaches,
  sweepForeignBoardCaches,
} from './board-cache';

const REGISTRY_KEY = 'easylesson-wb-cache-v1';
const NOW = 1_000_000_000_000;

const deleteDatabase = vi.fn(() => ({}) as IDBOpenDBRequest);
const databases = vi.fn(async (): Promise<IDBDatabaseInfo[]> => []);

function registry(): Record<string, { lastOpenedMs: number; dirty: boolean }> {
  return JSON.parse(localStorage.getItem(REGISTRY_KEY) ?? '{}');
}

beforeEach(() => {
  localStorage.clear();
  deleteDatabase.mockClear();
  databases.mockReset().mockResolvedValue([]);
  vi.stubGlobal('indexedDB', { deleteDatabase, databases });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('boardCacheName', () => {
  it('zawiera wersję, użytkownika i tablicę', () => {
    expect(boardCacheName(11, 159)).toBe('easylesson-wb-v1-u11-b159');
  });
});

describe('evictBoardCaches', () => {
  it('usuwa kopie starsze niż TTL, ale nie bieżącą', () => {
    const old = boardCacheName(1, 1);
    const current = boardCacheName(1, 2);
    touchBoardCache(old, NOW - CACHE_TTL_MS - 1);
    touchBoardCache(current, NOW - CACHE_TTL_MS - 1);

    const removed = evictBoardCaches(current, NOW);

    expect(removed).toEqual([old]);
    expect(deleteDatabase).toHaveBeenCalledWith(old);
    expect(Object.keys(registry())).toEqual([current]);
  });

  it('ponad limit 10 usuwa najdawniej otwierane, pomijając dirty', () => {
    const names = Array.from({ length: 12 }, (_, i) => boardCacheName(1, i + 1));
    names.forEach((name, i) => touchBoardCache(name, NOW - (12 - i) * 1000)); // b1 najstarsza, b12 najnowsza
    markBoardCacheDirty(names[0], true); // b1: niewysłane zmiany

    const removed = evictBoardCaches(names[11], NOW);

    expect(removed.sort()).toEqual([names[1], names[2]].sort()); // b2, b3 - najstarsze czyste
    expect(Object.keys(registry())).toHaveLength(10);
    expect(registry()[names[0]].dirty).toBe(true);
  });

  it('dirty nie wygasa po TTL', () => {
    const name = boardCacheName(1, 1);
    touchBoardCache(name, NOW - CACHE_TTL_MS - 1);
    markBoardCacheDirty(name, true);

    expect(evictBoardCaches(boardCacheName(1, 2), NOW)).toEqual([]);
  });
});

describe('getDirtyBoardCaches', () => {
  it('zwraca tylko kopie dirty danego użytkownika', () => {
    touchBoardCache(boardCacheName(1, 1));
    touchBoardCache(boardCacheName(1, 2));
    touchBoardCache(boardCacheName(2, 3));
    markBoardCacheDirty(boardCacheName(1, 2), true);
    markBoardCacheDirty(boardCacheName(2, 3), true);

    expect(getDirtyBoardCaches(1)).toEqual([boardCacheName(1, 2)]);
  });
});

describe('clearAllBoardCaches', () => {
  it('keepDirty: true zostawia kopie z niewysłanymi zmianami', () => {
    touchBoardCache(boardCacheName(1, 1));
    touchBoardCache(boardCacheName(1, 2));
    markBoardCacheDirty(boardCacheName(1, 2), true);

    clearAllBoardCaches({ keepDirty: true });

    expect(Object.keys(registry())).toEqual([boardCacheName(1, 2)]);
    expect(deleteDatabase).toHaveBeenCalledWith(boardCacheName(1, 1));
    expect(deleteDatabase).not.toHaveBeenCalledWith(boardCacheName(1, 2));
  });

  it('keepDirty: false usuwa wszystko, także bazy spoza rejestru', async () => {
    touchBoardCache(boardCacheName(1, 1));
    markBoardCacheDirty(boardCacheName(1, 1), true);
    databases.mockResolvedValue([
      { name: boardCacheName(1, 9), version: 1 },
      { name: 'inna-baza', version: 1 },
    ]);

    clearAllBoardCaches({ keepDirty: false });

    expect(registry()).toEqual({});
    expect(deleteDatabase).toHaveBeenCalledWith(boardCacheName(1, 1));
    await vi.waitFor(() => expect(deleteDatabase).toHaveBeenCalledWith(boardCacheName(1, 9)));
    expect(deleteDatabase).not.toHaveBeenCalledWith('inna-baza');
  });
});

describe('clearBoardCache', () => {
  it('usuwa kopie tablicy wszystkich użytkowników, inne zostają', () => {
    touchBoardCache(boardCacheName(1, 5));
    touchBoardCache(boardCacheName(2, 5));
    touchBoardCache(boardCacheName(1, 6));

    clearBoardCache(5);

    expect(Object.keys(registry())).toEqual([boardCacheName(1, 6)]);
  });
});

describe('sweepForeignBoardCaches', () => {
  it('usuwa kopie innych użytkowników (także dirty) i starych wersji', async () => {
    touchBoardCache(boardCacheName(1, 1));
    touchBoardCache(boardCacheName(2, 1));
    markBoardCacheDirty(boardCacheName(2, 1), true);
    localStorage.setItem('easylesson-wb-cache-v0', '{}');
    databases.mockResolvedValue([{ name: 'easylesson-wb-v0-u1-b1', version: 1 }]);

    sweepForeignBoardCaches(1);

    expect(Object.keys(registry())).toEqual([boardCacheName(1, 1)]);
    expect(deleteDatabase).toHaveBeenCalledWith(boardCacheName(2, 1));
    expect(localStorage.getItem('easylesson-wb-cache-v0')).toBeNull();
    await vi.waitFor(() => expect(deleteDatabase).toHaveBeenCalledWith('easylesson-wb-v0-u1-b1'));
  });
});

describe('odporność na brak pamięci', () => {
  it('błąd zapisu do localStorage nie wyrzuca wyjątku', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => touchBoardCache(boardCacheName(1, 1))).not.toThrow();
    expect(() => clearAllBoardCaches({ keepDirty: false })).not.toThrow();

    vi.mocked(Storage.prototype.setItem).mockRestore();
  });
});
