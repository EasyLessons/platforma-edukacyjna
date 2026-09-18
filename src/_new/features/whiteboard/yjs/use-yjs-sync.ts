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

const WHITEBOARD_SYNC_URL = process.env.NEXT_PUBLIC_WHITEBOARD_SYNC_URL ?? 'ws://localhost:1234';

export interface UseYjsSyncOptions {
  doc: Y.Doc;
  boardId: string;
  userId: number | null;
  enabled: boolean;
}

export interface UseYjsSyncResult {
  isConnected: boolean;
}

export function useYjsSync({ doc, boardId, userId, enabled }: UseYjsSyncOptions): UseYjsSyncResult {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !boardId || !userId) return;

    const provider = new HocuspocusProvider({
      url: WHITEBOARD_SYNC_URL,
      name: boardId,
      document: doc,
      token: () => getAccessToken() ?? '',
      onStatus: ({ status }) => setIsConnected(status === 'connected'),
      onAuthenticationFailed: ({ reason }) => {
        console.error(`[whiteboard-sync] uwierzytelnianie nie powiodło się: ${reason}`);
      },
    });

    return () => {
      provider.destroy();
      setIsConnected(false);
    };
  }, [doc, boardId, userId, enabled]);

  return { isConnected };
}
