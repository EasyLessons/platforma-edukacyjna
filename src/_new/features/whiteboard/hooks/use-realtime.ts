/**
 * use-realtime.ts
 *
 * Łączy komponent tablicy z Supabase Realtime przez istniejący BoardRealtimeContext.
 *
 * ODPOWIEDZIALNOŚĆ:
 *  - Rejestruje subskrypcje na zdalne eventy (element-created, updated, deleted)
 *  - Przekazuje zdalne zmiany do callbacków które aktualizują lokalny stan elementów
 *  - Eksponuje funkcje broadcast do użycia przez inne hooki
 *  - Obsługuje typing indicator i viewport tracking (follow mode)
 *
 * NIE robi:
 *  - Nie tworzy kanału Supabase (to robi BoardRealtimeContext)
 *  - Nie przechowuje stanu elementów (to robi use-elements.ts)
 *  - Nie zarządza viewportem (to robi use-viewport.ts)
 *
 * WYMAGA: Być wewnątrz <BoardRealtimeProvider>
 */

import { useEffect, useState } from 'react';
import { useBoardRealtime } from '@/app/context/BoardRealtimeContext';
import type { TypingUser, RemoteViewport } from '@/app/context/BoardRealtimeContext';
import type { DrawingElement, ImageElement } from '../types';
import type { BoardElementWithAuthor } from '../api/elements-api';

// ─── Typy ────────────────────────────────────────────────────────────────────

export type { TypingUser, RemoteViewport };

export interface UseRealtimeOptions {
  /** Dodaj element który przyszedł od innego użytkownika */
  onRemoteElementAdded: (
    element: DrawingElement,
    userId: number,
    username: string
  ) => void;
  /** Zaktualizuj element który zmienił się u innego użytkownika */
  onRemoteElementUpdated: (
    element: DrawingElement,
    userId: number,
    username: string
  ) => void;
  /** Usuń element który skasował inny użytkownik */
  onRemoteElementDeleted: (
    elementId: string,
    userId: number,
    username: string
  ) => void;
  /** Załaduj zdalne obrazy do cache loadedImages */
  onLoadRemoteImage: (id: string, src: string) => void;
  /** Callback gdy zdalny viewport się zmienia (dla follow mode) */
  onRemoteViewport: (x: number, y: number, scale: number, fromUserId: number) => void;
}

export interface UseRealtimeReturn {
  // Użytkownicy
  onlineUsers: ReturnType<typeof useBoardRealtime>['onlineUsers'];
  isConnected: boolean;
  // Broadcast — eksponowane do użycia przez inne hooki
  broadcastElementCreated: (element: DrawingElement) => Promise<void>;
  broadcastElementUpdated: (element: DrawingElement) => Promise<void>;
  broadcastElementDeleted: (elementId: string) => Promise<void>;
  broadcastElementsBatch: (elements: DrawingElement[]) => Promise<void>;
  broadcastCursorMove: (x: number, y: number) => Promise<void>;
  broadcastViewportChange: (x: number, y: number, scale: number) => Promise<void>;
  broadcastTypingStarted: (elementId: string) => Promise<void>;
  broadcastTypingStopped: (elementId: string) => Promise<void>;
  // Subskrypcje (subscribe pattern — nie powodują re-renderu context)
  subscribeCursors: ReturnType<typeof useBoardRealtime>['subscribeCursors'];
  subscribeTyping: ReturnType<typeof useBoardRealtime>['subscribeTyping'];
  subscribeViewports: ReturnType<typeof useBoardRealtime>['subscribeViewports'];
  // Stan
  typingUsers: TypingUser[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRealtime({
  onRemoteElementAdded,
  onRemoteElementUpdated,
  onRemoteElementDeleted,
  onLoadRemoteImage,
  onRemoteViewport,
}: UseRealtimeOptions): UseRealtimeReturn {

  const {
    onlineUsers,
    isConnected,
    broadcastElementCreated,
    broadcastElementUpdated,
    broadcastElementDeleted,
    broadcastElementsBatch,
    broadcastCursorMove,
    broadcastViewportChange,
    broadcastTypingStarted,
    broadcastTypingStopped,
    subscribeCursors,
    subscribeTyping,
    subscribeViewports,
    onRemoteElementCreated,
    onRemoteElementUpdated: registerRemoteUpdated,
    onRemoteElementDeleted: registerRemoteDeleted,
  } = useBoardRealtime();

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // ─── Subskrypcja: zdalne zmiany elementów ───────────────────────────────
  useEffect(() => {
    onRemoteElementCreated((element, userId, username) => {
      onRemoteElementAdded(element, userId, username);
      // Jeśli to obraz — załaduj go do cache
      if (element.type === 'image' && (element as ImageElement).src) {
        onLoadRemoteImage(element.id, (element as ImageElement).src);
      }
    });
    registerRemoteUpdated((element, userId, username) => {
      onRemoteElementUpdated(element, userId, username);
    });
    registerRemoteDeleted((elementId, userId, username) => {
      onRemoteElementDeleted(elementId, userId, username);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Subskrypcja: typing indicator ──────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeTyping(setTypingUsers);
    return unsubscribe;
  }, [subscribeTyping]);

  // ─── Subskrypcja: viewport innych użytkowników (follow mode) ─────────────
  useEffect(() => {
    const unsubscribe = subscribeViewports((viewports) => {
      viewports.forEach((v) => {
        onRemoteViewport(v.x, v.y, v.scale, v.userId);
      });
    });
    return unsubscribe;
  }, [subscribeViewports, onRemoteViewport]);

  return {
    onlineUsers,
    isConnected,
    broadcastElementCreated,
    broadcastElementUpdated,
    broadcastElementDeleted,
    broadcastElementsBatch,
    broadcastCursorMove,
    broadcastViewportChange,
    broadcastTypingStarted,
    broadcastTypingStopped,
    subscribeCursors,
    subscribeTyping,
    subscribeViewports,
    typingUsers,
  };
}
