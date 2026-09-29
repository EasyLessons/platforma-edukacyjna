import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as Y from 'yjs';

type FakePersistence = {
  name: string;
  resolveSynced: () => void;
  whenSynced: Promise<unknown>;
  destroy: ReturnType<typeof vi.fn>;
  clearData: ReturnType<typeof vi.fn>;
};

const { persistences } = vi.hoisted(() => ({ persistences: [] as FakePersistence[] }));

vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: class {
    name: string;
    resolveSynced: () => void = () => undefined;
    whenSynced: Promise<unknown>;
    destroy = vi.fn(() => Promise.resolve());
    clearData = vi.fn(() => Promise.resolve());
    constructor(name: string) {
      this.name = name;
      this.whenSynced = new Promise((resolve) => {
        this.resolveSynced = () => resolve(this);
      });
      persistences.push(this as unknown as FakePersistence);
    }
  },
}));

vi.mock('@hocuspocus/provider', () => ({ HocuspocusProvider: class {} }));

vi.mock('@/_new/lib/board-cache/board-cache', () => ({
  boardCacheName: (userId: number, boardId: string) => `easylesson-wb-v1-u${userId}-b${boardId}`,
  touchBoardCache: vi.fn(),
  evictBoardCaches: vi.fn(() => []),
  markBoardCacheDirty: vi.fn(),
  clearBoardCache: vi.fn(),
}));

import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  touchBoardCache,
  evictBoardCaches,
  markBoardCacheDirty,
  clearBoardCache,
} from '@/_new/lib/board-cache/board-cache';
import { getElementsMap } from './board-doc';
import { useYjsLocalCache, LOCAL_CACHE_TIMEOUT_MS } from './use-yjs-local-cache';

const NAME = 'easylesson-wb-v1-u11-b159';

function render(boardId = '159', userId: number | null = 11) {
  const doc = new Y.Doc();
  const hook = renderHook(() => useYjsLocalCache({ doc, boardId, userId }));
  return { doc, ...hook };
}

/** Symulacja wczytania kopii z IndexedDB: element dodany z origin = persistence, potem "synced". */
async function loadFromCache(doc: Y.Doc, withContent: boolean) {
  const persistence = persistences[0];
  if (withContent) {
    doc.transact(() => getElementsMap(doc).set('a', new Y.Map()), persistence);
  }
  await act(async () => persistence.resolveSynced());
}

beforeEach(() => {
  persistences.length = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useYjsLocalCache - kiedy działa', () => {
  it('tablica demo: od razu gotowe, bez IndexedDB', () => {
    const { result } = render('demo-abc');

    expect(result.current.isReady).toBe(true);
    expect(persistences).toHaveLength(0);
    expect(touchBoardCache).not.toHaveBeenCalled();
  });

  it('bez zalogowanego użytkownika: od razu gotowe, bez IndexedDB', () => {
    const { result } = render('159', null);

    expect(result.current.isReady).toBe(true);
    expect(persistences).toHaveLength(0);
  });

  it('prawdziwa tablica: rejestr + sprzątanie, gotowe dopiero po wczytaniu kopii', async () => {
    const { doc, result } = render();

    expect(result.current.isReady).toBe(false);
    expect(persistences[0].name).toBe(NAME);
    expect(touchBoardCache).toHaveBeenCalledWith(NAME);
    expect(evictBoardCaches).toHaveBeenCalledWith(NAME);

    await loadFromCache(doc, true);

    expect(result.current.isReady).toBe(true);
    expect(result.current.hasLocalContent).toBe(true);
  });

  it('pusta kopia (pierwsze wejście): gotowe, bez treści', async () => {
    const { doc, result } = render();

    await loadFromCache(doc, false);

    expect(result.current.isReady).toBe(true);
    expect(result.current.hasLocalContent).toBe(false);
  });

  it('IndexedDB nie odpowiada: po timeoucie gotowe bez kopii', () => {
    vi.useFakeTimers();
    const { result } = render();

    act(() => vi.advanceTimersByTime(LOCAL_CACHE_TIMEOUT_MS));

    expect(result.current.isReady).toBe(true);
    expect(result.current.hasLocalContent).toBe(false);
  });
});

describe('useYjsLocalCache - niewysłane zmiany (dirty)', () => {
  it('edycja lokalna oznacza dirty raz, mimo wielu zmian', async () => {
    const { doc } = render();
    await loadFromCache(doc, false);

    doc.transact(() => getElementsMap(doc).set('x', new Y.Map()), 11);
    doc.transact(() => getElementsMap(doc).set('y', new Y.Map()), 11);

    expect(markBoardCacheDirty).toHaveBeenCalledTimes(1);
    expect(markBoardCacheDirty).toHaveBeenCalledWith(NAME, true);
  });

  it('zmiany z IndexedDB i z serwera nie oznaczają dirty', async () => {
    const { doc } = render();
    await loadFromCache(doc, true);

    const provider = new HocuspocusProvider({} as never);
    doc.transact(() => getElementsMap(doc).set('remote', new Y.Map()), provider);

    expect(markBoardCacheDirty).not.toHaveBeenCalled();
  });

  it('setDirty(false) zapisuje stan także na starcie sesji (poprzednia mogła zostawić dirty)', async () => {
    const { doc, result } = render();
    await loadFromCache(doc, false);

    act(() => result.current.setDirty(false));

    expect(markBoardCacheDirty).toHaveBeenCalledWith(NAME, false);
  });
});

describe('useYjsLocalCache - czyszczenie', () => {
  it('clear() usuwa bazę tablicy i wpis w rejestrze', async () => {
    const { doc, result } = render();
    await loadFromCache(doc, true);

    act(() => result.current.clear());

    expect(persistences[0].clearData).toHaveBeenCalled();
    await waitFor(() => expect(clearBoardCache).toHaveBeenCalledWith('159'));
  });

  it('odmontowanie zamyka bazę (bez usuwania)', () => {
    const { unmount } = render();

    unmount();

    expect(persistences[0].destroy).toHaveBeenCalled();
    expect(persistences[0].clearData).not.toHaveBeenCalled();
  });
});
