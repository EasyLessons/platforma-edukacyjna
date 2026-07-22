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
 * Ten plik teraz tylko REJESTRUJE, co ma się stać gdy przyjdzie dana wiadomość
 * (broadcast elementów/kursorów/typing/viewport/sync + presence "leave") —
 * resztę robi za nas hook. W kolejnych krokach i te rejestracje się wyprowadzi.
 */

'use client';

import { createContext, useContext, useCallback, useRef, ReactNode } from 'react';
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
  TYPING_TIMEOUT_MS,
  TYPING_CLEANUP_INTERVAL_MS,
  CURSOR_COLORS,
} from '@/_new/features/whiteboard/realtime/constants';
import { log, logWarn } from '@/_new/features/whiteboard/realtime/logger';
import { useSafeBroadcast } from '@/_new/features/whiteboard/realtime/useSafeBroadcast';
import {
  useRealtimeChannel,
  type ChannelListenerSetup,
} from '@/_new/features/whiteboard/realtime/useRealtimeChannel';

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

  // 🆕 KURSORY - używamy ref + subscribers zamiast state
  // To zapobiega re-renderom WhiteboardCanvas przy każdym ruchu kursora
  const remoteCursorsRef = useRef<RemoteCursor[]>([]);
  const cursorSubscribersRef = useRef<Set<(cursors: RemoteCursor[]) => void>>(new Set());

  // 🆕 TYPING INDICATOR - ref + subscribers
  const typingUsersRef = useRef<TypingUser[]>([]);
  const typingSubscribersRef = useRef<Set<(typing: TypingUser[]) => void>>(new Set());

  // 🆕 VIEWPORT TRACKING - ref + subscribers (dla Follow Mode)
  const remoteViewportsRef = useRef<RemoteViewport[]>([]);
  const viewportSubscribersRef = useRef<Set<(viewports: RemoteViewport[]) => void>>(new Set());

  const typingCleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { user } = useAuth();

  // 🛡️ THROTTLE - Ref do przechowywania ostatnich czasów broadcast
  const lastBroadcastTimeRef = useRef({
    elementUpdate: 0,
    cursorMove: 0,
    viewportChange: 0,
  });

  // 🛡️ TRAILING THROTTLE - przechowuj ostatnią wartość do wysłania
  const pendingElementUpdateRef = useRef<DrawingElement | null>(null);
  const pendingElementUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Funkcja do notyfikacji subscriberów o zmianie kursorów
  const notifyCursorSubscribers = useCallback(() => {
    cursorSubscribersRef.current.forEach((callback) => {
      callback(remoteCursorsRef.current);
    });
  }, []);

  // 🆕 Funkcja do notyfikacji subscriberów o zmianie typing
  const notifyTypingSubscribers = useCallback(() => {
    typingSubscribersRef.current.forEach((callback) => {
      callback(typingUsersRef.current);
    });
  }, []);

  // 🆕 Funkcja do notyfikacji subscriberów o zmianie viewportów
  const notifyViewportSubscribers = useCallback(() => {
    viewportSubscribersRef.current.forEach((callback) => {
      callback(remoteViewportsRef.current);
    });
  }, []);

  // Handlery dla eventów (refs żeby uniknąć re-renderów)
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
  const cursorMoveHandlerRef = useRef<
    ((x: number, y: number, userId: number, username: string) => void) | null
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
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      // 🛡️ Filtruj "ghost" leave events - sprawdź czy user naprawdę wyszedł
      // Ghost leave może wystąpić przy reconnect kanału
      const realLeftUsers = leftPresences.filter((p: any) => {
        // Nie reaguj na własne leave
        if (p.user_id === currentUser.id) return false;
        // Sprawdź czy user nie jest już ponownie w presence state
        const currentState = channel.presenceState();
        const userStillPresent = Object.values(currentState).some((presences: any) =>
          presences.some((presence: any) => presence.user_id === p.user_id)
        );
        return !userStillPresent; // Tylko jeśli naprawdę wyszedł
      });

      if (realLeftUsers.length > 0) {
        log('🔴 Użytkownik wyszedł:', realLeftUsers.map((p: any) => p.username));
        const leftUserIds = realLeftUsers.map((p: any) => p.user_id);

        // Usuń kursory wychodzących użytkowników
        remoteCursorsRef.current = remoteCursorsRef.current.filter(
          (c) => !leftUserIds.includes(c.userId)
        );
        notifyCursorSubscribers();

        // Usuń wskaźniki pisania wychodzących użytkowników
        // (typing-stopped nigdy nie dotrze jeśli ktoś zamknął kartę)
        const beforeTyping = typingUsersRef.current.length;
        typingUsersRef.current = typingUsersRef.current.filter(
          (t) => !leftUserIds.includes(t.userId)
        );
        if (typingUsersRef.current.length !== beforeTyping) {
          notifyTypingSubscribers();
        }
      }
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
      .on('broadcast', { event: 'cursor-moved' }, ({ payload }) => {
        const { x, y, userId, username } = payload as BoardEvent & { type: 'cursor-moved' };

        if (userId === currentUser.id) return;

        // Automatycznie aktualizuj remote cursors (używamy ref zamiast state!)
        const prev = remoteCursorsRef.current;
        const existing = prev.find((c) => c.userId === userId);
        const color = existing?.color || CURSOR_COLORS[userId % CURSOR_COLORS.length];

        if (existing) {
          remoteCursorsRef.current = prev.map((c) =>
            c.userId === userId ? { ...c, x, y, lastUpdate: Date.now() } : c
          );
        } else {
          remoteCursorsRef.current = [
            ...prev,
            { userId, username, x, y, color, lastUpdate: Date.now() },
          ];
        }

        // Notyfikuj subscriberów (nie powoduje re-rendera context!)
        notifyCursorSubscribers();

        if (cursorMoveHandlerRef.current) {
          cursorMoveHandlerRef.current(x, y, userId, username);
        }
      })
      // 🆕 TYPING INDICATOR - ktoś zaczął edytować
      .on('broadcast', { event: 'typing-started' }, ({ payload }) => {
        const { elementId, userId, username } = payload as BoardEvent & { type: 'typing-started' };

        log(`✏️ [TYPING] ${username} zaczął edytować element ${elementId}`);

        if (userId === currentUser.id) return;

        const now = Date.now();
        const existingIndex = typingUsersRef.current.findIndex(
          (t) => t.userId === userId && t.elementId === elementId
        );

        if (existingIndex === -1) {
          // Nowy wpis — dodaj z aktualnym timestampem
          typingUsersRef.current = [
            ...typingUsersRef.current,
            { userId, username, elementId, lastSeen: now },
          ];
        } else {
          // Już istnieje — odśwież lastSeen żeby timer nie usunął aktywnego użytkownika
          typingUsersRef.current = typingUsersRef.current.map((t, i) =>
            i === existingIndex ? { ...t, lastSeen: now } : t
          );
        }

        log(`✏️ [TYPING] Aktualna lista:`, typingUsersRef.current);
        notifyTypingSubscribers();
      })
      // 🆕 TYPING INDICATOR - ktoś skończył edytować
      .on('broadcast', { event: 'typing-stopped' }, ({ payload }) => {
        const { elementId, userId } = payload as BoardEvent & { type: 'typing-stopped' };

        log(`✏️ [TYPING] User ${userId} skończył edytować element ${elementId}`);

        if (userId === currentUser.id) return;

        // Usuń z listy
        typingUsersRef.current = typingUsersRef.current.filter(
          (t) => !(t.userId === userId && t.elementId === elementId)
        );
        log(`✏️ [TYPING] Aktualna lista po usunięciu:`, typingUsersRef.current);
        notifyTypingSubscribers();
      })
      // 🆕 VIEWPORT CHANGED - ktoś zmienił swój viewport (dla Follow Mode)
      .on('broadcast', { event: 'viewport-changed' }, ({ payload }) => {
        const { x, y, scale, userId, username } = payload as BoardEvent & {
          type: 'viewport-changed';
        };

        if (userId === currentUser.id) return;

        // Aktualizuj lub dodaj viewport użytkownika
        const prev = remoteViewportsRef.current;
        const existing = prev.find((v) => v.userId === userId);

        if (existing) {
          remoteViewportsRef.current = prev.map((v) =>
            v.userId === userId ? { ...v, x, y, scale, lastUpdate: Date.now() } : v
          );
        } else {
          remoteViewportsRef.current = [
            ...prev,
            { userId, username, x, y, scale, lastUpdate: Date.now() },
          ];
        }

        notifyViewportSubscribers();
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

    // ═══════════════════════════════════════════════════════════════════════
    // ⏰ AUTO-CLEANUP WSKAŹNIKÓW PISANIA
    // ═══════════════════════════════════════════════════════════════════════
    // Co 5 sekund usuwa wpisy starsze niż TYPING_TIMEOUT_MS.
    // Zabezpiecza przed "duchami" gdy użytkownik rozłączy się bez typing-stopped.
    typingCleanupIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const before = typingUsersRef.current.length;
      typingUsersRef.current = typingUsersRef.current.filter(
        (t) => now - t.lastSeen < TYPING_TIMEOUT_MS
      );
      if (typingUsersRef.current.length !== before) {
        log(`✏️ [TYPING] Auto-cleanup: usunięto ${before - typingUsersRef.current.length} starych wpisów`);
        notifyTypingSubscribers();
      }
    }, TYPING_CLEANUP_INTERVAL_MS);

    // Funkcja sprzątająca — useRealtimeChannel wywoła ją przy rozłączaniu,
    // OBOK swojego własnego sprzątania (kanał, presence, heartbeat).
    return () => {
      if (pendingElementUpdateTimeoutRef.current) clearTimeout(pendingElementUpdateTimeoutRef.current);
      if (typingCleanupIntervalRef.current) clearInterval(typingCleanupIntervalRef.current);
      remoteCursorsRef.current = [];
      typingUsersRef.current = [];
      pendingElementUpdateRef.current = null;
      // Notyfikuj subscriberów o pustej liście kursorów
      cursorSubscribersRef.current.forEach((callback) => callback([]));
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

  const broadcastCursorMove = useCallback(
    async (x: number, y: number) => {
      if (!user) return;

      // 🛡️ THROTTLE: ograniczenie częstotliwości kursorów
      const now = Date.now();
      if (now - lastBroadcastTimeRef.current.cursorMove < THROTTLE_MS.CURSOR_MOVE) {
        return; // Zbyt szybko - pomiń
      }

      lastBroadcastTimeRef.current.cursorMove = now;

      await safeBroadcast('cursor-moved', {
        x,
        y,
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

  const onRemoteCursorMove = useCallback(
    (handler: (x: number, y: number, userId: number, username: string) => void) => {
      cursorMoveHandlerRef.current = handler;
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

  // 🆕 SUBSKRYPCJA KURSORÓW - nie powoduje re-renderów context!
  const subscribeCursors = useCallback((callback: (cursors: RemoteCursor[]) => void) => {
    // Dodaj subscriber
    cursorSubscribersRef.current.add(callback);

    // Od razu wywołaj z aktualnym stanem
    callback(remoteCursorsRef.current);

    // Zwróć funkcję do anulowania subskrypcji
    return () => {
      cursorSubscribersRef.current.delete(callback);
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // 🆕 TYPING INDICATOR FUNCTIONS
  // ───────────────────────────────────────────────────────────────────────

  const broadcastTypingStarted = useCallback(
    async (elementId: string) => {
      if (!user) return;

      await safeBroadcast('typing-started', {
        elementId,
        userId: user.id,
        username: user.username,
      });
    },
    [user, safeBroadcast]
  );

  const broadcastTypingStopped = useCallback(
    async (elementId: string) => {
      if (!user) return;

      await safeBroadcast('typing-stopped', {
        elementId,
        userId: user.id,
        username: user.username,
      });
    },
    [user, safeBroadcast]
  );

  // 🆕 SUBSKRYPCJA TYPING - dla komponentów które chcą wiedzieć kto edytuje
  const subscribeTyping = useCallback((callback: (typingUsers: TypingUser[]) => void) => {
    // Dodaj subscriber
    typingSubscribersRef.current.add(callback);

    // Od razu wywołaj z aktualnym stanem
    callback(typingUsersRef.current);

    // Zwróć funkcję do anulowania subskrypcji
    return () => {
      typingSubscribersRef.current.delete(callback);
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // 🆕 VIEWPORT TRACKING FUNCTIONS (dla Follow Mode)
  // ───────────────────────────────────────────────────────────────────────

  const broadcastViewportChange = useCallback(
    async (x: number, y: number, scale: number) => {
      if (!user) return;

      // 🛡️ THROTTLE: ograniczenie częstotliwości viewport updates
      const now = Date.now();
      if (now - lastBroadcastTimeRef.current.viewportChange < THROTTLE_MS.VIEWPORT_CHANGE) {
        return; // Zbyt szybko - pomiń
      }

      lastBroadcastTimeRef.current.viewportChange = now;

      await safeBroadcast('viewport-changed', {
        x,
        y,
        scale,
        userId: user.id,
        username: user.username,
      });
    },
    [user, safeBroadcast]
  );

  // 🆕 SUBSKRYPCJA VIEWPORTÓW - dla Follow Mode
  const subscribeViewports = useCallback((callback: (viewports: RemoteViewport[]) => void) => {
    // Dodaj subscriber
    viewportSubscribersRef.current.add(callback);

    // Od razu wywołaj z aktualnym stanem
    callback(remoteViewportsRef.current);

    // Zwróć funkcję do anulowania subskrypcji
    return () => {
      viewportSubscribersRef.current.delete(callback);
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // PROVIDER
  // ───────────────────────────────────────────────────────────────────────

  return (
    <BoardRealtimeContext.Provider
      value={{
        onlineUsers,
        isConnected,
        subscribeCursors,
        subscribeTyping,
        subscribeViewports,
        broadcastElementCreated,
        broadcastElementUpdated,
        broadcastElementDeleted,
        broadcastElementsBatch,
        broadcastCursorMove,
        broadcastTypingStarted,
        broadcastTypingStopped,
        broadcastViewportChange,
        onRemoteElementCreated,
        onRemoteElementUpdated,
        onRemoteElementDeleted,
        onRemoteElementsBatch,
        onRemoteCursorMove,
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
