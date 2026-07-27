/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        BOARD REALTIME CONTEXT
 *                   Synchronizacja Tablicy w Czasie Rzeczywistym
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🎯 CEL:
 * Ten Context zarządza synchronizacją tablicy między użytkownikami w czasie rzeczywistym.
 * Używa Supabase Realtime (Broadcast + Presence) do:
 * - Synchronizacji elementów (rysunki, kształty, teksty)
 * - Śledzenia użytkowników online
 * - Pokazywania kursorów innych użytkowników
 *
 * 📡 TECHNOLOGIA:
 * - Supabase Broadcast → wysyłanie zmian do innych użytkowników
 * - Supabase Presence → śledzenie kto jest online
 *
 * 📦 UŻYWANE W:
 * - WhiteboardCanvas.tsx → główny komponent tablicy
 * - layout.tsx → opakowuje stronę /tablica
 *
 * 🔄 JAK TO DZIAŁA:
 * 1. User A rysuje → wysyła event przez Broadcast
 * 2. User B odbiera event → dodaje element do swojej tablicy
 * 3. User C wchodzi → widzi listę online users (Presence)
 *
 * 🧩 KROK 3 ROZBIJANIA (patrz docs/migration-status.md):
 * Samo otwieranie kanału Supabase, Presence (kto online) i reconnect
 * przeniosły się do `useRealtimeChannel` (src/_new/features/whiteboard/realtime/).
 *
 * 🧩 KROK 4 ROZBIJANIA: stan i logika kursorów/typing/viewportów/"kto wyszedł"
 * przeniosły się do osobnych hooków (`useCursors`, `useTypingIndicator`,
 * `useViewportTracking`, `usePresence` — wszystkie w tym samym folderze
 * `realtime/`). Ten plik teraz tylko WOŁA te hooki i przekazuje ich wyniki
 * do `channel.on(...)` (bo to JEDYNE miejsce, które ma dostęp do samego
 * kanału Supabase) oraz do Contextu. Elementy (rysowanie) i sync nowego
 * usera zostają tu na razie w całości — to Krok 5.
 */

'use client';

