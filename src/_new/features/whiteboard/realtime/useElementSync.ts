/**
 * useElementSync — rysowanie (elementy tablicy) + dogrywanie całej tablicy
 * nowemu userowi ("sync").
 *
 * Krok 5 wydzielania `BoardRealtimeContext` (patrz docs/migration-status.md) —
 * ostatni kawałek stanu/logiki, jaki tamten plik jeszcze trzymał sam. Po tym
 * kroku `BoardRealtimeContext.tsx` tylko SPINA hooki z kanałem Supabase
 * (Krok 6 dokończy to spięcie i skróci go do minimum).
 *
 * DWIE ODPOWIEDZIALNOŚCI W JEDNYM HOOKU (celowo, nie przez zaniedbanie):
 * 1. Broadcast/odbiór pojedynczych zmian elementów (`element-created/updated/
 *    deleted`, `elements-batch`) — to, co się dzieje przy zwykłym rysowaniu.
 * 2. `sync-request`/`sync-response` — "dogranie" całej tablicy nowemu
 *    userowi przez innego, już podłączonego (host election: odpowiada tylko
 *    user z najniższym ID spośród obecnych, żeby nie zasypać nowego 10
 *    odpowiedziami naraz).
 * Są w jednym pliku, bo obie operują na tych samych typach (`DrawingElement`/
 * `ElementBroadcastPayload`) i tej samej funkcji `stripHeavyFields` — rozbijanie
 * ich na dwa osobne hooki dodałoby więcej kosztu (przekazywanie stanu między
 * nimi) niż zysku (nie są używane osobno nigdzie indziej).
 */

import { useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { DrawingElement } from '@/_new/features/whiteboard/types';
import type { ElementBroadcastPayload } from './types';
import { THROTTLE_MS, SYNC_CHUNK_SIZE, SYNC_CHUNK_DELAY_MS } from './constants';
import { log, logWarn } from './logger';

/**
 * 🛠️ FIX (known-issues.md #2, Opcja B): usuwa z elementu pola, które są
 * "ciężkie" i praktycznie NIGDY nie zmieniają się po utworzeniu elementu —
 * na razie tylko `src` u zdjęć (base64/URL, potrafi mieć setki KB jako
 * base64 — dziś już tylko URL po Opcji C, ale funkcja i tak nie zaszkodzi).
 * Używane TYLKO przy `element-updated`/`elements-batch` (update geometrii),
 * NIGDY przy `element-created` (tam `src` musi dojść, bo odbiorca nie ma go
 * jeszcze wcale).
 */
function stripHeavyFields(element: DrawingElement): ElementBroadcastPayload {
  if (element.type === 'image') {
    const { src, ...rest } = element;
    return rest;
  }
  return element;
}

export interface UseElementSyncOptions {
  user: { id: number; username: string } | null;
  safeBroadcast: (event: string, payload: unknown) => Promise<boolean>;
}

export interface UseElementSyncResult {
  // ── Broadcast (wysyłanie) ──────────────────────────────────────────────
  broadcastElementCreated: (element: DrawingElement) => Promise<void>;
  broadcastElementUpdated: (element: DrawingElement) => Promise<void>;
  broadcastElementDeleted: (elementId: string) => Promise<void>;
  broadcastElementsBatch: (elements: DrawingElement[], geometryOnly?: boolean) => Promise<void>;
  broadcastSyncRequest: () => Promise<void>;
  broadcastSyncResponse: (elements: DrawingElement[], targetUserId: number) => Promise<void>;

  // ── Rejestracja handlerów (dla komponentów, przez useBoardRealtime()) ──
  onRemoteElementCreated: (
    handler: (element: DrawingElement, userId: number, username: string) => void
  ) => void;
  onRemoteElementUpdated: (
    handler: (element: ElementBroadcastPayload, userId: number, username: string) => void
  ) => void;
  onRemoteElementDeleted: (
    handler: (elementId: string, userId: number, username: string) => void
  ) => void;
  onRemoteElementsBatch: (
    handler: (
      elements: ElementBroadcastPayload[],
      userId: number,
      username: string,
      geometryOnly: boolean
    ) => void
  ) => void;
  onRemoteSyncRequest: (handler: (userId: number, username: string) => void) => void;
  onRemoteSyncResponse: (
    handler: (elements: DrawingElement[], userId: number, username: string) => void
  ) => void;

  // ── Woła się z `channel.on(...)` w Providerze (jedyne miejsce z dostępem
  // do samego kanału) ────────────────────────────────────────────────────
  handleElementCreated: (element: DrawingElement, userId: number, username: string) => void;
  handleElementUpdated: (
    element: ElementBroadcastPayload,
    userId: number,
    username: string
  ) => void;
  handleElementDeleted: (elementId: string, userId: number, username: string) => void;
  handleElementsBatch: (
    elements: ElementBroadcastPayload[],
    userId: number,
    username: string,
    geometryOnly: boolean
  ) => void;
  /** Host election (najniższe ID spośród obecnych odpowiada) — potrzebuje `channel.presenceState()`. */
  handleSyncRequest: (
    channel: RealtimeChannel,
    currentUserId: number,
    userId: number,
    username: string
  ) => void;
  /** Składanie paczek `sync-response` w komplet — patrz `SYNC_CHUNK_SIZE`. */
  handleSyncResponse: (
    currentUserId: number,
    targetUserId: number,
    elements: DrawingElement[],
    userId: number,
    username: string,
    chunkIndex: number,
    totalChunks: number
  ) => void;

  /** Sprzątanie przy rozłączaniu kanału (czyści pending trailing-throttle timeout). */
  reset: () => void;
}

export function useElementSync({ user, safeBroadcast }: UseElementSyncOptions): UseElementSyncResult {
  // 🛡️ TRAILING THROTTLE dla element-updated — przechowuj ostatnią wartość
  // do wysłania, jeśli throttle window jeszcze nie minął.
  const lastElementUpdateBroadcastRef = useRef(0);
  const pendingElementUpdateRef = useRef<DrawingElement | null>(null);
  const pendingElementUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handlery zarejestrowane przez komponenty (refs żeby uniknąć re-renderów)
  const elementCreatedHandlerRef = useRef<
    ((element: DrawingElement, userId: number, username: string) => void) | null
  >(null);
  const elementUpdatedHandlerRef = useRef<
    ((element: ElementBroadcastPayload, userId: number, username: string) => void) | null
  >(null);
  const elementDeletedHandlerRef = useRef<
    ((elementId: string, userId: number, username: string) => void) | null
  >(null);
  const elementsBatchHandlerRef = useRef<
    ((elements: ElementBroadcastPayload[], userId: number, username: string, geometryOnly: boolean) => void) | null
  >(null);
  const syncRequestHandlerRef = useRef<((userId: number, username: string) => void) | null>(null);
  const syncResponseHandlerRef = useRef<
    ((elements: DrawingElement[], userId: number, username: string) => void) | null
  >(null);
  // Bufor składania chunków sync-response od jednego sendera
  const syncChunkBufferRef = useRef<{
    chunks: DrawingElement[][];
    totalChunks: number;
    fromUserId: number;
  } | null>(null);

  // ── Broadcast ────────────────────────────────────────────────────────

  const broadcastElementCreated = useCallback(
    async (element: DrawingElement) => {
      if (!user) return;

      log(`📤 [BROADCAST] Wysyłam element-created: ${element.id} (typ: ${element.type})`);

      const success = await safeBroadcast('element-created', {
        element,
        userId: user.id,
        username: user.username,
      });

      if (!success) {
        logWarn(`📤 [BROADCAST] ❌ Nie udało się wysłać element-created: ${element.id}`);
      }
    },
    [user, safeBroadcast]
  );

  const broadcastElementUpdated = useCallback(
    async (element: DrawingElement) => {
      if (!user) return;

      const now = Date.now();
      const timeSinceLastBroadcast = now - lastElementUpdateBroadcastRef.current;

      // 🛡️ TRAILING THROTTLE: zawsze zapisz ostatnią wartość (pełną — do historii/
      // ewentualnego przyszłego użycia lokalnie; ucinamy dopiero PRZED wysyłką).
      pendingElementUpdateRef.current = element;

      // Jeśli możemy wysłać od razu (minął throttle window)
      if (timeSinceLastBroadcast >= THROTTLE_MS.ELEMENT_UPDATE) {
        // Wyczyść pending timeout jeśli istnieje
        if (pendingElementUpdateTimeoutRef.current) {
          clearTimeout(pendingElementUpdateTimeoutRef.current);
          pendingElementUpdateTimeoutRef.current = null;
        }

        lastElementUpdateBroadcastRef.current = now;
        pendingElementUpdateRef.current = null;

        await safeBroadcast('element-updated', {
          // 🛠️ FIX (known-issues.md #2, Opcja B): bez `src` dla zdjęć —
          // odbiorca ma je już z element-created, więc tu leci tylko geometria.
          element: stripHeavyFields(element),
          userId: user.id,
          username: user.username,
        });
      } else {
        // 🛡️ TRAILING: zaplanuj wysłanie ostatniej wartości po throttle window
        if (!pendingElementUpdateTimeoutRef.current) {
          const remainingTime = THROTTLE_MS.ELEMENT_UPDATE - timeSinceLastBroadcast;

          pendingElementUpdateTimeoutRef.current = setTimeout(async () => {
            const pendingElement = pendingElementUpdateRef.current;
            pendingElementUpdateTimeoutRef.current = null;
            pendingElementUpdateRef.current = null;

            if (pendingElement && user) {
              lastElementUpdateBroadcastRef.current = Date.now();

              await safeBroadcast('element-updated', {
                element: stripHeavyFields(pendingElement),
                userId: user.id,
                username: user.username,
              });
            }
          }, remainingTime);
        }
      }
    },
    [user, safeBroadcast]
  );

  const broadcastElementDeleted = useCallback(
    async (elementId: string) => {
      if (!user) return;

      await safeBroadcast('element-deleted', {
        elementId,
        userId: user.id,
        username: user.username,
      });
    },
    [user, safeBroadcast]
  );

  const broadcastElementsBatch = useCallback(
    async (elements: DrawingElement[], geometryOnly: boolean = false) => {
      if (!user) return;

      // 🛠️ FIX (known-issues.md #2, Opcja B): ta funkcja obsługuje DWIE różne
      // sytuacje. Tworzenie kilku elementów naraz (`geometryOnly=false`,
      // domyślne) — odbiorca ich jeszcze nie ma, więc leci pełny obiekt,
      // łącznie z `src` dla zdjęć. Live przeciąganie WIELU już istniejących
      // elementów (`geometryOnly=true`, wołane z updateElementsLive w
      // use-whiteboard-engine.ts) — odbiorca już je ma, więc leci tylko
      // geometria, bez `src`.
      const payloadElements = geometryOnly ? elements.map(stripHeavyFields) : elements;

      await safeBroadcast('elements-batch', {
        elements: payloadElements,
        geometryOnly,
        userId: user.id,
        username: user.username,
      });
    },
    [user, safeBroadcast]
  );

  const broadcastSyncRequest = useCallback(async () => {
    if (!user) return;
    await safeBroadcast('sync-request', { userId: user.id, username: user.username });
  }, [user, safeBroadcast]);

  const broadcastSyncResponse = useCallback(
    async (elements: DrawingElement[], targetUserId: number) => {
      if (!user) return;

      const totalChunks = Math.ceil(elements.length / SYNC_CHUNK_SIZE) || 1;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = elements.slice(i * SYNC_CHUNK_SIZE, (i + 1) * SYNC_CHUNK_SIZE);
        await safeBroadcast('sync-response', {
          elements: chunk,
          targetUserId,
          userId: user.id,
          username: user.username,
          chunkIndex: i,
          totalChunks,
        });

        // Pauza między paczkami — nie bombarduj kanału
        if (i < totalChunks - 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, SYNC_CHUNK_DELAY_MS));
        }
      }
    },
    [user, safeBroadcast]
  );

  // ── Rejestracja handlerów ────────────────────────────────────────────

  const onRemoteElementCreated = useCallback(
    (handler: (element: DrawingElement, userId: number, username: string) => void) => {
      elementCreatedHandlerRef.current = handler;
    },
    []
  );

  const onRemoteElementUpdated = useCallback(
    (handler: (element: ElementBroadcastPayload, userId: number, username: string) => void) => {
      elementUpdatedHandlerRef.current = handler;
    },
    []
  );

  const onRemoteElementDeleted = useCallback(
    (handler: (elementId: string, userId: number, username: string) => void) => {
      elementDeletedHandlerRef.current = handler;
    },
    []
  );

  const onRemoteElementsBatch = useCallback(
    (
      handler: (
        elements: ElementBroadcastPayload[],
        userId: number,
        username: string,
        geometryOnly: boolean
      ) => void
    ) => {
      elementsBatchHandlerRef.current = handler;
    },
    []
  );

  const onRemoteSyncRequest = useCallback((handler: (userId: number, username: string) => void) => {
    syncRequestHandlerRef.current = handler;
  }, []);

  const onRemoteSyncResponse = useCallback(
    (handler: (elements: DrawingElement[], userId: number, username: string) => void) => {
      syncResponseHandlerRef.current = handler;
    },
    []
  );

  // ── Handlery wołane z `channel.on(...)` w Providerze ────────────────

  const handleElementCreated = useCallback(
    (element: DrawingElement, userId: number, username: string) => {
      log(`📥 Otrzymano element-created od ${username}:`, element.id, `(typ: ${element.type})`);
      if (elementCreatedHandlerRef.current) {
        elementCreatedHandlerRef.current(element, userId, username);
      }
    },
    []
  );

  const handleElementUpdated = useCallback(
    (element: ElementBroadcastPayload, userId: number, username: string) => {
      log(`📥 Otrzymano element-updated od ${username}:`, element.id);
      if (elementUpdatedHandlerRef.current) {
        elementUpdatedHandlerRef.current(element, userId, username);
      }
    },
    []
  );

  const handleElementDeleted = useCallback(
    (elementId: string, userId: number, username: string) => {
      log(`📥 Otrzymano element-deleted od ${username}:`, elementId);
      if (elementDeletedHandlerRef.current) {
        elementDeletedHandlerRef.current(elementId, userId, username);
      }
    },
    []
  );

  const handleElementsBatch = useCallback(
    (
      elements: ElementBroadcastPayload[],
      userId: number,
      username: string,
      geometryOnly: boolean
    ) => {
      log(
        `📥 Otrzymano elements-batch od ${username}: ${elements.length} elementów (geometryOnly: ${geometryOnly})`
      );
      if (elementsBatchHandlerRef.current) {
        elementsBatchHandlerRef.current(elements, userId, username, geometryOnly);
      }
    },
    []
  );

  const handleSyncRequest = useCallback(
    (channel: RealtimeChannel, currentUserId: number, userId: number, username: string) => {
      // Odpowiada tylko "host" — user z najniższym ID spośród obecnych w kanale.
      // Gwarantuje że tylko jeden user wyśle sync-response, nie wszyscy naraz.
      const presenceState = channel.presenceState();
      const onlineIds: number[] = [];
      Object.values(presenceState).forEach((presences: any) => {
        presences.forEach((p: any) => {
          if (p.user_id != null) onlineIds.push(Number(p.user_id));
        });
      });
      const minId = onlineIds.length > 0 ? Math.min(...onlineIds) : currentUserId;
      const isHost = currentUserId === minId;

      if (!isHost) {
        log(`📡 [SYNC] ${username} prosi o sync — nie jestem hostem, pomijam`);
        return;
      }

      log(`📡 [SYNC] ${username} prosi o sync — jestem hostem, odpowiadam`);
      if (syncRequestHandlerRef.current) syncRequestHandlerRef.current(userId, username);
    },
    []
  );

  const handleSyncResponse = useCallback(
    (
      currentUserId: number,
      targetUserId: number,
      elements: DrawingElement[],
      userId: number,
      username: string,
      chunkIndex: number,
      totalChunks: number
    ) => {
      if (targetUserId !== currentUserId) return;

      // Składamy paczki — inicjalizuj bufor na pierwszej paczce od danego sendera
      if (chunkIndex === 0 || syncChunkBufferRef.current?.fromUserId !== userId) {
        syncChunkBufferRef.current = { chunks: [], totalChunks, fromUserId: userId };
      }

      const buffer = syncChunkBufferRef.current!;
      buffer.chunks[chunkIndex] = elements;

      const received = buffer.chunks.filter(Boolean).length;
      log(`📥 [SYNC] Paczka ${chunkIndex + 1}/${totalChunks} od ${username} (${elements.length} el.)`);

      if (received >= totalChunks) {
        // Wszystkie paczki dotarły — połącz i przekaż
        const allElements = buffer.chunks.flat();
        syncChunkBufferRef.current = null;
        log(`📥 [SYNC] Kompletny stan od ${username}: ${allElements.length} elementów`);
        if (syncResponseHandlerRef.current) syncResponseHandlerRef.current(allElements, userId, username);
      }
    },
    []
  );

  const reset = useCallback(() => {
    if (pendingElementUpdateTimeoutRef.current) {
      clearTimeout(pendingElementUpdateTimeoutRef.current);
      pendingElementUpdateTimeoutRef.current = null;
    }
    pendingElementUpdateRef.current = null;
  }, []);

  return {
    broadcastElementCreated,
    broadcastElementUpdated,
    broadcastElementDeleted,
    broadcastElementsBatch,
    broadcastSyncRequest,
    broadcastSyncResponse,
    onRemoteElementCreated,
    onRemoteElementUpdated,
    onRemoteElementDeleted,
    onRemoteElementsBatch,
    onRemoteSyncRequest,
    onRemoteSyncResponse,
    handleElementCreated,
    handleElementUpdated,
    handleElementDeleted,
    handleElementsBatch,
    handleSyncRequest,
    handleSyncResponse,
    reset,
  };
}
