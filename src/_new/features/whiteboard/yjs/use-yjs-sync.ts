/**
 * use-yjs-sync.ts
 *
 * Łączy Y.Doc tablicy z serwisem `whiteboard-sync` (Hocuspocus).
 * Odpowiada za synchronizację w czasie rzeczywistym między użytkownikami oraz perzystencję stanu tablicy w backendzie.
 *
 */

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { getAccessToken } from '@/_new/lib/auth/tokenStore';
import { isTokenExpired, refreshAccessToken } from '@/_new/lib/auth/tokenService';
import { RefreshUnavailableError } from '@/_new/lib/auth/refresh-error';
import { createLogger } from '@/_new/lib/logger';
import { WHITEBOARD_SYNC_URL } from './sync-url';

const log = createLogger('whiteboard/use-yjs-sync');

/** Odmowa dostępu z whiteboard-sync - połączenie wstrzymane na stałe. */
export const ACCESS_DENIED = 'access-denied';
/** Refresh tokenu odrzucony przez serwer - sesja nieważna, nie ponawiamy. */
export const SESSION_EXPIRED = 'session-expired';

/** Odstępy kolejnych próbpo przejściowej odmowie. */
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];

export interface UseYjsSyncOptions {
  doc: Y.Doc;
  boardId: string;
  userId: number | null;
  enabled?: boolean;
}

export interface UseYjsSyncResult {
  isConnected: boolean;
  /** Pierwsza pełna synchronizacja tej sesji. */
  hasSynced: boolean;
  /** Stan bieżący: synchronizowany z serwerem. */
  isSynced: boolean;
  /** Lokalne zmiany bez potwierdzenia serwera. */
  unsyncedChanges: number;
  /** ACCESS_DENIED albo SESSION_EXPIRED - połączenie wstrzymane na stałe. */
  authError: string | null;
}

/** Tojen dla WebSocketa - odświeżony, jeśli wygasł. */
async function getFreshToken(): Promise<string> {
  const token = getAccessToken();
  if (token && !isTokenExpired(token)) return token;
  return refreshAccessToken();
}

export function useYjsSync({
  doc,
  boardId,
  userId,
  enabled = true,
}: UseYjsSyncOptions): UseYjsSyncResult {
  const [isConnected, setIsConnected] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [unsyncedChanges, setUnsyncedChanges] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId || !userId || !enabled) return;

    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let sessionExpired = false;

    const provider = new HocuspocusProvider({
      url: WHITEBOARD_SYNC_URL,
      name: boardId,
      document: doc,
      token: async () => {
        try {
          return await getFreshToken();
        } catch (err) {
          // Odmowa refreshu - sesja nieważna
          if (!(err instanceof RefreshUnavailableError)) sessionExpired = true;
          throw err;
        }
      },
      onStatus: ({ status }) => setIsConnected(status === 'connected'),
      onAuthenticated: () => {
        attempt = 0;
      },
      onSynced: ({ state }) => {
        setIsSynced(state);
        if (state) setHasSynced(true);
      },
      onAuthenticationFailed: ({ reason }) => {
        if (reason === ACCESS_DENIED || sessionExpired) {
          const error = reason === ACCESS_DENIED ? ACCESS_DENIED : SESSION_EXPIRED;
          log.error(`połączenie z tablicą wstrzymane: ${error}`);
          setAuthError(error);
          return;
        }
        // Przejściowe: wygasły token albo serwer niedostępny.
        // Hocuspocus po odmowie rozłącza się na stałe, więc ręcznie ponawiamy próbę połączenia z opóźnieniem.
        const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        attempt++;
        log.warn(`połączenie odrzucone (${reason}), ponowienie za ${delay} ms`);
        retryTimer = setTimeout(() => void provider.connect(), delay);
      },
    });

    const handleUnsyncedChanges = (count: number) => setUnsyncedChanges(count);
    provider.on('unsyncedChanges', handleUnsyncedChanges);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      provider.off('unsyncedChanges', handleUnsyncedChanges);
      provider.destroy();
      setIsConnected(false);
      setHasSynced(false);
      setIsSynced(false);
      setUnsyncedChanges(0);
      setAuthError(null);
    };
  }, [doc, boardId, userId, enabled]);

  return { isConnected, hasSynced, isSynced, unsyncedChanges, authError };
}
