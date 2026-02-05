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
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { DrawingElement } from '@/app/tablica/whiteboard/types';

// ═══════════════════════════════════════════════════════════════════════════
// 📝 TYPY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Użytkownik online na tablicy
 */
interface OnlineUser {
  user_id: number;
  username: string;
  online_at: string;
  cursor_x?: number; // Opcjonalnie: pozycja kursora
  cursor_y?: number;
  viewport_x?: number; // 🆕 Viewport pozycja
  viewport_y?: number;
  viewport_scale?: number;
}

/**
 * Kursor innego użytkownika
 */
export interface RemoteCursor {
  userId: number;
  username: string;
  x: number;
  y: number;
  color: string;
  lastUpdate: number;
}

/**
 * 🆕 Użytkownik który obecnie edytuje element
 */
export interface TypingUser {
  userId: number;
  username: string;
  elementId: string;
}

/**
 * 🆕 Viewport innego użytkownika (dla Follow Mode)
 */
export interface RemoteViewport {
  userId: number;
  username: string;
  x: number;
  y: number;
  scale: number;
  lastUpdate: number;
}

/**
 * Typy eventów synchronizacji
 */
type BoardEvent =
  | { type: 'element-created'; element: DrawingElement; userId: number; username: string }
  | { type: 'element-updated'; element: DrawingElement; userId: number; username: string }
  | { type: 'element-deleted'; elementId: string; userId: number; username: string }
  | { type: 'elements-batch'; elements: DrawingElement[]; userId: number; username: string }
  | { type: 'cursor-moved'; x: number; y: number; userId: number; username: string }
  | { type: 'typing-started'; elementId: string; userId: number; username: string }
  | { type: 'typing-stopped'; elementId: string; userId: number; username: string }
  | {
      type: 'viewport-changed';
      x: number;
      y: number;
      scale: number;
      userId: number;
      username: string;
    };

/**
 * Context Type
 */
interface BoardRealtimeContextType {
  // Użytkownicy online
  onlineUsers: OnlineUser[];
  isConnected: boolean;

  // 🆕 Subskrypcja kursorów (nie powoduje re-renderów context!)
  subscribeCursors: (callback: (cursors: RemoteCursor[]) => void) => () => void;

  // Synchronizacja elementów
  broadcastElementCreated: (element: DrawingElement) => Promise<void>;
  broadcastElementUpdated: (element: DrawingElement) => Promise<void>;
  broadcastElementDeleted: (elementId: string) => Promise<void>;
  broadcastElementsBatch: (elements: DrawingElement[]) => Promise<void>;

  // Kursor
  broadcastCursorMove: (x: number, y: number) => Promise<void>;

  // 🆕 Typing indicator
  broadcastTypingStarted: (elementId: string) => Promise<void>;
  broadcastTypingStopped: (elementId: string) => Promise<void>;
  subscribeTyping: (callback: (typingUsers: TypingUser[]) => void) => () => void;

  // 🆕 Viewport tracking (dla Follow Mode)
  broadcastViewportChange: (x: number, y: number, scale: number) => Promise<void>;
  subscribeViewports: (callback: (viewports: RemoteViewport[]) => void) => () => void;

