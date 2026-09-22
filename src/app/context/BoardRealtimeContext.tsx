/**
 * src/app/context/BoardRealtimeContext.tsx
 *
 */

'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from '@/_new/lib/auth';

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

export type { RemoteCursor, TypingUser, RemoteViewport };

const BoardRealtimeContext = createContext<BoardRealtimeContextType | undefined>(undefined);

export function BoardRealtimeProvider({
  boardId,
  children,
  identity,
}: {
  boardId: string;
  children: ReactNode;
  identity?: { id: number; username: string; avatar_url?: string } | null;
}) {
  const { user: authUser } = useAuth();
  const user = identity ?? authUser;
  const broadcastUser = user ? { id: user.id, username: user.username } : null;

  const registerListeners: ChannelListenerSetup = (channel, currentUser) => {
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      presence.handlePresenceLeave(channel, currentUser.id, leftPresences);
    });

    channel
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
      });

    return () => {
      cursors.reset();
      typing.reset();
    };
  };

  const { channelRef, isConnected, onlineUsers } = useRealtimeChannel(
    boardId,
    user ? { id: user.id, username: user.username, avatar_url: (user as any).avatar_url } : null,
    registerListeners
  );

  const safeBroadcast = useSafeBroadcast(channelRef);

  const cursors = useCursors({ user: broadcastUser, safeBroadcast });
  const typing = useTypingIndicator({ user: broadcastUser, safeBroadcast });
  const viewportTracking = useViewportTracking({ user: broadcastUser, safeBroadcast });
  const presence = usePresence();

  useEffect(() => {
    const unsubscribeCursors = presence.onPresenceLeave(cursors.handlePresenceLeave);
    const unsubscribeTyping = presence.onPresenceLeave(typing.handlePresenceLeave);
    return () => {
      unsubscribeCursors();
      unsubscribeTyping();
    };
  }, [presence, cursors.handlePresenceLeave, typing.handlePresenceLeave]);

  return (
    <BoardRealtimeContext.Provider
      value={{
        onlineUsers,
        isConnected,
        subscribeCursors: cursors.subscribeCursors,
        subscribeTyping: typing.subscribeTyping,
        subscribeViewports: viewportTracking.subscribeViewports,
        broadcastCursorMove: cursors.broadcastCursorMove,
        broadcastTypingStarted: typing.broadcastTypingStarted,
        broadcastTypingStopped: typing.broadcastTypingStopped,
        broadcastViewportChange: viewportTracking.broadcastViewportChange,
        onRemoteCursorMove: cursors.onRemoteCursorMove,
      }}
    >
      {children}
    </BoardRealtimeContext.Provider>
  );
}

/**
 * useBoardRealtime - Hook do użycia w komponentach
 */
export function useBoardRealtime() {
  const context = useContext(BoardRealtimeContext);

  if (!context) {
    throw new Error(
      'useBoardRealtime musi być użyty wewnątrz BoardRealtimeProvider! ' +
        'Upewnij się że Twój komponent jest owinięty w <BoardRealtimeProvider>...</BoardRealtimeProvider>'
    );
  }

  return context;
}
