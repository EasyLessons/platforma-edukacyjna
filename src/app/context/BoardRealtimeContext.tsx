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
 * `realtime/`).
 *
 * 🧩 KROK 5 ROZBIJANIA: ostatni kawałek stanu — elementy (rysowanie) i sync
 * całej tablicy nowemu userowi — przeniósł się do `useElementSync`. Ten plik
 * TERAZ TYLKO SPINA wszystkie hooki z kanałem Supabase: woła je i przekazuje
 * ich handlery do `channel.on(...)` (bo to JEDYNE miejsce, które ma dostęp
 * do samego kanału), a ich publiczne API (broadcast/subscribe/onRemote*) —
 * do Contextu, żeby komponenty mogły z nich korzystać przez `useBoardRealtime()`.
 */

'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from '@/_new/lib/auth';

// ─── Wydzielone do src/_new/features/whiteboard/realtime/ (patrz
// docs/migration-status.md) — typy, stałe, logger i sam silnik połączenia
// żyją teraz w jednym miejscu, współdzielonym z resztą mechanizmu realtime. ──
import type {
  RemoteCursor,
  TypingUser,
  RemoteViewport,
  BoardEvent,
  BoardRealtimeContextType,
} from '@/_new/features/whiteboard/realtime/types';

import { useSafeBroadcast } from '@/_new/features/whiteboard/realtime/useSafeBroadcast';
import {
  useRealtimeChannel,
  type ChannelListenerSetup,
} from '@/_new/features/whiteboard/realtime/useRealtimeChannel';
import { usePresence } from '@/_new/features/whiteboard/realtime/usePresence';
import { useCursors } from '@/_new/features/whiteboard/realtime/useCursors';
import { useTypingIndicator } from '@/_new/features/whiteboard/realtime/useTypingIndicator';
import { useViewportTracking } from '@/_new/features/whiteboard/realtime/useViewportTracking';
import { useElementSync } from '@/_new/features/whiteboard/realtime/useElementSync';

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

  // Cały stan/throttle/bufory dla elementów i sync żyją teraz WEWNĄTRZ
  // useElementSync (Krok 5) — dokładnie tak samo jak kursory/typing/viewport
  // w Kroku 4. Ten plik od teraz tylko WOŁA hooki, patrz niżej.

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
      // 🧩 KROK 5: broadcast/odbiór elementów przeniesiony do useElementSync
      // — tu tylko filtrujemy własne eventy i wołamy odpowiedni handler.
      .on('broadcast', { event: 'element-created' }, ({ payload }) => {
        const { element, userId, username } = payload as BoardEvent & { type: 'element-created' };
        if (userId === currentUser.id) return;
        elementSync.handleElementCreated(element, userId, username);
      })
      .on('broadcast', { event: 'element-updated' }, ({ payload }) => {
        const { element, userId, username } = payload as BoardEvent & { type: 'element-updated' };
        if (userId === currentUser.id) return;
        elementSync.handleElementUpdated(element, userId, username);
      })
      .on('broadcast', { event: 'element-deleted' }, ({ payload }) => {
        const { elementId, userId, username } = payload as BoardEvent & { type: 'element-deleted' };
        if (userId === currentUser.id) return;
        elementSync.handleElementDeleted(elementId, userId, username);
      })
      .on('broadcast', { event: 'elements-batch' }, ({ payload }) => {
        const { elements, geometryOnly, userId, username } = payload as BoardEvent & {
          type: 'elements-batch';
        };
        if (userId === currentUser.id) return;
        elementSync.handleElementsBatch(elements, userId, username, !!geometryOnly);
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
      // 🧩 KROK 5: host-election i składanie paczek przeniesione do
      // useElementSync — tu tylko wołamy, `channel` trzeba podać jawnie
      // (potrzebny do `presenceState()` przy wyborze hosta).
      .on('broadcast', { event: 'sync-request' }, ({ payload }) => {
        const { userId, username } = payload as any;
        if (userId === currentUser.id) return;
        elementSync.handleSyncRequest(channel, currentUser.id, userId, username);
      })
      .on('broadcast', { event: 'sync-response' }, ({ payload }) => {
        const { elements, targetUserId, userId, username, chunkIndex = 0, totalChunks = 1 } = payload as any;
        elementSync.handleSyncResponse(
          currentUser.id,
          targetUserId,
          elements,
          userId,
          username,
          chunkIndex,
          totalChunks
        );
      });

    // Auto-cleanup wskaźników pisania (interval) żyje teraz WEWNĄTRZ
    // useTypingIndicator (własny useEffect, patrz komentarz w tamtym pliku
    // o drobnej, celowej różnicy: interval jest teraz związany z cyklem
    // życia komponentu, nie z (re)connectem kanału).

    // Funkcja sprzątająca — useRealtimeChannel wywoła ją przy rozłączaniu,
    // OBOK swojego własnego sprzątania (kanał, presence, heartbeat).
    return () => {
      cursors.reset();
      typing.reset();
      elementSync.reset();
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
  // 🧩 KROK 5: elementy (rysowanie) + sync całej tablicy nowemu userowi —
  // patrz komentarz na górze pliku i w useElementSync.ts. Ten hook też jest
  // odwoływany przez `registerListeners` przez domknięcie (ta sama zasada
  // bezpieczeństwa co przy cursors/typing/viewportTracking wyżej).
  const elementSync = useElementSync({ user: broadcastUser, safeBroadcast });

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

  // ───────────────────────────────────────────────────────────────────────
  // PROVIDER
  // ───────────────────────────────────────────────────────────────────────
  // 🧩 KROK 4+5: broadcast/subscribe/onRemote* dla kursorów, typing,
  // viewportów, elementów i sync idą teraz z osobnych hooków zamiast być
  // definiowane tutaj — patrz góra pliku.

  return (
    <BoardRealtimeContext.Provider
      value={{
        onlineUsers,
        isConnected,
        subscribeCursors: cursors.subscribeCursors,
        subscribeTyping: typing.subscribeTyping,
        subscribeViewports: viewportTracking.subscribeViewports,
        broadcastElementCreated: elementSync.broadcastElementCreated,
        broadcastElementUpdated: elementSync.broadcastElementUpdated,
        broadcastElementDeleted: elementSync.broadcastElementDeleted,
        broadcastElementsBatch: elementSync.broadcastElementsBatch,
        broadcastCursorMove: cursors.broadcastCursorMove,
        broadcastTypingStarted: typing.broadcastTypingStarted,
        broadcastTypingStopped: typing.broadcastTypingStopped,
        broadcastViewportChange: viewportTracking.broadcastViewportChange,
        onRemoteElementCreated: elementSync.onRemoteElementCreated,
        onRemoteElementUpdated: elementSync.onRemoteElementUpdated,
        onRemoteElementDeleted: elementSync.onRemoteElementDeleted,
        onRemoteElementsBatch: elementSync.onRemoteElementsBatch,
        onRemoteCursorMove: cursors.onRemoteCursorMove,
        broadcastSyncRequest: elementSync.broadcastSyncRequest,
        broadcastSyncResponse: elementSync.broadcastSyncResponse,
        onRemoteSyncRequest: elementSync.onRemoteSyncRequest,
        onRemoteSyncResponse: elementSync.onRemoteSyncResponse,
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