  // Handlery dla przychodzących eventów
  onRemoteElementCreated: (
    handler: (element: DrawingElement, userId: number, username: string) => void
  ) => void;
  onRemoteElementUpdated: (
    handler: (element: DrawingElement, userId: number, username: string) => void
  ) => void;
  onRemoteElementDeleted: (
    handler: (elementId: string, userId: number, username: string) => void
  ) => void;
  onRemoteElementsBatch: (
    handler: (elements: DrawingElement[], userId: number, username: string) => void
  ) => void;
  onRemoteCursorMove: (
    handler: (x: number, y: number, userId: number, username: string) => void
  ) => void;
}

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

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

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

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Refs do zapobiegania wielokrotnym polaczeniom
  const isSubscribedRef = useRef<boolean>(false);
  const currentBoardIdRef = useRef<string | null>(null);
  
  // Promise do czekania na gotowość kanału (używane tylko wewnętrznie w subscribe)
  const channelReadyPromiseRef = useRef<Promise<void> | null>(null);
  const channelReadyResolveRef = useRef<(() => void) | null>(null);

  // Ref do śledzenia poprzedniego stanu użytkowników (dla debounce)
  const previousUsersRef = useRef<Map<number, OnlineUser>>(new Map());
  const presenceSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const maxReconnectAttempts = 5;

  const { user } = useAuth();

  // Kolory dla kursorów (cyklicznie przydzielane)
  const cursorColors = useRef([
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
  ]);

  // 🛡️ THROTTLE - Ref do przechowywania ostatnich czasów broadcast
  const lastBroadcastTimeRef = useRef({
    elementUpdate: 0,
    cursorMove: 0,
    viewportChange: 0,
  });

  // 🛡️ TRAILING THROTTLE - przechowuj ostatnią wartość do wysłania
  const pendingElementUpdateRef = useRef<DrawingElement | null>(null);
  const pendingElementUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🛡️ THROTTLE - Limity częstotliwości (w ms)
  const THROTTLE_MS = {
    ELEMENT_UPDATE: 100, // Max 10 updates/s podczas operacji
    CURSOR_MOVE: 50, // Max 20 pozycji kursora/s
    VIEWPORT_CHANGE: 200, // Max 5 viewport updates/s
  };

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
    ((element: DrawingElement, userId: number, username: string) => void) | null
  >(null);
  const elementDeletedHandlerRef = useRef<
    ((elementId: string, userId: number, username: string) => void) | null
  >(null);
  const elementsBatchHandlerRef = useRef<
    ((elements: DrawingElement[], userId: number, username: string) => void) | null
  >(null);
  const cursorMoveHandlerRef = useRef<
    ((x: number, y: number, userId: number, username: string) => void) | null
  >(null);

  // ───────────────────────────────────────────────────────────────────────
  // POŁĄCZENIE Z SUPABASE
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !boardId) return;
    
    // Zapobiegaj wielokrotnemu połączeniu z tym samym boardem
    if (isSubscribedRef.current && currentBoardIdRef.current === boardId) {
      return;
    }
    
    // Jeśli zmieniamy board, zamknij poprzedni kanał
    if (channelRef.current && currentBoardIdRef.current !== boardId) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
      isSubscribedRef.current = false;
    }

    console.log(`🔌 Łączenie z kanałem tablicy: board:${boardId}`);
    currentBoardIdRef.current = boardId;

    // Reset reconnect counter przy nowym połączeniu
    reconnectAttemptRef.current = 0;
    
    // Utwórz Promise do czekania na gotowość kanału
    channelReadyPromiseRef.current = new Promise<void>((resolve) => {
      channelReadyResolveRef.current = resolve;
    });

    // Utwórz kanał dla tej tablicy z lepszą konfiguracją
    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: { 
          self: false,  // Nie odbieraj własnych broadcast (już mamy lokalnie)
          ack: false,   // Bez potwierdzenia (szybsze)
        },
        presence: { 
          key: user.id.toString(),
        },
      },
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 👥 PRESENCE - Śledzenie użytkowników online
    // ═══════════════════════════════════════════════════════════════════════

    // 🛡️ DEBOUNCED PRESENCE SYNC - zapobiega "migotaniu" przy niestabilnym połączeniu
    const handlePresenceSync = () => {
      // Anuluj poprzedni timeout jeśli istnieje
      if (presenceSyncTimeoutRef.current) {
        clearTimeout(presenceSyncTimeoutRef.current);
      }

      // Debounce 300ms - poczekaj na stabilizację
      presenceSyncTimeoutRef.current = setTimeout(() => {
        const state = channel.presenceState();
        const usersMap = new Map<number, OnlineUser>();

        // Konwertuj state na listę użytkowników (bez duplikatów)
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            const onlineUser = presence as OnlineUser;
            usersMap.set(onlineUser.user_id, onlineUser);
          });
        });

        // Porównaj z poprzednim stanem - aktualizuj tylko jeśli się zmienił
        const prevUserIds = Array.from(previousUsersRef.current.keys()).sort().join(',');
        const newUserIds = Array.from(usersMap.keys()).sort().join(',');

        if (prevUserIds !== newUserIds) {
          // Stan faktycznie się zmienił
          const users = Array.from(usersMap.values());
          previousUsersRef.current = usersMap;
          setOnlineUsers(users);
          console.log(
            `👥 Użytkownicy online (${users.length}):`,
            users.map((u) => u.username)
          );
        }
      }, 300); // 300ms debounce
    };

    channel
      .on('presence', { event: 'sync' }, handlePresenceSync)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Filtruj własne joiny i loguj tylko rzeczywiste nowe joiny
        const realNewUsers = newPresences.filter((p: any) => p.user_id !== user.id);
        if (realNewUsers.length > 0) {
          console.log('🟢 Użytkownik dołączył:', realNewUsers.map((p: any) => p.username));
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        // 🛡️ Filtruj "ghost" leave events - sprawdź czy user naprawdę wyszedł
        // Ghost leave może wystąpić przy reconnect kanału
        const realLeftUsers = leftPresences.filter((p: any) => {
          // Nie reaguj na własne leave
          if (p.user_id === user.id) return false;
          // Sprawdź czy user nie jest już ponownie w presence state
          const currentState = channel.presenceState();
          const userStillPresent = Object.values(currentState).some((presences: any) =>
            presences.some((presence: any) => presence.user_id === p.user_id)
          );
          return !userStillPresent; // Tylko jeśli naprawdę wyszedł
        });

        if (realLeftUsers.length > 0) {
          console.log('🔴 Użytkownik wyszedł:', realLeftUsers.map((p: any) => p.username));
          // Usuń kursory tylko naprawdę wychodzących użytkowników
          const leftUserIds = realLeftUsers.map((p: any) => p.user_id);
          remoteCursorsRef.current = remoteCursorsRef.current.filter(
            (c) => !leftUserIds.includes(c.userId)
          );
          notifyCursorSubscribers();
        }
      });

    // ═══════════════════════════════════════════════════════════════════════
    // 🔄 BROADCAST - Synchronizacja elementów
    // ═══════════════════════════════════════════════════════════════════════

    channel
      .on('broadcast', { event: 'element-created' }, ({ payload }) => {
        const { element, userId, username } = payload as BoardEvent & { type: 'element-created' };

        // Ignoruj własne eventy (już mamy lokalnie)
        if (userId === user.id) return;

        console.log(
          `📥 Otrzymano element-created od ${username}:`,
          element.id,
          `(typ: ${element.type})`
        );

        // Wywołaj handler (jeśli zarejestrowany)
        if (elementCreatedHandlerRef.current) {
          elementCreatedHandlerRef.current(element, userId, username);
        }
      })
      .on('broadcast', { event: 'element-updated' }, ({ payload }) => {
        const { element, userId, username } = payload as BoardEvent & { type: 'element-updated' };

        if (userId === user.id) return;

        console.log(`📥 Otrzymano element-updated od ${username}:`, element.id);

        if (elementUpdatedHandlerRef.current) {
          elementUpdatedHandlerRef.current(element, userId, username);
        }
      })
      .on('broadcast', { event: 'element-deleted' }, ({ payload }) => {
        const { elementId, userId, username } = payload as BoardEvent & { type: 'element-deleted' };

        if (userId === user.id) return;

        console.log(`📥 Otrzymano element-deleted od ${username}:`, elementId);

        if (elementDeletedHandlerRef.current) {
          elementDeletedHandlerRef.current(elementId, userId, username);
        }
      })
      .on('broadcast', { event: 'elements-batch' }, ({ payload }) => {
        const { elements, userId, username } = payload as BoardEvent & { type: 'elements-batch' };

        if (userId === user.id) return;

        console.log(`📥 Otrzymano elements-batch od ${username}: ${elements.length} elementów`);

        if (elementsBatchHandlerRef.current) {
          elementsBatchHandlerRef.current(elements, userId, username);
        }
      })
      .on('broadcast', { event: 'cursor-moved' }, ({ payload }) => {
        const { x, y, userId, username } = payload as BoardEvent & { type: 'cursor-moved' };

        if (userId === user.id) return;

        // Automatycznie aktualizuj remote cursors (używamy ref zamiast state!)
        const prev = remoteCursorsRef.current;
        const existing = prev.find((c) => c.userId === userId);
        const color = existing?.color || cursorColors.current[userId % cursorColors.current.length];

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

        console.log(`✏️ [TYPING] ${username} zaczął edytować element ${elementId}`);

        if (userId === user.id) return;

        // Dodaj do listy (jeśli jeszcze nie ma)
        const exists = typingUsersRef.current.some(
          (t) => t.userId === userId && t.elementId === elementId
        );
        if (!exists) {
          typingUsersRef.current = [...typingUsersRef.current, { userId, username, elementId }];
          console.log(`✏️ [TYPING] Aktualna lista:`, typingUsersRef.current);
          notifyTypingSubscribers();
        }
      })
      // 🆕 TYPING INDICATOR - ktoś skończył edytować
      .on('broadcast', { event: 'typing-stopped' }, ({ payload }) => {
        const { elementId, userId } = payload as BoardEvent & { type: 'typing-stopped' };

        console.log(`✏️ [TYPING] User ${userId} skończył edytować element ${elementId}`);

        if (userId === user.id) return;

        // Usuń z listy
        typingUsersRef.current = typingUsersRef.current.filter(
          (t) => !(t.userId === userId && t.elementId === elementId)
        );
        console.log(`✏️ [TYPING] Aktualna lista po usunięciu:`, typingUsersRef.current);
        notifyTypingSubscribers();
      })
      // 🆕 VIEWPORT CHANGED - ktoś zmienił swój viewport (dla Follow Mode)
      .on('broadcast', { event: 'viewport-changed' }, ({ payload }) => {
        const { x, y, scale, userId, username } = payload as BoardEvent & {
          type: 'viewport-changed';
        };

        if (userId === user.id) return;

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
      });

    // ═══════════════════════════════════════════════════════════════════════
    // 🚀 SUBSKRYPCJA
    // ═══════════════════════════════════════════════════════════════════════

    let presenceHeartbeat: NodeJS.Timeout | null = null;

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // RESET licznika przy udanym połączeniu!
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
        
        // Loguj tylko pierwsze połączenie, nie reconnecty
        if (!isSubscribedRef.current) {
          console.log('✅ Połączono z kanałem tablicy');
          isSubscribedRef.current = true;
        } else {
          console.log('🔄 Reconnect do kanału tablicy');
        }
        
        // KLUCZOWE: Rozwiąż Promise - kanał jest gotowy do broadcast!
        if (channelReadyResolveRef.current) {
          channelReadyResolveRef.current();
        }

        // Wyślij swoją obecność (Presence) z viewport
        const trackPresence = async (viewport?: { x: number; y: number; scale: number }) => {
          const presenceData: any = {
            user_id: user.id,
            username: user.username,
            online_at: new Date().toISOString(),
          };

          // Dodaj viewport jeśli jest dostępny
          if (viewport) {
            presenceData.viewport_x = viewport.x;
            presenceData.viewport_y = viewport.y;
            presenceData.viewport_scale = viewport.scale;
          }

          try {
            await channel.track(presenceData);
          } catch (err) {
            // Ignoruj błędy track - kanał może być w trakcie reconnect
            console.debug('Track presence skipped - channel reconnecting');
          }
        };

        await trackPresence();

        // Funkcja do update viewport (może być wywołana z zewnątrz)
        (window as any).__updateViewportPresence = (x: number, y: number, scale: number) => {
          trackPresence({ x, y, scale });
        };

        // Heartbeat co 60 sekund - Supabase ma własny heartbeat, nie potrzebujemy częstego
        if (presenceHeartbeat) clearInterval(presenceHeartbeat);
        presenceHeartbeat = setInterval(() => trackPresence(), 60000);
      } else if (status === 'CHANNEL_ERROR') {
        // 🛡️ Supabase ma auto-reconnect - nie panikuj
        // Loguj tylko przy pierwszym błędzie w serii
        if (reconnectAttemptRef.current === 0) {
          console.debug('⚠️ Tymczasowy błąd kanału - Supabase reconnecting...');
        }
        reconnectAttemptRef.current++;
        
        // Ustaw isConnected na false tylko po wielu nieudanych próbach
        if (reconnectAttemptRef.current >= 10) {
          setIsConnected(false);
          console.warn('⚠️ Niestabilne połączenie realtime - używam fallback');
        }
      } else if (status === 'TIMED_OUT') {
        console.debug('⏰ Timeout - Supabase reconnecting...');
        reconnectAttemptRef.current++;
      } else if (status === 'CLOSED') {
        console.log('🔒 Kanał zamknięty');
        setIsConnected(false);
      }
    });

    channelRef.current = channel;

    // ═══════════════════════════════════════════════════════════════════════
    // ⏰ CLEANUP NIEAKTYWNYCH KURSORÓW - WYŁĄCZONY
    // ═══════════════════════════════════════════════════════════════════════
    // Kursory są czyszczone tylko gdy użytkownik opuści tablicę (presence.leave)
    // Nie używamy timeoutu bo kursor ma być widoczny cały czas gdy user jest online

    // const cursorCleanupInterval = setInterval(() => {
    //   const now = Date.now()
    //   const CURSOR_TIMEOUT = 600000 // 10 minut
    //   setRemoteCursors(prev => prev.filter(c => now - c.lastUpdate < CURSOR_TIMEOUT))
    // }, 60000)

    // ═══════════════════════════════════════════════════════════════════════
    // 🧹 CLEANUP
    // ═══════════════════════════════════════════════════════════════════════

    return () => {
      console.log('🔌 Rozłączanie z kanału tablicy');
      if (presenceHeartbeat) clearInterval(presenceHeartbeat);
      if (presenceSyncTimeoutRef.current) clearTimeout(presenceSyncTimeoutRef.current);
      if (pendingElementUpdateTimeoutRef.current) clearTimeout(pendingElementUpdateTimeoutRef.current);
      channel.unsubscribe();
      channelRef.current = null;
      isSubscribedRef.current = false;
      currentBoardIdRef.current = null;
      setIsConnected(false);
      remoteCursorsRef.current = [];
      previousUsersRef.current = new Map();
      reconnectAttemptRef.current = 0;
      pendingElementUpdateRef.current = null;
      // Notyfikuj subscriberów o pustej liście kursorów
      cursorSubscribersRef.current.forEach((callback) => callback([]));
    };
  }, [boardId, user?.id, user?.username]);

  // ───────────────────────────────────────────────────────────────────────
  // FUNKCJE BROADCAST (wysyłanie do innych użytkowników)
  // ───────────────────────────────────────────────────────────────────────

  // 🛡️ RESILIENT BROADCAST z automatycznym retry w tle
  // - Wysyła natychmiast (0 latency)
  // - Jeśli nie uda się wysłać, próbuje ponownie w tle
  const safeBroadcast = useCallback(async (event: string, payload: any): Promise<boolean> => {
    const channel = channelRef.current;
    if (!channel) {
      console.warn(`📤 [BROADCAST] ❌ Brak kanału dla ${event}`);
      return false;
    }

    const sendMessage = async (): Promise<boolean> => {
      try {
        await channel.send({
          type: 'broadcast',
          event,
          payload,
        });
        return true;
      } catch (err) {
        return false;
      }
    };

    // Pierwsza próba - natychmiastowa
    const success = await sendMessage();
    
    if (!success) {
      // Retry w tle - nie blokuje, nie dodaje latency do UI
      // Tylko dla ważnych eventów (nie cursor/viewport)
      const isImportant = event.startsWith('element-');
      if (isImportant) {
        setTimeout(async () => {
          const retry1 = await sendMessage();
          if (!retry1) {
            setTimeout(async () => {
              const retry2 = await sendMessage();
              if (!retry2) {
                console.warn(`📤 [BROADCAST] ❌ Nie udało się wysłać ${event} po 3 próbach`);
              }
            }, 200);
          }
        }, 100);
      }
    }
    
    return success;
  }, []);

  const broadcastElementCreated = useCallback(
    async (element: DrawingElement) => {
      if (!user) return;

      console.log(`📤 [BROADCAST] Wysyłam element-created: ${element.id} (typ: ${element.type})`);

      const success = await safeBroadcast('element-created', {
        element,
        userId: user.id,
        username: user.username,
      });

      if (!success) {
        console.warn(`📤 [BROADCAST] ❌ Nie udało się wysłać element-created: ${element.id}`);
      }
    },
    [user, safeBroadcast]
  );

  const broadcastElementUpdated = useCallback(
    async (element: DrawingElement) => {
      if (!user) return;

      const now = Date.now();
      const timeSinceLastBroadcast = now - lastBroadcastTimeRef.current.elementUpdate;

      // 🛡️ TRAILING THROTTLE: zawsze zapisz ostatnią wartość
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
          element,
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
                element: pendingElement,
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
    async (elements: DrawingElement[]) => {
      if (!user) return;

      await safeBroadcast('elements-batch', {
        elements,
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
    (handler: (element: DrawingElement, userId: number, username: string) => void) => {
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
    (handler: (elements: DrawingElement[], userId: number, username: string) => void) => {
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
