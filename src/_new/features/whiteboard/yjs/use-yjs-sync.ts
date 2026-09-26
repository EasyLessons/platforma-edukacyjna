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
import { createLogger } from '@/_new/lib/logger';

const log = createLogger('whiteboard/use-yjs-sync');

const WHITEBOARD_SYNC_URL = process.env.NEXT_PUBLIC_WHITEBOARD_SYNC_URL ?? 'ws://localhost:1234';

export interface UseYjsSyncOptions {
  doc: Y.Doc;
  boardId: string;
  userId: number | null;
}

export interface UseYjsSyncResult {
  isConnected: boolean;
  hasSynced: boolean;
  authError: string | null;
}

export function useYjsSync({ doc, boardId, userId }: UseYjsSyncOptions): UseYjsSyncResult {
  const [isConnected, setIsConnected] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId || !userId) return;

    const provider = new HocuspocusProvider({
      url: WHITEBOARD_SYNC_URL,
      name: boardId,
      document: doc,
      token: () => getAccessToken() ?? '',
      onStatus: ({ status }) => setIsConnected(status === 'connected'),
      onSynced: ({ state }) => {
        if (state) setHasSynced(true);
      },
      onAuthenticationFailed: ({ reason }) => {
        log.error(`uwierzytelnianie nie powiodło się: ${reason}`);
        setAuthError(reason);
      },
    });

    return () => {
      provider.destroy();
      setIsConnected(false);
      setHasSynced(false);
      setAuthError(null);
    };
  }, [doc, boardId, userId]);

  return { isConnected, hasSynced, authError };
}
