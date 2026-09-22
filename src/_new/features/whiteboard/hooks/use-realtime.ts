/**
 * use-realtime.ts
 *
 * Łączy komponent tablicy z Supabase Realtime przez BoardRealtimeContext.
 * Zarządza tylko prezencją: kursory, typingm viewport-follow.
 */

import { useEffect, useState, useRef } from 'react';
import { useBoardRealtime } from '@/app/context/BoardRealtimeContext';
import type { TypingUser, RemoteViewport } from '@/app/context/BoardRealtimeContext';

export type { TypingUser, RemoteViewport };

export interface UseRealtimeOptions {
  /** Callback gdy zdalny viewport się zmienia (dla follow mode) */
  onRemoteViewport: (x: number, y: number, scale: number, fromUserId: number) => void;
}

export interface UseRealtimeReturn {
  onlineUsers: ReturnType<typeof useBoardRealtime>['onlineUsers'];
  isConnected: boolean;
  broadcastCursorMove: (x: number, y: number) => Promise<void>;
  broadcastViewportChange: (x: number, y: number, scale: number) => Promise<void>;
  broadcastTypingStarted: (elementId: string) => Promise<void>;
  broadcastTypingStopped: (elementId: string) => Promise<void>;
  subscribeCursors: ReturnType<typeof useBoardRealtime>['subscribeCursors'];
  subscribeTyping: ReturnType<typeof useBoardRealtime>['subscribeTyping'];
  subscribeViewports: ReturnType<typeof useBoardRealtime>['subscribeViewports'];
  typingUsers: TypingUser[];
}

export function useRealtime(options: UseRealtimeOptions): UseRealtimeReturn {
  const {
    onlineUsers,
    isConnected,
    broadcastCursorMove,
    broadcastViewportChange,
    broadcastTypingStarted,
    broadcastTypingStopped,
    subscribeCursors,
    subscribeTyping,
    subscribeViewports,
  } = useBoardRealtime();

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const unsubscribe = subscribeTyping(setTypingUsers);
    return unsubscribe;
  }, [subscribeTyping]);

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
