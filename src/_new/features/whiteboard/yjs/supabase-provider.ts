/**
 * supabase-provider.ts
 *
 * Transport Yjs prze Supabase Realitme Broadcast.
 * Dedykowany kanał `board:{boardId}:yjs` dla każdej tablicy.
 *
 * Protokół:
 *  - `yjs-update` — diff lokalnej zmiany (`doc.on('update')`), do wszystkich.
 *  - `yjs-sync-request` — raz po SUBSCRIBED, niesie lokalny state vector.
 *  - `yjs-sync-response` — odpowiedź na sync-request.
 */

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Y from 'yjs';
import { supabase } from '@/lib/supabase';
import { useSafeBroadcast } from '../realtime/useSafeBroadcast';
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  splitIntoChunks,
  createChunkCollector,
  type ChunkedPayload,
} from './codec';

/** Origin update'ów aplikowanych z sieci (zawsze inny niż lokalny `userId`) */
export const REMOTE_ORIGIN = Symbol('yjs-remote-origin');

/** ~110 KB surowych bajtów po dekodowaniu z base64 - margines pod limitem Supabase */
const YJS_CHUNK_CHARS = 150_000;

interface YjsUpdatePayload extends ChunkedPayload {
  userId: number;
}

interface YjsSyncResponsePayload extends ChunkedPayload {
  userId: number;
  targetUserId: number;
}

export interface UseSupabaseYjsProviderOptions {
  doc: Y.Doc;
  boardId: string;
  userId: number | null;
}

export interface UseSupabaseYjsProviderResult {
  isConnected: boolean;
}

export function useSupabaseYjsProvider({
  doc,
  boardId,
  userId,
}: UseSupabaseYjsProviderOptions): UseSupabaseYjsProviderResult {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const safeBroadcast = useSafeBroadcast(channelRef);

  useEffect(() => {
    if (!userId || !boardId) return;

    const updateCollector = createChunkCollector();
    const syncCollector = createChunkCollector();

    const channel = supabase.channel(`board:${boardId}:yjs`, {
      config: { broadcast: { self: false, ack: true } },
    });
    channelRef.current = channel;

    const sendChunked = (event: string, bytes: Uint8Array, extra: Record<string, unknown> = {}) => {
      const chunks = splitIntoChunks(uint8ArrayToBase64(bytes), YJS_CHUNK_CHARS);
      const transmissionId = crypto.randomUUID();
      chunks.forEach((data, chunkIndex) => {
        safeBroadcast(event, {
          transmissionId,
          userId,
          chunkIndex,
          totalChunks: chunks.length,
          data,
          ...extra,
        }).catch(() => {});
      });
    };

    channel
      .on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
        const p = payload as YjsUpdatePayload;
        if (p.userId === userId) return;
        const base64 = updateCollector.collect(p);
        if (base64) Y.applyUpdate(doc, base64ToUint8Array(base64), REMOTE_ORIGIN);
      })
      .on('broadcast', { event: 'yjs-sync-request' }, ({ payload }) => {
        const { userId: requesterId, stateVector } = payload as {
          userId: number;
          stateVector: string;
        };
        if (requesterId === userId) return;
        const diff = Y.encodeStateAsUpdate(doc, base64ToUint8Array(stateVector));
        sendChunked('yjs-sync-response', diff, { targetUserId: requesterId });
      })
      .on('broadcast', { event: 'yjs-sync-response' }, ({ payload }) => {
        const p = payload as YjsSyncResponsePayload;
        if (p.targetUserId !== userId) return;
        const base64 = syncCollector.collect(p);
        if (base64) Y.applyUpdate(doc, base64ToUint8Array(base64), REMOTE_ORIGIN);
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        safeBroadcast('yjs-sync-request', {
          userId,
          stateVector: uint8ArrayToBase64(Y.encodeStateVector(doc)),
        }).catch(() => {});
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false);
      }
    });

    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return;
      sendChunked('yjs-update', update);
    };
    doc.on('update', onDocUpdate);

    return () => {
      doc.off('update', onDocUpdate);
      channel.unsubscribe();
      channelRef.current = null;
      updateCollector.clear();
      syncCollector.clear();
      setIsConnected(false);
    };
  }, [doc, boardId, userId, safeBroadcast]);

  return { isConnected };
}
