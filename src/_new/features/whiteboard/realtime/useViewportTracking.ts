/**
 * useViewportTracking — widoki (viewport) innych użytkowników, dla "Follow Mode".
 *
 * Krok 4 wydzielania `BoardRealtimeContext` (patrz docs/migration-status.md).
 *
 * Ref + subscribers, nie `useState` — z tego samego powodu co w `useCursors`
 * i `useTypingIndicator`.
 *
 * Uwaga (zachowanie 1:1 z oryginału, nie coś co "zapomniałem"): w
 * przeciwieństwie do kursorów i typing, wpisy w `remoteViewportsRef` NIE są
 * czyszczone przy Presence 'leave' — tak było też w oryginalnym pliku.
 * Praktyczna konsekwencja jest znikoma (widok wychodzącego usera po prostu
 * przestaje się aktualizować i nikt go już nie czyta, bo nie ma go na liście
 * `onlineUsers`), ale nie zmieniam tego zachowania w tym kroku — to czysto
 * mechaniczne przeniesienie kodu, nie okazja do cichej naprawy czegoś innego.
 */

import { useCallback, useRef } from 'react';
import type { RemoteViewport } from './types';
import { THROTTLE_MS } from './constants';

export interface UseViewportTrackingOptions {
  user: { id: number; username: string } | null;
  safeBroadcast: (event: string, payload: unknown) => Promise<boolean>;
}

export interface UseViewportTrackingResult {
  broadcastViewportChange: (x: number, y: number, scale: number) => Promise<void>;
  subscribeViewports: (callback: (viewports: RemoteViewport[]) => void) => () => void;
  /** Woła się z `channel.on('broadcast', { event: 'viewport-changed' }, ...)` w Providerze. */
  handleViewportChanged: (x: number, y: number, scale: number, userId: number, username: string) => void;
}

export function useViewportTracking({
  user,
  safeBroadcast,
}: UseViewportTrackingOptions): UseViewportTrackingResult {
  const remoteViewportsRef = useRef<RemoteViewport[]>([]);
  const viewportSubscribersRef = useRef<Set<(viewports: RemoteViewport[]) => void>>(new Set());
  const lastViewportBroadcastRef = useRef(0);

  const notifyViewportSubscribers = useCallback(() => {
    viewportSubscribersRef.current.forEach((callback) => {
      callback(remoteViewportsRef.current);
    });
  }, []);

  const broadcastViewportChange = useCallback(
    async (x: number, y: number, scale: number) => {
      if (!user) return;

      // 🛡️ THROTTLE: ograniczenie częstotliwości viewport updates
      const now = Date.now();
      if (now - lastViewportBroadcastRef.current < THROTTLE_MS.VIEWPORT_CHANGE) {
        return; // Zbyt szybko - pomiń
      }

      lastViewportBroadcastRef.current = now;

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

  const subscribeViewports = useCallback((callback: (viewports: RemoteViewport[]) => void) => {
    viewportSubscribersRef.current.add(callback);
    callback(remoteViewportsRef.current);
    return () => {
      viewportSubscribersRef.current.delete(callback);
    };
  }, []);

  const handleViewportChanged = useCallback(
    (x: number, y: number, scale: number, userId: number, username: string) => {
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
    },
    [notifyViewportSubscribers]
  );

  return {
    broadcastViewportChange,
    subscribeViewports,
    handleViewportChanged,
  };
}
