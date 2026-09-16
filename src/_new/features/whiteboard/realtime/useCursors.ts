/**
 * useCursors — kursory innych użytkowników na tablicy.
 *
 * Krok 4 wydzielania `BoardRealtimeContext` (patrz docs/migration-status.md).
 *
 * Używa ref + subscribers (NIE `useState`) celowo — kursor porusza się
 * bardzo często (throttlowane, ale wciąż kilka razy/s na usera), więc
 * zwykły `useState` powodowałby re-render całego Providera (i przez to
 * wszystkiego, co z niego czyta) przy każdym ruchu myszką kogokolwiek.
 * Subskrybent (np. `remote-cursors.tsx`) dostaje nową listę przez callback
 * i sam decyduje, czy/jak się przerenderować — Provider się nie rusza.
 *
 * Zależności wstrzykiwane jako parametry (ten sam wzorzec co
 * `useRealtimeChannel`/`useSafeBroadcast`):
 *  - `user` — kto broadcastuje (musi być zalogowany, inaczej broadcast to no-op)
 *  - `safeBroadcast` — właściwa wysyłka z retry (useSafeBroadcast.ts)
 */

import { useCallback, useRef } from 'react';
import type { RemoteCursor } from './types';
import { THROTTLE_MS, CURSOR_COLORS } from './constants';

export interface UseCursorsOptions {
  user: { id: number; username: string } | null;
  safeBroadcast: (event: string, payload: unknown) => Promise<boolean>;
}

export interface UseCursorsResult {
  broadcastCursorMove: (x: number, y: number) => Promise<void>;
  subscribeCursors: (callback: (cursors: RemoteCursor[]) => void) => () => void;
  onRemoteCursorMove: (
    handler: (x: number, y: number, userId: number, username: string) => void
  ) => void;
  /** Woła się z `channel.on('broadcast', { event: 'cursor-moved' }, ...)` w Providerze. */
  handleCursorMoved: (x: number, y: number, userId: number, username: string) => void;
  /** Woła się z `usePresence().onPresenceLeave(...)` — usuwa kursory wychodzących userów. */
  handlePresenceLeave: (leftUserIds: number[]) => void;
  /** Reset przy rozłączaniu kanału (analogiczny do starego cleanupu w registerListeners). */
  reset: () => void;
}

export function useCursors({ user, safeBroadcast }: UseCursorsOptions): UseCursorsResult {
  const remoteCursorsRef = useRef<RemoteCursor[]>([]);
  const cursorSubscribersRef = useRef<Set<(cursors: RemoteCursor[]) => void>>(new Set());
  const lastCursorBroadcastRef = useRef(0);
  const cursorMoveHandlerRef = useRef<
    ((x: number, y: number, userId: number, username: string) => void) | null
  >(null);

  const notifyCursorSubscribers = useCallback(() => {
    cursorSubscribersRef.current.forEach((callback) => {
      callback(remoteCursorsRef.current);
    });
  }, []);

  const broadcastCursorMove = useCallback(
    async (x: number, y: number) => {
      if (!user) return;

      // 🛡️ THROTTLE: ograniczenie częstotliwości kursorów
      const now = Date.now();
      if (now - lastCursorBroadcastRef.current < THROTTLE_MS.CURSOR_MOVE) {
        return; // Zbyt szybko - pomiń
      }

      lastCursorBroadcastRef.current = now;

      await safeBroadcast('cursor-moved', {
        x,
        y,
        userId: user.id,
        username: user.username,
      });
    },
    [user, safeBroadcast]
  );

  const subscribeCursors = useCallback((callback: (cursors: RemoteCursor[]) => void) => {
    cursorSubscribersRef.current.add(callback);
    // Od razu wywołaj z aktualnym stanem
    callback(remoteCursorsRef.current);
    return () => {
      cursorSubscribersRef.current.delete(callback);
    };
  }, []);

  const onRemoteCursorMove = useCallback(
    (handler: (x: number, y: number, userId: number, username: string) => void) => {
      cursorMoveHandlerRef.current = handler;
    },
    []
  );

  const handleCursorMoved = useCallback(
    (x: number, y: number, userId: number, username: string) => {
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

      notifyCursorSubscribers();

      if (cursorMoveHandlerRef.current) {
        cursorMoveHandlerRef.current(x, y, userId, username);
      }
    },
    [notifyCursorSubscribers]
  );

  const handlePresenceLeave = useCallback(
    (leftUserIds: number[]) => {
      remoteCursorsRef.current = remoteCursorsRef.current.filter(
        (c) => !leftUserIds.includes(c.userId)
      );
      notifyCursorSubscribers();
    },
    [notifyCursorSubscribers]
  );

  const reset = useCallback(() => {
    remoteCursorsRef.current = [];
    cursorSubscribersRef.current.forEach((callback) => callback([]));
  }, []);

  return {
    broadcastCursorMove,
    subscribeCursors,
    onRemoteCursorMove,
    handleCursorMoved,
    handlePresenceLeave,
    reset,
  };
}
