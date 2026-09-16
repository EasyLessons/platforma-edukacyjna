/**
 * ============================================================================
 * use-demo-session.ts - hook spinajacy sesje demo
 * ============================================================================
 *
 * Daje stronie dwie rzeczy: boardId kanalu (`demo-<sessionId>`) oraz tozsamosc
 * goscia. Tozsamosc powstaje w useEffect, a nie przy pierwszym renderze -
 * inaczej serwer (SSR) i przegladarka wylosowalyby rozne id i React zglosilby
 * blad hydracji.
 *
 * Dopoki `guest` jest null, strona nie powinna montowac Providera realtime:
 * bez tozsamosci kanal i tak nie wystartuje (useRealtimeChannel wychodzi na
 * `if (!user || !boardId) return`).
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import { getOrCreateGuestIdentity, type GuestIdentity } from './guest-identity';
import { toDemoBoardId } from './is-demo-board';

export interface DemoSession {
  /** boardId przekazywany do BoardRealtimeProvider i WhiteboardCanvas. */
  boardId: string;
  /** Tozsamosc goscia; null dopoki nie wykona sie efekt po stronie klienta. */
  guest: GuestIdentity | null;
  /** true zanim tozsamosc bedzie gotowa - do pokazania spinnera. */
  isLoading: boolean;
}

export function useDemoSession(sessionId: string): DemoSession {
  const [guest, setGuest] = useState<GuestIdentity | null>(null);

  useEffect(() => {
    setGuest(getOrCreateGuestIdentity());
  }, []);

  const boardId = useMemo(() => toDemoBoardId(sessionId), [sessionId]);

  return { boardId, guest, isLoading: guest === null };
}
