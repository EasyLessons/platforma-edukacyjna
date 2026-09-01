/**
 * useRealtimeChannel — serce mechanizmu realtime tablicy.
 *
 * Krok 3 wydzielania `BoardRealtimeContext` (patrz docs/migration-status.md).
 *
 * ODPOWIADA ZA:
 * - otwarcie jednego kanału Supabase dla danej tablicy (board:{boardId})
 * - obsługę statusu połączenia (SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED)
 *   i licznik prób ponownego połączenia
 * - Presence: kto jest online (event 'sync' i 'join') + heartbeat co 60s
 * - sprzątanie po sobie przy odmontowaniu komponentu / zmianie tablicy
 *
 * CZEGO **NIE** ROBI (celowo):
 * - nie wie nic o kursorach, "kto pisze", viewportach ani o samym rysowaniu.
 *   Te rzeczy zostaną wydzielone w kolejnych krokach (useCursors, useTypingIndicator,
 *   useViewportTracking, useElementSync).
 *
 * JAK TO SIĘ SPINA Z RESZTĄ (WAŻNE):
 * Supabase wymaga, żeby WSZYSTKIE `channel.on(...)` były zarejestrowane
 * PRZED jednym wywołaniem `channel.subscribe()`. Nie da się więc, żeby każdy
 * przyszły hook (kursory, typing...) miał swój OSOBNY useEffect, który sam
 * czeka aż kanał powstanie i dopina swoje `.on(...)` — mogłoby się to zdarzyć
 * za późno.
 *
 * Dlatego ten hook przyjmuje `registerListeners` — funkcję, którą wywołuje
 * SAM, zaraz po utworzeniu kanału, ale PRZED subscribe(). To jest ten sam
 * pomysł co "rejestr narzędzi" w silniku tablicy (Strategy pattern z
 * docs/ai-context/whiteboard/how-to-add-tool.md) — tylko zamiast rejestrować
 * narzędzia rysowania, rejestrujemy "co ma się stać, gdy przyjdzie wiadomość
 * z kanału". `registerListeners` może zwrócić własną funkcję sprzątającą —
 * zostanie wywołana przy rozłączaniu, obok sprzątania samego kanału.
 *
 * Na razie (krok 3) Provider przekazuje tu JEDNĄ dużą funkcję rejestrującą
 * wszystko co jeszcze nie zostało wydzielone (elementy, kursory, typing,
 * viewport, sync). W kolejnych krokach ta funkcja będzie się kurczyć, aż
 * zniknie zupełnie.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { markOpened } from '@/_new/features/whiteboard/api/whiteboardApi';
import type { OnlineUser } from './types';
import { PRESENCE_HEARTBEAT_MS, PRESENCE_SYNC_DEBOUNCE_MS } from './constants';
import { log, logWarn, logDebug } from './logger';

export interface RealtimeUser {
  id: number;
  username: string;
  avatar_url?: string;
}

/**
 * Funkcja, którą inny moduł (na razie: reszta Providera) podaje, żeby dopiąć
 * swoje `channel.on(...)`. Dostaje gotowy, jeszcze niesubskrybowany kanał
 * i dane usera. Może zwrócić funkcję sprzątającą — zostanie wywołana przy
 * rozłączaniu kanału.
 */
export type ChannelListenerSetup = (
  channel: RealtimeChannel,
  user: RealtimeUser
) => void | (() => void);

export interface UseRealtimeChannelResult {
  channelRef: RefObject<RealtimeChannel | null>;
  isConnected: boolean;
  onlineUsers: OnlineUser[];
}

