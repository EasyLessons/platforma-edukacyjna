/**
 * use-yjs-local-cache.ts
 *
 * Lokalna kopia Y.Doc tablicy w IndexedDB: treść widoczna od razu przy powrocie na tablicę i edycja offline w trakcie sesji.
 * Rejestr, limity i sprzątanie: src/_new/lib/board-cache/board-cache.ts
 *
 * Provider Hocuspocus łączy się dopiero po `isReady`. Po wczytaniu wysyła tylko to czego serwer nie ma.
 *
 * `dirty` - lokalne zmiany jeszcze nie potwierdzone przez serwer. Ustawia je każda zmiana, której źródłem nie jest IndexedDB ani provider;
 * czyści wywołujący (setDirty(false)), gdy provider potwierdzi synchronizację.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  boardCacheName,
  clearBoardCache,
  evictBoardCaches,
  markBoardCacheDirty,
  touchBoardCache,
} from '@/_new/lib/board-cache/board-cache';
import { createLogger } from '@/_new/lib/logger';
import { getElementsMap } from './board-doc';

const log = createLogger('whiteboard/use-yjs-local-cache');

/** Bez odpowiedzi IndexedDB po tym czasie bez kopii lokalnej. */
export const LOCAL_CACHE_TIMEOUT_MS = 1_500;

export interface UseYjsLocalCacheOptions {
  doc: Y.Doc;
  boardId: string;
  userId: number | null;
}

export interface UseYjsLocalCacheResult {
  /** Kopia lokalna wczytana albo pominięta - można łączyć provider. */
  isReady: boolean;
  /** Kopia lokalna miała treść - można ją pokazać przed synchronizacją z serwerem. */
  hasLocalContent: boolean;
  /** Flaga niewysłanych zmian w rejestrze (true - nie usuwać przy limicie i wylogowaniu wymuszonym). */
  setDirty: (dirty: boolean) => void;
  /** Usuwa kopię tej tablicy (odebrany dostęp). */
  clear: () => void;
}

/** Cache tylko dla prawdziwych tablic zalogowanego użytkownika (bez demo). */
export function isCacheableBoard(boardId: string, userId: number | null): userId is number {
  return userId != null && boardId !== '' && !Number.isNaN(Number(boardId));
}

export function useYjsLocalCache({
  doc,
  boardId,
  userId,
}: UseYjsLocalCacheOptions): UseYjsLocalCacheResult {
  const cacheable = isCacheableBoard(boardId, userId);
  const [loaded, setLoaded] = useState(false);
  const [hasLocalContent, setHasLocalContent] = useState(false);

  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const nameRef = useRef<string | null>(null);
  const dirtyRef = useRef<boolean | null>(null);

  const setDirty = useCallback((dirty: boolean) => {
    const name = nameRef.current;
    if (!name || dirtyRef.current === dirty) return;
    dirtyRef.current = dirty;
    markBoardCacheDirty(name, dirty);
  }, []);

  useEffect(() => {
    if (!isCacheableBoard(boardId, userId)) return;

    const name = boardCacheName(userId, boardId);
    nameRef.current = name;
    dirtyRef.current = null;
    touchBoardCache(name);
    evictBoardCaches(name);

    const persistence = new IndexeddbPersistence(name, doc);
    persistenceRef.current = persistence;

    let settled = false;
    const finish = (fromCache: boolean) => {
      if (settled) return;
      settled = true;
      setHasLocalContent(fromCache && getElementsMap(doc).size > 0);
      setLoaded(true);
    };

    const timeout = setTimeout(() => {
      log.warn('IndexedDB nie odpowiada - tablica bez kopii lokalnej');
      finish(false);
    }, LOCAL_CACHE_TIMEOUT_MS);

    void persistence.whenSynced.then(() => {
      clearTimeout(timeout);
      finish(true);
    });

    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      // Wczytywanie z IndexedDB i zmiany z serwera to nie niewysłane zmiany.
      if (origin === persistence || origin instanceof HocuspocusProvider) return;
      setDirty(true);
    };
    doc.on('update', handleUpdate);

    return () => {
      clearTimeout(timeout);
      doc.off('update', handleUpdate);
      void persistence.destroy();
      persistenceRef.current = null;
      nameRef.current = null;
      setLoaded(false);
      setHasLocalContent(false);
    };
  }, [doc, boardId, userId, setDirty]);

  const clear = useCallback(() => {
    const persistence = persistenceRef.current;
    persistenceRef.current = null;
    // clearData zamyka bazę i ją usuwa; clearBoardCache sprząta rejestr (i ewentualne inne kopie tablicy).
    void (persistence ? persistence.clearData() : Promise.resolve()).finally(() =>
      clearBoardCache(boardId)
    );
  }, [boardId]);

  return { isReady: !cacheable || loaded, hasLocalContent, setDirty, clear };
}
