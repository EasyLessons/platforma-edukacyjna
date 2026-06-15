import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { formatDate, sortBoards, normalizeColor, filterBoards } from './helpers';
import type { Board } from '../types';

// ─── normalizeColor ────────────────────────────────────────────────────────

describe('normalizeColor', () => {
  it('usuwa prefiks "bg-"', () => {
    expect(normalizeColor('bg-gray-500')).toBe('gray-500');
  });

  it('nie zmienia koloru bez prefiksu', () => {
    expect(normalizeColor('gray-500')).toBe('gray-500');
  });

  it('usuwa tylko jeden prefiks "bg-"', () => {
    expect(normalizeColor('bg-blue-300')).toBe('blue-300');
  });
});

// ─── formatDate ────────────────────────────────────────────────────────────

describe('formatDate', () => {
  const NOW = new Date('2024-06-15T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('null → "Nigdy"', () => {
    expect(formatDate(null)).toBe('Nigdy');
  });

  it('nieprawidłowy string → "Nieznana data"', () => {
    expect(formatDate('not-a-date')).toBe('Nieznana data');
  });

  it('< 1 minuta temu → "Teraz"', () => {
    const thirtySecondsAgo = new Date(NOW.getTime() - 30_000).toISOString();
    expect(formatDate(thirtySecondsAgo)).toBe('Teraz');
  });

  it('kilka minut temu → "X min temu"', () => {
    const fiveMinsAgo = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    expect(formatDate(fiveMinsAgo)).toBe('5 min temu');
  });

  it('kilka godzin temu → "X godz. temu"', () => {
    const threeHoursAgo = new Date(NOW.getTime() - 3 * 3600_000).toISOString();
    expect(formatDate(threeHoursAgo)).toBe('3 godz. temu');
  });

  it('dokładnie 1 dzień temu → "Wczoraj"', () => {
    const yesterday = new Date(NOW.getTime() - 26 * 3600_000).toISOString();
    expect(formatDate(yesterday)).toBe('Wczoraj');
  });

  it('kilka dni temu (< 7) → "X dni temu"', () => {
    const fourDaysAgo = new Date(NOW.getTime() - 4 * 24 * 3600_000).toISOString();
    expect(formatDate(fourDaysAgo)).toBe('4 dni temu');
  });

  it('>= 7 dni temu → data w formacie lokalnym', () => {
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 24 * 3600_000).toISOString();
    const result = formatDate(tenDaysAgo);
    // Powinien być to string z datą (nie jednym ze specjalnych komunikatów)
    expect(result).not.toBe('Nigdy');
    expect(result).not.toBe('Nieznana data');
    expect(result).not.toMatch(/temu/);
    expect(result).not.toBe('Wczoraj');
    expect(result).not.toBe('Teraz');
  });
});

// ─── sortBoards ────────────────────────────────────────────────────────────

function makeBoard(overrides: Partial<Board>): Board {
  return {
    id: 1,
    name: 'Board',
    icon: 'icon',
    bg_color: 'gray',
    workspace_id: 1,
    owner_id: 1,
    owner_username: 'user',
    is_favourite: false,
    settings: null,
    last_modified: new Date().toISOString(),
    last_modified_by: null,
    last_opened: null,
    created_at: new Date().toISOString(),
    created_by: 'user',
    ...overrides,
  };
}

describe('sortBoards', () => {
  describe('recent', () => {
    it('nowiej modyfikowane tablice są na górze', () => {
      const boards = [
        makeBoard({ id: 1, last_modified: '2024-01-01T00:00:00Z' }),
        makeBoard({ id: 2, last_modified: '2024-06-01T00:00:00Z' }),
        makeBoard({ id: 3, last_modified: '2024-03-01T00:00:00Z' }),
      ];
      const sorted = sortBoards(boards, 'recent');
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });

    it('tablica bez last_modified trafia na koniec', () => {
      const boards = [
        makeBoard({ id: 1, last_modified: null as unknown as string }),
        makeBoard({ id: 2, last_modified: '2024-06-01T00:00:00Z' }),
      ];
      const sorted = sortBoards(boards, 'recent');
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
    });
  });

  describe('name', () => {
    it('sortuje alfabetycznie', () => {
      const boards = [
        makeBoard({ id: 1, name: 'Zebra' }),
        makeBoard({ id: 2, name: 'Apple' }),
        makeBoard({ id: 3, name: 'Mango' }),
      ];
      const sorted = sortBoards(boards, 'name');
      expect(sorted.map(b => b.name)).toEqual(['Apple', 'Mango', 'Zebra']);
    });

    it('sortuje bez uwzględnienia wielkości liter', () => {
      const boards = [
        makeBoard({ id: 1, name: 'zebra' }),
        makeBoard({ id: 2, name: 'Apple' }),
      ];
      const sorted = sortBoards(boards, 'name');
      expect(sorted[0].name).toBe('Apple');
    });
  });

  describe('favourite', () => {
    it('ulubione tablice są przed nieulubionymi', () => {
      const boards = [
        makeBoard({ id: 1, is_favourite: false, last_modified: '2024-06-01T00:00:00Z' }),
        makeBoard({ id: 2, is_favourite: true, last_modified: '2024-01-01T00:00:00Z' }),
      ];
      const sorted = sortBoards(boards, 'favourite');
      expect(sorted[0].id).toBe(2); // ulubiona, mimo starszej daty
    });

    it('wśród ulubionych: nowiej modyfikowane na górze', () => {
      const boards = [
        makeBoard({ id: 1, is_favourite: true, last_modified: '2024-01-01T00:00:00Z' }),
        makeBoard({ id: 2, is_favourite: true, last_modified: '2024-06-01T00:00:00Z' }),
        makeBoard({ id: 3, is_favourite: false, last_modified: '2024-07-01T00:00:00Z' }),
      ];
      const sorted = sortBoards(boards, 'favourite');
      expect(sorted[0].id).toBe(2); // ulubiona, nowsza
      expect(sorted[1].id).toBe(1); // ulubiona, starsza
      expect(sorted[2].id).toBe(3); // nie ulubiona
    });
  });

  it('nie mutuje oryginalnej tablicy', () => {
    const boards = [
      makeBoard({ id: 1, name: 'B' }),
      makeBoard({ id: 2, name: 'A' }),
    ];
    const original = [...boards];
    sortBoards(boards, 'name');
    expect(boards[0].id).toBe(original[0].id);
  });
});

// ─── filterBoards ──────────────────────────────────────────────────────────

describe('filterBoards', () => {
  it('"all" zwraca wszystkie tablice', () => {
    const boards = [
      makeBoard({ owner_username: 'alice' }),
      makeBoard({ owner_username: 'bob' }),
    ];
    expect(filterBoards(boards, 'all', 'alice')).toHaveLength(2);
  });

  it('"mine" zwraca tylko tablice aktualnego użytkownika', () => {
    const boards = [
      makeBoard({ id: 1, owner_username: 'alice' }),
      makeBoard({ id: 2, owner_username: 'bob' }),
      makeBoard({ id: 3, owner_username: 'alice' }),
    ];
    const result = filterBoards(boards, 'mine', 'alice');
    expect(result).toHaveLength(2);
    expect(result.every(b => b.owner_username === 'alice')).toBe(true);
  });
});
