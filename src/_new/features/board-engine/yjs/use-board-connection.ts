/**
 * use-board-connection.ts
 *
 * Y.Doc tablicy Excalidraw + transport: kopia lokalna (IndexedDB) i `whiteboard-sync`
 * (Hocuspocus, autoryzacja tokenem jak w starym silniku). Ten sam dokument co stary
 * silnik (nazwa = boardId); Excalidraw trzyma elementy pod własnymi kluczami root,
 * więc serwis i backend `/doc` zostają bez zmian.
 *
 * Dlaczego nie `useYjsSync` z features/whiteboard/yjs: tamten hook nie wystawia
 * providera, a kursory Excalidraw potrzebują jego `awareness`. Plik należy do strefy
 * Bartka, więc logika tokenu i ponowień jest tu powtórzona 1:1.
 * TODO(decyzja): po wystawieniu `provider`/`awareness` z `useYjsSync` usunąć duplikat.
 *
 * Tablica demo (`demo-...`) i brak zalogowanego użytkownika: tylko dokument lokalny,
 * bez serwera - whiteboard-sync wymaga tokenu i liczbowego id tablicy.
 *
 * Jeden dokument na cały cykl życia komponentu: przy zmianie tablicy wywołujący
 * montuje go od nowa (`key={boardId}`).
 */

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { getAccessToken } from '@/_new/lib/auth/tokenStore';
import { isTokenExpired, refreshAccessToken } from '@/_new/lib/auth/tokenService';
import { RefreshUnavailableError } from '@/_new/lib/auth/refresh-error';
import { createLogger } from '@/_new/lib/logger';
import { WHITEBOARD_SYNC_URL } from '@/_new/features/whiteboard/yjs/sync-url';
import { ACCESS_DENIED, SESSION_EXPIRED } from '@/_new/features/whiteboard/yjs/use-yjs-sync';
import { useYjsLocalCache } from '@/_new/features/whiteboard/yjs/use-yjs-local-cache';
import { ELEMENTS_KEY } from './excalidraw-binding';
import type { BoardAwareness } from './types';

const log = createLogger('board-engine/use-board-connection');

/** Odstępy kolejnych prób po przejściowej odmowie (jak w use-yjs-sync.ts). */
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];

export { ACCESS_DENIED, SESSION_EXPIRED };

export interface UseBoardConnectionOptions {
  boardId: string;
  /** Id zalogowanego użytkownika; null = gość / jeszcze ładuje się sesja. */
  userId: number | null;
}

export interface BoardConnection {
  doc: Y.Doc;
  /** Awareness połączenia z serwerem; null bez serwera (demo, gość). */
  awareness: BoardAwareness | null;
  /** Czy ta tablica w ogóle łączy się z serwerem. */
  isRemote: boolean;
  isConnected: boolean;
  /** Pierwsza pełna synchronizacja z serwerem w tej sesji. */
  hasSynced: boolean;
  /** Kopia lokalna (IndexedDB) miała elementy Excalidraw. */
  hasLocalContent: boolean;
  /** ACCESS_DENIED albo SESSION_EXPIRED - połączenie wstrzymane na stałe. */
  authError: string | null;
  /** Usuwa kopię lokalną tablicy (np. po odebraniu dostępu). */
  clearLocalCache: () => void;
}

/** Czy tablica synchronizuje się przez whiteboard-sync (zalogowany user + liczbowe id). */
export function isRemoteBoard(boardId: string, userId: number | null): boolean {
  return userId != null && boardId !== '' && !Number.isNaN(Number(boardId));
}

async function getFreshToken(): Promise<string> {
  const token = getAccessToken();
  if (token && !isTokenExpired(token)) return token;
  return refreshAccessToken();
}

export function useBoardConnection({
  boardId,
  userId,
}: UseBoardConnectionOptions): BoardConnection {
  // Bez doc.destroy() w cleanupie: StrictMode w dev montuje efekty dwa razy i drugi
  // przebieg dostałby zniszczony dokument. Provider i IndexedDB sprzątają swoje efekty.
  const [doc] = useState(() => new Y.Doc());

  const isRemote = isRemoteBoard(boardId, userId);
  const localCache = useYjsLocalCache({ doc, boardId, userId });

  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Provider dopiero po wczytaniu kopii lokalnej - serwer wysyła wtedy tylko różnicę.
  const { isReady, setDirty } = localCache;
  useEffect(() => {
    if (!isRemote || !isReady) return;

    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let sessionExpired = false;

    const next = new HocuspocusProvider({
      url: WHITEBOARD_SYNC_URL,
      name: boardId,
      document: doc,
      token: async () => {
        try {
          return await getFreshToken();
        } catch (err) {
          if (!(err instanceof RefreshUnavailableError)) sessionExpired = true;
          throw err;
        }
      },
      onStatus: ({ status }) => setIsConnected(status === 'connected'),
      onAuthenticated: () => {
        attempt = 0;
      },
      onSynced: ({ state }) => {
        if (!state) return;
        setHasSynced(true);
        if (!next.hasUnsyncedChanges) setDirty(false);
      },
      onAuthenticationFailed: ({ reason }) => {
        if (reason === ACCESS_DENIED || sessionExpired) {
          const error = reason === ACCESS_DENIED ? ACCESS_DENIED : SESSION_EXPIRED;
          log.error(`połączenie z tablicą wstrzymane: ${error}`);
          setAuthError(error);
          return;
        }
        // Hocuspocus po odmowie rozłącza się na stałe - ponawiamy ręcznie z opóźnieniem.
        const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        attempt++;
        log.warn(`połączenie odrzucone (${reason}), ponowienie za ${delay} ms`);
        retryTimer = setTimeout(() => void next.connect(), delay);
      },
    });

    // Serwer potwierdził wszystkie zmiany - kopia lokalna nie ma niewysłanych.
    const handleUnsynced = (count: number) => {
      if (count === 0 && next.isSynced) setDirty(false);
    };
    next.on('unsyncedChanges', handleUnsynced);
    setProvider(next);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      next.off('unsyncedChanges', handleUnsynced);
      next.destroy();
      setProvider(null);
      setIsConnected(false);
      setHasSynced(false);
      setAuthError(null);
    };
  }, [doc, boardId, isRemote, isReady, setDirty]);

  // Nie localCache.hasLocalContent - ten liczy mapę elementów starego silnika.
  const hasLocalContent = isReady && doc.getMap(ELEMENTS_KEY).size > 0;

  return {
    doc,
    awareness: provider?.awareness ?? null,
    isRemote,
    isConnected,
    hasSynced,
    hasLocalContent,
    authError,
    clearLocalCache: localCache.clear,
  };
}
