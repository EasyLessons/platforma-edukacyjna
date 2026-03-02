/**
 * realtime-api.ts
 * 
 * Czysta (bez Reacta) fabryka kanału Supabase Realtime dla tablicy.
 * 
 * Użycie:
 *   const channel = createBoardChannel(boardId, userId);
 *   channel.subscribe();
 *   channel.unsubscribe();
 */

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { DrawingElement } from '../types';

// ─── Typy eventów ───────────────────────────────────────────────────────────

export type BoardEvent =
  | { type: 'element-created';  element: DrawingElement;    userId: number; username: string }
  | { type: 'element-updated';  element: DrawingElement;    userId: number; username: string }
  | { type: 'element-deleted';  elementId: string;          userId: number; username: string }
  | { type: 'elements-batch';   elements: DrawingElement[]; userId: number; username: string }
  | { type: 'cursor-moved';     x: number; y: number;       userId: number; username: string }
  | { type: 'typing-started';   elementId: string;          userId: number; username: string }
  | { type: 'typing-stopped';   elementId: string;          userId: number; username: string }
  | {
      type: 'viewport-changed';
      x: number; y: number; scale: number;
      userId: number; username: string;
    };

export type BoardEventType = BoardEvent['type'];

// ─── Fabryka kanału ─────────────────────────────────────────────────────────

/**
 * Tworzy i zwraca kanał Supabase Realtime dla danej tablicy.
 * 
 * NIE subskrybuje automatycznie — wywołaj channel.subscribe() samodzielnie.
 * NIE rejestruje żadnych listenerów — rób to w hooku use-realtime.ts.
 */
export function createBoardChannel(
  boardId: string,
  userId: number,
): RealtimeChannel {
  return supabase.channel(`board:${boardId}`, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: userId.toString() },
    },
  });
}

// ─── Pomocnicze funkcje broadcast ───────────────────────────────────────────

/**
 * Wysyła event przez kanał.
 * Zwraca true jeśli sukces, false jeśli błąd (np. rozłączony kanał).
 */
export async function broadcastEvent(
  channel: RealtimeChannel,
  event: BoardEvent,
): Promise<boolean> {
  const result = await channel.send({
    type: 'broadcast',
    event: event.type,
    payload: event,
  });
  return result === 'ok';
}
