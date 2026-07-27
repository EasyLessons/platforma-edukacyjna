/**
 Typy współdzielone przez cały mechanizm realtime tablicy.
 */

import type { DrawingElement } from '@/_new/features/whiteboard/types';

/**
 * Zwykły `Partial<T>` NIE działa poprawnie na unii typów (`DrawingElement` to
 * unia 9 różnych interfejsów) — `keyof (A | B)` daje tylko klucze WSPÓLNE dla
 * wszystkich wariantów, więc `Partial<DrawingElement>` zgubiłby pola typowe
 * dla jednego wariantu (np. `src` u zdjęcia, `points` u ścieżki). Ten trik
 * ("naked" `T` w warunku wymusza dystrybucję po każdym wariancie z osobna)
 * daje zamiast tego `Partial<ImageElement> | Partial<Shape> | ...` — każdy
 * wariant zachowuje SWOJE pola jako opcjonalne.
 */
type DistributivePartial<T> = T extends unknown ? Partial<T> : never;

/**
 * Payload elementu wysyłany przez `element-updated`/`elements-batch`.
 *
 * Dlaczego nie zawsze pełny `DrawingElement`: dla zdjęć pole `src` to base64
 * (potrafi mieć setki KB) — a Supabase Broadcast ma twardy limit rozmiaru
 * wiadomości (patrz docs/known-issues.md #2). Przy zwykłym przesunięciu/
 * obrocie/resize zmienia się tylko geometria, więc NIE MA POWODU wysyłać
 * `src` ponownie — odbiorca już je ma (z `element-created` albo z pierwszego
 * wczytania tablicy). `DistributivePartial<DrawingElement>` pozwala wysłać
 * tylko to, co faktycznie się zmieniło; `id`/`type` są zawsze wymagane, żeby
 * odbiorca wiedział KTÓRY element scalić i jakim handlerem go obsłużyć.
 */
export type ElementBroadcastPayload = DistributivePartial<DrawingElement> &
  Pick<DrawingElement, 'id' | 'type'>;

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

/**
 * Wszystkie eventy, jakie mogą przelecieć przez kanał Supabase dla tablicy.
 *
 * To jest "discriminated union" (unia rozróżnialna) — każdy wariant ma inne pole `type`,
 * dzięki czemu TypeScript sam wie jakie pola są dostępne w danym wariancie
 * (np. po sprawdzeniu `event.type === 'cursor-moved'` wie, że jest `x` i `y`,
 * a nie ma `element`). To pozwala uniknąć błędów "undefined nie ma właściwości X".
 */
export type BoardEvent =
  | { type: 'element-created'; element: DrawingElement; userId: number; username: string }
  | { type: 'element-updated'; element: ElementBroadcastPayload; userId: number; username: string }
  | { type: 'element-deleted'; elementId: string; userId: number; username: string }
  | {
      type: 'elements-batch';
      elements: ElementBroadcastPayload[];
      /**
       * `true` = to update geometrii JUŻ ISTNIEJĄCYCH elementów (live drag) —
       * odbiorca ma scalać z lokalną kopią i IGNOROWAĆ elementy, których jeszcze
       * nie zna (bo bez pełnych danych stworzyłby zepsuty element).
       * `false`/brak = to tworzenie NOWYCH elementów — odbiorca ma je dodać,
       * bo `elements` ma wtedy zawsze pełne dane (patrz broadcastElementsBatch).
       */
      geometryOnly?: boolean;
      userId: number;
      username: string;
    }
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

  broadcastElementCreated: (element: DrawingElement) => Promise<void>;
  /** Zawsze wysyła tylko geometrię (bez `src` dla zdjęć) — patrz ElementBroadcastPayload. */
  broadcastElementUpdated: (element: DrawingElement) => Promise<void>;
  broadcastElementDeleted: (elementId: string) => Promise<void>;
  /**
   * `geometryOnly=true` (np. live drag wielu elementów) → wysyła tylko geometrię,
   * bez `src`. `geometryOnly=false` (domyślnie, np. tworzenie kilku elementów
   * naraz) → wysyła pełne dane, bo odbiorca nie ma ich jeszcze wcale.
   */
  broadcastElementsBatch: (elements: DrawingElement[], geometryOnly?: boolean) => Promise<void>;

  broadcastCursorMove: (x: number, y: number) => Promise<void>;

  broadcastTypingStarted: (elementId: string) => Promise<void>;
  broadcastTypingStopped: (elementId: string) => Promise<void>;
  subscribeTyping: (callback: (typingUsers: TypingUser[]) => void) => () => void;

  broadcastViewportChange: (x: number, y: number, scale: number) => Promise<void>;
  subscribeViewports: (callback: (viewports: RemoteViewport[]) => void) => () => void;

  onRemoteElementCreated: (
    handler: (element: DrawingElement, userId: number, username: string) => void
  ) => void;
  /** `element` może być NIEPEŁNY (bez `src` dla zdjęć) — scal z lokalną kopią, nie nadpisuj. */
  onRemoteElementUpdated: (
    handler: (element: ElementBroadcastPayload, userId: number, username: string) => void
  ) => void;
  onRemoteElementDeleted: (
    handler: (elementId: string, userId: number, username: string) => void
  ) => void;
  /**
   * Elementy mogą być NIEPEŁNE (geometria-only, gdy `geometryOnly=true`) —
   * scal z lokalną kopią, nie nadpisuj; a jeśli elementu jeszcze nie znasz
   * lokalnie przy `geometryOnly=true`, zignoruj go (bez pełnych danych
   * stworzyłbyś zepsuty element — prawdziwy dojdzie przez element-created).
   */
  onRemoteElementsBatch: (
    handler: (
      elements: ElementBroadcastPayload[],
      userId: number,
      username: string,
      geometryOnly: boolean
    ) => void
  ) => void;
  onRemoteCursorMove: (
    handler: (x: number, y: number, userId: number, username: string) => void
  ) => void;

  broadcastSyncRequest: () => Promise<void>;
  /** Wysyła elementy do targetUserId paczkami po SYNC_CHUNK_SIZE — omija limit 1MB Supabase */
  broadcastSyncResponse: (elements: DrawingElement[], targetUserId: number) => Promise<void>;
  onRemoteSyncRequest: (handler: (userId: number, username: string) => void) => void;
  onRemoteSyncResponse: (
    handler: (elements: DrawingElement[], userId: number, username: string) => void
  ) => void;
}
