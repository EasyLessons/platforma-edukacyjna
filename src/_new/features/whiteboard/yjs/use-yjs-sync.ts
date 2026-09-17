/**
 * use-yjs-sync.ts
 *
 * Spina snapshot (REST, `board-documents`) z live-transportem (`supabase-provider.ts`) dla tablicy Yjs.
 *
 * Pipeline:
 * - na starcie: `GET /doc` -> `Y.applyUpdate`
 * - `useSupabaseYjsProvider` — live sync przez Supabase Broadcast
 * - `doc.on('update')` → debounce ~5s → `POST /doc`
 */

import { useEffect } from 'react';
import * as Y from 'yjs';
import { useSupabaseYjsProvider, REMOTE_ORIGIN } from './supabase-provider';
import { uint8ArrayToBase64, base64ToUint8Array } from './codec';
import { getBoardDocument, saveBoardDocument } from '../api/whiteboardApi';
import { getAccessToken } from '@/_new/lib/auth/tokenStore';

const SAVE_DEBOUNCE_MS = 5000;

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
  // Snapshot na starcie
  useEffect(() => {
    if (!enabled || !boardId || !userId) return;
    const boardIdNum = parseInt(boardId);
    if (isNaN(boardIdNum)) return;

    let cancelled = false;
    getBoardDocument(boardIdNum)
      .then(({ snapshot }) => {
        if (cancelled || !snapshot) return;
        Y.applyUpdate(doc, base64ToUint8Array(snapshot), REMOTE_ORIGIN);
      })
      .catch((err) => console.error('Błąd ładowania snapshotu Y.Doc:', err));

    return () => {
      cancelled = true;
    };
  }, [doc, boardId, userId, enabled]);

  // Live transport
  const { isConnected } = useSupabaseYjsProvider({
    doc,
    boardId: enabled ? boardId : '',
    userId: enabled ? userId : null,
  });

  // Debounced zapis + flush na unload
  useEffect(() => {
    if (!enabled || !boardId || !userId) return;
    const boardIdNum = parseInt(boardId);
    if (isNaN(boardIdNum)) return;

    let saveTimeout: ReturnType<typeof setTimeout> | null = null;

    const doSave = () => {
      saveBoardDocument(boardIdNum, uint8ArrayToBase64(Y.encodeStateAsUpdate(doc))).catch(
        () => undefined
      );
    };

    const debouncedSave = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(doSave, SAVE_DEBOUNCE_MS);
    };

    // Ręczny fetch+keepalive - przy zamykaniu karty nie ma czasu na fetch w tle
    const flushSave = () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      const token = getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/whiteboard/${boardIdNum}/doc`;
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ snapshot: uint8ArrayToBase64(Y.encodeStateAsUpdate(doc)) }),
        keepalive: true,
      }).catch(() => undefined);
    };

    // Zapis zmian spowodowanych lokalnie
    const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return;
      debouncedSave();
    };
    doc.on('update', onDocUpdate);

    // Flush przy zmianie widoczności karty lub zamknięciu strony (pagehide)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushSave);

    return () => {
      doc.off('update', onDocUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushSave);
      if (saveTimeout) clearTimeout(saveTimeout);
    };
  }, [doc, boardId, userId, enabled]);

  return { isConnected };
}
