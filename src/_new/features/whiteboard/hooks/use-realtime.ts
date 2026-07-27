/**
 * use-realtime.ts
 *
 * Łączy komponent tablicy z Supabase Realtime przez istniejący BoardRealtimeContext.
 *
 * ODPOWIEDZIALNOŚĆ:
 * - Rejestruje subskrypcje na zdalne eventy (element-created, updated, deleted)
 * - Przekazuje zdalne zmiany do callbacków które aktualizują lokalny stan elementów
 * - Eksponuje funkcje broadcast do użycia przez inne hooki
 * - Obsługuje typing indicator i viewport tracking (follow mode)
 *
 * NIE robi:
 * - Nie tworzy kanału Supabase (to robi BoardRealtimeContext)
 * - Nie przechowuje stanu elementów (to robi use-elements.ts)
 * - Nie zarządza viewportem (to robi use-viewport.ts)
 *
 * WYMAGA: Być wewnątrz <BoardRealtimeProvider>
 */

import { useEffect, useState, useRef } from 'react';
import { useBoardRealtime } from '@/app/context/BoardRealtimeContext';
import type { TypingUser, RemoteViewport } from '@/app/context/BoardRealtimeContext';
import type { ElementBroadcastPayload } from '@/_new/features/whiteboard/realtime/types';
import type { DrawingElement, ImageElement } from '../types';

// ─── Typy ────────────────────────────────────────────────────────────────────

export type { TypingUser, RemoteViewport };

export interface UseRealtimeOptions {
  /** Dodaj element który przyszedł od innego użytkownika */
  onRemoteElementAdded: (
    element: DrawingElement,
    userId: number,
    username: string
  ) => void;
  /**
   * Zaktualizuj element który zmienił się u innego użytkownika.
   * UWAGA: `element` może być NIEPEŁNY (bez `src` dla zdjęć — patrz
   * ElementBroadcastPayload i docs/known-issues.md #2) — scal z lokalną
   * kopią, nie nadpisuj całości.
   */
  onRemoteElementUpdated: (
    element: ElementBroadcastPayload,
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
  /**
   * Elementy mogą być NIEPEŁNE (geometria-only, gdy `geometryOnly=true`) —
   * scal z lokalną kopią; jeśli elementu jeszcze nie znasz lokalnie
   * przy `geometryOnly=true`, zignoruj go (patrz BoardRealtimeContext.tsx).
   */
  onElementsUpdated?: (elements: ElementBroadcastPayload[], geometryOnly: boolean) => void;
  // 🔥 DODANE [SYNC]:
  onSyncRequest?: (userId: number, username: string) => void;
  onSyncResponse?: (elements: DrawingElement[], userId: number, username: string) => void;
}

export interface UseRealtimeReturn {
  // Użytkownicy
  onlineUsers: ReturnType<typeof useBoardRealtime>['onlineUsers'];
  isConnected: boolean;
  // Broadcast — eksponowane do użycia przez inne hooki
  broadcastElementCreated: (element: DrawingElement) => Promise<void>;
  broadcastElementUpdated: (element: DrawingElement) => Promise<void>;
  broadcastElementDeleted: (elementId: string) => Promise<void>;
  /** `geometryOnly=true` (live drag) → bez `src` dla zdjęć, patrz BoardRealtimeContext.tsx. */
  broadcastElementsBatch: (elements: DrawingElement[], geometryOnly?: boolean) => Promise<void>;
  broadcastCursorMove: (x: number, y: number) => Promise<void>;
  broadcastViewportChange: (x: number, y: number, scale: number) => Promise<void>;
  broadcastTypingStarted: (elementId: string) => Promise<void>;
  broadcastTypingStopped: (elementId: string) => Promise<void>;
  broadcastSyncRequest: () => Promise<void>;
  broadcastSyncResponse: (elements: DrawingElement[], targetUserId: number) => Promise<void>;
  // Subskrypcje (subscribe pattern — nie powodują re-renderu context)
  subscribeCursors: ReturnType<typeof useBoardRealtime>['subscribeCursors'];
  subscribeTyping: ReturnType<typeof useBoardRealtime>['subscribeTyping'];
  subscribeViewports: ReturnType<typeof useBoardRealtime>['subscribeViewports'];
  // Stan
  typingUsers: TypingUser[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRealtime(options: UseRealtimeOptions): UseRealtimeReturn {

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
    onRemoteElementsBatch: registerRemoteBatch,
    broadcastSyncRequest,
    broadcastSyncResponse,
    onRemoteSyncRequest,
    onRemoteSyncResponse,
  } = useBoardRealtime();

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // 🔥 DODANE: Zawsze najświeższe referencje do funkcji! (Zabija Stale Closures)
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // ─── Subskrypcja: zdalne zmiany elementów ───────────────────────────────
  useEffect(() => {
    onRemoteElementCreated((element, userId, username) => {
      optionsRef.current.onRemoteElementAdded(element, userId, username);
      if (element.type === 'image' && (element as ImageElement).src) {
        optionsRef.current.onLoadRemoteImage(element.id, (element as ImageElement).src);
      }
    });
    
    registerRemoteUpdated((element, userId, username) => {
      optionsRef.current.onRemoteElementUpdated(element, userId, username);
    });
    
    registerRemoteDeleted((elementId, userId, username) => {
      optionsRef.current.onRemoteElementDeleted(elementId, userId, username);
    });
    
    if (registerRemoteBatch) {
      registerRemoteBatch((elements, userId, username, geometryOnly) => {
        if (optionsRef.current.onElementsUpdated) {
          optionsRef.current.onElementsUpdated(elements, geometryOnly);
        }
      });
    }

    if (onRemoteSyncRequest) {
      onRemoteSyncRequest((userId, username) => {
        if (optionsRef.current.onSyncRequest) {
          optionsRef.current.onSyncRequest(userId, username);
        }
      });
    }
    
    if (onRemoteSyncResponse) {
      onRemoteSyncResponse((elements, userId, username) => {
        if (optionsRef.current.onSyncResponse) {
          optionsRef.current.onSyncResponse(elements, userId, username);
        }
      });
    }
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
        optionsRef.current.onRemoteViewport(v.x, v.y, v.scale, v.userId);
      });
    });
    return unsubscribe;
  }, [subscribeViewports]);

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
    broadcastSyncRequest,
    broadcastSyncResponse,
  };
}