import { createContext, useContext, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from '@/_new/lib/auth';
import { DrawingElement } from '@/_new/features/whiteboard/types';

// ─── Wydzielone do src/_new/features/whiteboard/realtime/ (patrz
// docs/migration-status.md) — typy, stałe, logger i sam silnik połączenia
// żyją teraz w jednym miejscu, współdzielonym z resztą mechanizmu realtime. ──
import type {
  RemoteCursor,
  TypingUser,
  RemoteViewport,
  BoardEvent,
  BoardRealtimeContextType,
  ElementBroadcastPayload,
} from '@/_new/features/whiteboard/realtime/types';

/**
 * 🛠️ FIX (known-issues.md #2, Opcja B): usuwa z elementu pola, które są
 * "ciężkie" i praktycznie NIGDY nie zmieniają się po utworzeniu elementu —
 * na razie tylko `src` u zdjęć (base64, potrafi mieć setki KB). Używane
 * TYLKO przy `element-updated`/`elements-batch` (update geometrii), NIGDY
 * przy `element-created` (tam `src` musi dojść, bo odbiorca nie ma go jeszcze
 * wcale). Odbiorca scala wynik z lokalną kopią zamiast nadpisywać całość —
 * patrz `onRemoteElementUpdated`/`onElementsUpdated` w whiteboard-canvas.tsx.
 */
function stripHeavyFields(element: DrawingElement): ElementBroadcastPayload {
  if (element.type === 'image') {
    const { src, ...rest } = element;
    return rest;
  }
  return element;
}
import {
  THROTTLE_MS,
  SYNC_CHUNK_SIZE,
  SYNC_CHUNK_DELAY_MS,
} from '@/_new/features/whiteboard/realtime/constants';
import { log, logWarn } from '@/_new/features/whiteboard/realtime/logger';
import { useSafeBroadcast } from '@/_new/features/whiteboard/realtime/useSafeBroadcast';
import {
  useRealtimeChannel,
  type ChannelListenerSetup,
} from '@/_new/features/whiteboard/realtime/useRealtimeChannel';
import { usePresence } from '@/_new/features/whiteboard/realtime/usePresence';
import { useCursors } from '@/_new/features/whiteboard/realtime/useCursors';
import { useTypingIndicator } from '@/_new/features/whiteboard/realtime/useTypingIndicator';
import { useViewportTracking } from '@/_new/features/whiteboard/realtime/useViewportTracking';

// Re-eksport, żeby zewnętrzne pliki importujące te typy stąd
// (np. use-realtime.ts, remote-cursors.tsx) nie musiały się jeszcze zmieniać —
// to zmienimy dopiero w ostatnim kroku, jak cały plik zniknie.
export type { RemoteCursor, TypingUser, RemoteViewport };

// ═══════════════════════════════════════════════════════════════════════════
// 🎁 CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const BoardRealtimeContext = createContext<BoardRealtimeContextType | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// 📦 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BoardRealtimeProvider - Manager synchronizacji tablicy
 *
 * PARAMETRY:
 * - boardId: ID tablicy (string)
 * - children: Komponenty które będą miały dostęp
 *
 * UŻYCIE:
 * <BoardRealtimeProvider boardId="123">
 *   <WhiteboardCanvas />
 * </BoardRealtimeProvider>
 */
export function BoardRealtimeProvider({
  boardId,
  children,
}: {
  boardId: string;
  children: ReactNode;
}) {
  // ───────────────────────────────────────────────────────────────────────
  // STANY
  // ───────────────────────────────────────────────────────────────────────

  const { user } = useAuth();
  // Wąski kształt usera, jakiego potrzebują hooki broadcastu (id + username) —
  // ten sam obiekt co dawniej `user` z `useAuth()`, tylko nazwany inaczej dla
  // jasności przy przekazywaniu do kilku hooków naraz.
  const broadcastUser = user ? { id: user.id, username: user.username } : null;

  // 🛡️ THROTTLE - Ref do przechowywania ostatniego czasu broadcastu update'u
  // elementu. Throttle kursora/viewportu żyje teraz WEWNĄTRZ useCursors/
  // useViewportTracking (Krok 4) — każdy pilnuje tylko swojego.
  const lastBroadcastTimeRef = useRef({
    elementUpdate: 0,
  });

  // 🛡️ TRAILING THROTTLE - przechowuj ostatnią wartość do wysłania
  const pendingElementUpdateRef = useRef<DrawingElement | null>(null);
  const pendingElementUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handlery dla eventów elementów/sync (refs żeby uniknąć re-renderów) —
  // kursory/typing/viewport mają teraz swoje analogiczne handlery WEWNĄTRZ
  // odpowiednich hooków (Krok 4). Elementy i sync zostają tu (Krok 5).
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
  const syncResponseHandlerRef = useRef<((elements: DrawingElement[], userId: number, username: string) => void) | null>(null);
  // Bufor składania chunków sync-response od jednego sendera
  const syncChunkBufferRef = useRef<{ chunks: DrawingElement[][]; totalChunks: number; fromUserId: number } | null>(null);

  // ───────────────────────────────────────────────────────────────────────
  // POŁĄCZENIE Z SUPABASE — samo łączenie i Presence robi useRealtimeChannel.
  // My tylko mówimy MU, co ma się stać, gdy przyjdzie dana wiadomość.
  // ───────────────────────────────────────────────────────────────────────

  // Uwaga: ta funkcja NIE jest owinięta w useCallback. To celowe — nie
  // dlatego, że o tym zapomnieliśmy, tylko dlatego że useCallback ma sens
  // tylko wtedy, gdy tożsamość funkcji jest gdzieś używana jako zależność
  // (np. w tablicy [] efektu albo jako prop do zmemoizowanego komponentu).
  // `useRealtimeChannel` celowo NIE wrzuca tej funkcji do swojej tablicy
  // zależności (czyta ją przez ref w środku), więc nowa "kopia" tej funkcji
  // przy każdym renderze nikomu nie przeszkadza.
  const registerListeners: ChannelListenerSetup = (channel, currentUser) => {
    // 🧩 KROK 4: filtrowanie "ghost leave" i fan-out do useCursors/
    // useTypingIndicator przeniesione do usePresence.ts — tu tylko wołamy.
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      presence.handlePresenceLeave(channel, currentUser.id, leftPresences);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 🔄 BROADCAST - Synchronizacja elementów
    // ═══════════════════════════════════════════════════════════════════════

    channel
      .on('broadcast', { event: 'element-created' }, ({ payload }) => {
        const { element, userId, username } = payload as BoardEvent & { type: 'element-created' };

        // Ignoruj własne eventy (już mamy lokalnie)
        if (userId === currentUser.id) return;

        log(
          `📥 Otrzymano element-created od ${username}:`,
          element.id,
          `(typ: ${element.type})`
        );

        if (elementCreatedHandlerRef.current) {
          elementCreatedHandlerRef.current(element, userId, username);
        }
      })
      .on('broadcast', { event: 'element-updated' }, ({ payload }) => {
        const { element, userId, username } = payload as BoardEvent & { type: 'element-updated' };

        if (userId === currentUser.id) return;

        log(`📥 Otrzymano element-updated od ${username}:`, element.id);

        if (elementUpdatedHandlerRef.current) {
          elementUpdatedHandlerRef.current(element, userId, username);
        }
      })
      .on('broadcast', { event: 'element-deleted' }, ({ payload }) => {
        const { elementId, userId, username } = payload as BoardEvent & { type: 'element-deleted' };

        if (userId === currentUser.id) return;

        log(`📥 Otrzymano element-deleted od ${username}:`, elementId);

        if (elementDeletedHandlerRef.current) {
          elementDeletedHandlerRef.current(elementId, userId, username);
        }
      })
      .on('broadcast', { event: 'elements-batch' }, ({ payload }) => {
        const { elements, geometryOnly, userId, username } = payload as BoardEvent & {
          type: 'elements-batch';
        };

        if (userId === currentUser.id) return;

        log(`📥 Otrzymano elements-batch od ${username}: ${elements.length} elementów (geometryOnly: ${!!geometryOnly})`);

        if (elementsBatchHandlerRef.current) {
          elementsBatchHandlerRef.current(elements, userId, username, !!geometryOnly);
        }
      })
      // 🧩 KROK 4: stan kursorów/typing/viewportów przeniesiony do
      // useCursors/useTypingIndicator/useViewportTracking — tu tylko
      // filtrujemy własne eventy i wołamy odpowiedni handler.
      .on('broadcast', { event: 'cursor-moved' }, ({ payload }) => {
        const { x, y, userId, username } = payload as BoardEvent & { type: 'cursor-moved' };
        if (userId === currentUser.id) return;
        cursors.handleCursorMoved(x, y, userId, username);
      })
      .on('broadcast', { event: 'typing-started' }, ({ payload }) => {
        const { elementId, userId, username } = payload as BoardEvent & { type: 'typing-started' };
        if (userId === currentUser.id) return;
        typing.handleTypingStarted(elementId, userId, username);
      })
      .on('broadcast', { event: 'typing-stopped' }, ({ payload }) => {
        const { elementId, userId } = payload as BoardEvent & { type: 'typing-stopped' };
        if (userId === currentUser.id) return;
        typing.handleTypingStopped(elementId, userId);
      })
      .on('broadcast', { event: 'viewport-changed' }, ({ payload }) => {
        const { x, y, scale, userId, username } = payload as BoardEvent & {
          type: 'viewport-changed';
        };
        if (userId === currentUser.id) return;
        viewportTracking.handleViewportChanged(x, y, scale, userId, username);
      })
      .on('broadcast', { event: 'sync-request' }, ({ payload }) => {
        const { userId, username } = payload as any;
        if (userId === currentUser.id) return;

        // Odpowiada tylko "host" — user z najniższym ID spośród obecnych w kanale.
        // Gwarantuje że tylko jeden user wyśle sync-response, nie wszyscy naraz.
        const presenceState = channel.presenceState();
        const onlineIds: number[] = [];
        Object.values(presenceState).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id != null) onlineIds.push(Number(p.user_id));
          });
        });
        const minId = onlineIds.length > 0 ? Math.min(...onlineIds) : currentUser.id;
        const isHost = currentUser.id === minId;

        if (!isHost) {
          log(`📡 [SYNC] ${username} prosi o sync — nie jestem hostem, pomijam`);
          return;
        }

        log(`📡 [SYNC] ${username} prosi o sync — jestem hostem, odpowiadam`);
        if (syncRequestHandlerRef.current) syncRequestHandlerRef.current(userId, username);
      })
      .on('broadcast', { event: 'sync-response' }, ({ payload }) => {
        const { elements, targetUserId, userId, username, chunkIndex = 0, totalChunks = 1 } = payload as any;
        if (targetUserId !== currentUser.id) return;

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
          const allElements = (buffer.chunks as DrawingElement[][]).flat();
          syncChunkBufferRef.current = null;
          log(`📥 [SYNC] Kompletny stan od ${username}: ${allElements.length} elementów`);
          if (syncResponseHandlerRef.current) syncResponseHandlerRef.current(allElements, userId, username);
        }
      });

    // Auto-cleanup wskaźników pisania (interval) żyje teraz WEWNĄTRZ
    // useTypingIndicator (własny useEffect, patrz komentarz w tamtym pliku
    // o drobnej, celowej różnicy: interval jest teraz związany z cyklem
    // życia komponentu, nie z (re)connectem kanału).

    // Funkcja sprzątająca — useRealtimeChannel wywoła ją przy rozłączaniu,
    // OBOK swojego własnego sprzątania (kanał, presence, heartbeat).
    return () => {
      if (pendingElementUpdateTimeoutRef.current) clearTimeout(pendingElementUpdateTimeoutRef.current);
      pendingElementUpdateRef.current = null;
      cursors.reset();
      typing.reset();
    };
  };

  const { channelRef, isConnected, onlineUsers } = useRealtimeChannel(
    boardId,
    user ? { id: user.id, username: user.username, avatar_url: (user as any).avatar_url } : null,
    registerListeners
  );

  // ───────────────────────────────────────────────────────────────────────
  // FUNKCJE BROADCAST (wysyłanie do innych użytkowników)
  // ───────────────────────────────────────────────────────────────────────

  // 🛡️ RESILIENT BROADCAST z automatycznym retry w tle — wydzielone do
  // src/_new/features/whiteboard/realtime/useSafeBroadcast.ts (krok 2 rozbijania,
  // patrz docs/migration-status.md). Zero zmian w zachowaniu.
  const safeBroadcast = useSafeBroadcast(channelRef);

  // 🧩 KROK 4: kursory/typing/viewporty/presence-leave — patrz komentarz na
  // górze pliku. `registerListeners` (wyżej) odwołuje się do `cursors`/
  // `typing`/`viewportTracking`/`presence` przez domknięcie (closure) — to
  // bezpieczne, bo `registerListeners` jest tylko WARTOŚCIĄ przekazywaną do
  // `useRealtimeChannel` i faktycznie WYKONA się dopiero później (w efekcie
  // tamtego hooka, już PO zakończeniu tego renderu — czyli już PO tym, jak
  // poniższe stałe zostaną przypisane). Zweryfikowane `tsc --noEmit`.
  const cursors = useCursors({ user: broadcastUser, safeBroadcast });
  const typing = useTypingIndicator({ user: broadcastUser, safeBroadcast });
  const viewportTracking = useViewportTracking({ user: broadcastUser, safeBroadcast });
  const presence = usePresence();

  // Spina usePresence (fan-out "user wyszedł") z czyszczeniem stanu w
  // useCursors/useTypingIndicator — te dwa hooki nic o sobie nawzajem nie
  // wiedzą, usePresence jest wspólnym miejscem subskrypcji.
  useEffect(() => {
    const unsubscribeCursors = presence.onPresenceLeave(cursors.handlePresenceLeave);
    const unsubscribeTyping = presence.onPresenceLeave(typing.handlePresenceLeave);
    return () => {
      unsubscribeCursors();
      unsubscribeTyping();
    };
  }, [presence, cursors.handlePresenceLeave, typing.handlePresenceLeave]);

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
      const timeSinceLastBroadcast = now - lastBroadcastTimeRef.current.elementUpdate;

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

        lastBroadcastTimeRef.current.elementUpdate = now;
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
              lastBroadcastTimeRef.current.elementUpdate = Date.now();

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

  // ───────────────────────────────────────────────────────────────────────
  // REJESTRACJA HANDLERÓW (dla komponentów)
  // ───────────────────────────────────────────────────────────────────────

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

  // ───────────────────────────────────────────────────────────────────────
  // 🔥 DODANE: SYNC REQUEST FUNCTIONS (Wywoływanie najświeższych danych)
  // ───────────────────────────────────────────────────────────────────────

  const broadcastSyncRequest = useCallback(async () => {
    if (!user) return;
    await safeBroadcast('sync-request', { userId: user.id, username: user.username });
  }, [user, safeBroadcast]);

  const broadcastSyncResponse = useCallback(async (elements: DrawingElement[], targetUserId: number) => {
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
  }, [user, safeBroadcast]);

  const onRemoteSyncRequest = useCallback((handler: (userId: number, username: string) => void) => {
    syncRequestHandlerRef.current = handler;
  }, []);

  const onRemoteSyncResponse = useCallback((handler: (elements: DrawingElement[], userId: number, username: string) => void) => {
    syncResponseHandlerRef.current = handler;
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // PROVIDER
  // ───────────────────────────────────────────────────────────────────────
  // 🧩 KROK 4: broadcast/subscribe dla kursorów, typing i viewportów idą
  // teraz z osobnych hooków (useCursors/useTypingIndicator/useViewportTracking)
  // zamiast być definiowane tutaj — patrz góra pliku.

  return (
    <BoardRealtimeContext.Provider
      value={{
        onlineUsers,
        isConnected,
        subscribeCursors: cursors.subscribeCursors,
        subscribeTyping: typing.subscribeTyping,
        subscribeViewports: viewportTracking.subscribeViewports,
        broadcastElementCreated,
        broadcastElementUpdated,
        broadcastElementDeleted,
        broadcastElementsBatch,
        broadcastCursorMove: cursors.broadcastCursorMove,
        broadcastTypingStarted: typing.broadcastTypingStarted,
        broadcastTypingStopped: typing.broadcastTypingStopped,
        broadcastViewportChange: viewportTracking.broadcastViewportChange,
        onRemoteElementCreated,
        onRemoteElementUpdated,
        onRemoteElementDeleted,
        onRemoteElementsBatch,
        onRemoteCursorMove: cursors.onRemoteCursorMove,
        broadcastSyncRequest,
        broadcastSyncResponse,
        onRemoteSyncRequest,
        onRemoteSyncResponse,
      }}
    >
      {children}
    </BoardRealtimeContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🪝 HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * useBoardRealtime - Hook do użycia w komponentach
 *
 * PRZYKŁAD:
 * const { broadcastElementCreated, onlineUsers } = useBoardRealtime()
 */
export function useBoardRealtime() {
  const context = useContext(BoardRealtimeContext);

  if (!context) {
    throw new Error(
      '❌ useBoardRealtime musi być użyty wewnątrz BoardRealtimeProvider! ' +
        'Upewnij się że Twój komponent jest owinięty w <BoardRealtimeProvider>...</BoardRealtimeProvider>'
    );
  }

  return context;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 PRZYKŁADY UŻYCIA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. OWINIĘCIE APLIKACJI:
 *
 * <BoardRealtimeProvider boardId="123">
 *   <WhiteboardCanvas />
 * </BoardRealtimeProvider>
 *
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 2. WYSYŁANIE ELEMENTU:
 *
 * const { broadcastElementCreated } = useBoardRealtime()
 *
 * const handleDraw = (newPath) => {
 *   setElements([...elements, newPath])
 *   broadcastElementCreated(newPath) // Wyślij do innych
 * }
 *
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 3. ODBIERANIE ELEMENTÓW:
 *
 * const { onRemoteElementCreated } = useBoardRealtime()
 *
 * useEffect(() => {
 *   onRemoteElementCreated((element, userId, username) => {
 *     console.log(`${username} dodał element:`, element)
 *     setElements(prev => [...prev, element])
 *   })
 * }, [])
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
