/**
 Typy współdzielone przez cały mechanizm realtime tablicy.
 */

/** Użytkownik online na tablicy (dane z Supabase Presence) */
export interface OnlineUser {
  user_id: number;
  username: string;
  avatar_url?: string;
  online_at: string;
  cursor_x?: number;
  cursor_y?: number;
  viewport_x?: number;
  viewport_y?: number;
  viewport_scale?: number;
}

/** Kursor innego użytkownika na tablicy */
export interface RemoteCursor {
  userId: number;
  username: string;
  x: number;
  y: number;
  color: string;
  lastUpdate: number;
}

/**
 * Użytkownik, który obecnie edytuje element (np. wpisuje tekst).
 * lastSeen: timestamp (ms) ostatniego "typing-started" — używany do auto-cleanup.
 */
export interface TypingUser {
  userId: number;
  username: string;
  elementId: string;
  lastSeen: number;
}

/** Widok (viewport) innego użytkownika — używane w trybie "podążaj za userem" */
export interface RemoteViewport {
  userId: number;
  username: string;
  x: number;
  y: number;
  scale: number;
  lastUpdate: number;
}

/** Eventy, jakie mogą przelecieć przez kanał Supabase dla tablicy. */
export type BoardEvent =
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

/** Kształt wartości zwracanej przez useBoardRealtime() / dostępnej w Context */
export interface BoardRealtimeContextType {
  onlineUsers: OnlineUser[];
  isConnected: boolean;

  subscribeCursors: (callback: (cursors: RemoteCursor[]) => void) => () => void;
  broadcastCursorMove: (x: number, y: number) => Promise<void>;

  broadcastTypingStarted: (elementId: string) => Promise<void>;
  broadcastTypingStopped: (elementId: string) => Promise<void>;
  subscribeTyping: (callback: (typingUsers: TypingUser[]) => void) => () => void;

  broadcastViewportChange: (x: number, y: number, scale: number) => Promise<void>;
  subscribeViewports: (callback: (viewports: RemoteViewport[]) => void) => () => void;

  onRemoteCursorMove: (
    handler: (x: number, y: number, userId: number, username: string) => void
  ) => void;
}