export function useRealtimeChannel(
  boardId: string,
  user: RealtimeUser | null,
  registerListeners: ChannelListenerSetup
): UseRealtimeChannelResult {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);
  const currentBoardIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const previousUsersRef = useRef<Map<number, OnlineUser>>(new Map());
  const presenceSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceHeartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Promise do czekania na gotowość kanału — w oryginalnym pliku było
  // przygotowane, ale nic go nigdy nie odczytywało (żaden `.then`/`await`
  // na tej zmiennej). Zostawiamy 1:1 (zero zmian zachowania w tym kroku),
  // ale to kandydat do wywalenia przy następnych porządkach.
  const channelReadyPromiseRef = useRef<Promise<void> | null>(null);
  const channelReadyResolveRef = useRef<(() => void) | null>(null);

  // `registerListeners` dostajemy jako parametr, ale nie chcemy żeby zmiana
  // jego tożsamości między renderami rozłączała i łączyła kanał od nowa —
  // dokładnie ten sam trik co przy handlerach w oryginalnym pliku (ref
  // zamiast zależności w useEffect).
  const registerListenersRef = useRef(registerListeners);
  registerListenersRef.current = registerListeners;

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

    log(`🔌 Łączenie z kanałem tablicy: board:${boardId}`);
    currentBoardIdRef.current = boardId;
    reconnectAttemptRef.current = 0;

    channelReadyPromiseRef.current = new Promise<void>((resolve) => {
      channelReadyResolveRef.current = resolve;
    });

    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: {
          self: false,
          // 🛠️ FIX (known-issues.md #2): było `false` — klient wysyłał i OD RAZU
          // uznawał to za sukces, nie czekając na żadne potwierdzenie od serwera.
          // Z `true` Supabase realnie odpowiada 'ok' | 'timed_out' | 'error', więc
          // `safeBroadcast` (useSafeBroadcast.ts) dostaje prawdziwą informację
          // i jego retry (3 próby) faktycznie ma sens zamiast być martwym kodem.
          ack: true,
        },
        presence: {
          key: user.id.toString(),
        },
      },
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 👥 PRESENCE — kto jest online (jedyna rzecz, którą ten hook śledzi
    // sam; "leave" zostaje na razie w registerListeners, bo dotyczy
    // sprzątania kursorów/typing, które nie są jeszcze wydzielone)
    // ═══════════════════════════════════════════════════════════════════════

    const handlePresenceSync = () => {
      if (presenceSyncTimeoutRef.current) {
        clearTimeout(presenceSyncTimeoutRef.current);
      }

      presenceSyncTimeoutRef.current = setTimeout(() => {
        const state = channel.presenceState();
        const usersMap = new Map<number, OnlineUser>();

        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            const onlineUser = presence as OnlineUser;
            usersMap.set(onlineUser.user_id, onlineUser);
          });
        });

        const prevUserIds = Array.from(previousUsersRef.current.keys()).sort().join(',');
        const newUserIds = Array.from(usersMap.keys()).sort().join(',');

        if (prevUserIds !== newUserIds) {
          const users = Array.from(usersMap.values());
          previousUsersRef.current = usersMap;
          setOnlineUsers(users);
          log(
            `👥 Użytkownicy online (${users.length}):`,
            users.map((u) => u.username)
          );
        }
      }, PRESENCE_SYNC_DEBOUNCE_MS);
    };

    channel
      .on('presence', { event: 'sync' }, handlePresenceSync)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const realNewUsers = newPresences.filter((p: any) => p.user_id !== user.id);
        if (realNewUsers.length > 0) {
          log(
            '🟢 Użytkownik dołączył:',
            realNewUsers.map((p: any) => p.username)
          );
        }
      });

    // ═══════════════════════════════════════════════════════════════════════
    // 🔌 tu wpinają się listenery, które jeszcze nie zostały wydzielone
    // (broadcast elementów/kursorów/typing/viewport/sync + presence "leave")
    // ═══════════════════════════════════════════════════════════════════════
    const extraCleanup = registerListenersRef.current(channel, user) ?? (() => {});

    // ═══════════════════════════════════════════════════════════════════════
    // 🚀 SUBSKRYPCJA
    // ═══════════════════════════════════════════════════════════════════════

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        reconnectAttemptRef.current = 0;
        setIsConnected(true);

        if (!isSubscribedRef.current) {
          log('✅ Połączono z kanałem tablicy');
          isSubscribedRef.current = true;
        } else {
          log('🔄 Reconnect do kanału tablicy');
        }

        if (channelReadyResolveRef.current) {
          channelReadyResolveRef.current();
        }

        const trackPresence = async (viewport?: { x: number; y: number; scale: number }) => {
          const presenceData: any = {
            user_id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
            online_at: new Date().toISOString(),
          };

          if (viewport) {
            presenceData.viewport_x = viewport.x;
            presenceData.viewport_y = viewport.y;
            presenceData.viewport_scale = viewport.scale;
          }

          try {
            await channel.track(presenceData);
          } catch {
            logDebug('Track presence skipped - channel reconnecting');
          }
        };

        await trackPresence();

        // Funkcja do update viewport (wywoływana z zewnątrz, np. przez
        // useViewportTracking, gdy zostanie wydzielony)
        (window as any).__updateViewportPresence = (x: number, y: number, scale: number) => {
          trackPresence({ x, y, scale });
        };

        markOpened(Number(boardId)).catch(() => {});

        if (presenceHeartbeatRef.current) clearInterval(presenceHeartbeatRef.current);
        presenceHeartbeatRef.current = setInterval(() => {
          trackPresence();
          markOpened(Number(boardId)).catch(() => {});
        }, PRESENCE_HEARTBEAT_MS);
      } else if (status === 'CHANNEL_ERROR') {
        if (reconnectAttemptRef.current === 0) {
          logDebug('⚠️ Tymczasowy błąd kanału - Supabase reconnecting...');
        }
        reconnectAttemptRef.current++;

        if (reconnectAttemptRef.current >= 10) {
          setIsConnected(false);
          logWarn('⚠️ Niestabilne połączenie realtime - używam fallback');
        }
      } else if (status === 'TIMED_OUT') {
        logDebug('⏰ Timeout - Supabase reconnecting...');
        reconnectAttemptRef.current++;
      } else if (status === 'CLOSED') {
        log('🔒 Kanał zamknięty');
        setIsConnected(false);
      }
    });

    channelRef.current = channel;

    return () => {
      extraCleanup();

      if (presenceHeartbeatRef.current) clearInterval(presenceHeartbeatRef.current);
      if (presenceSyncTimeoutRef.current) clearTimeout(presenceSyncTimeoutRef.current);
      channel.unsubscribe();
      channelRef.current = null;
      isSubscribedRef.current = false;
      currentBoardIdRef.current = null;
      setIsConnected(false);
      previousUsersRef.current = new Map();
      reconnectAttemptRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, user?.id, user?.username]);

  return { channelRef, isConnected, onlineUsers };
}
