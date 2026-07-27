/**
 * usePresence — sprzątanie po użytkowniku, który wyszedł z tablicy.
 *
 * Krok 4 wydzielania `BoardRealtimeContext` (patrz docs/migration-status.md).
 *
 * WAŻNE ROZRÓŻNIENIE: "kto jest online" (Presence sync/join, lista `onlineUsers`)
 * już wcześniej wyprowadzone do `useRealtimeChannel.ts` (Krok 3) — to NIE jest
 * tu. Ten hook robi coś węższego: gdy Supabase mówi "ten user wyszedł"
 * (Presence event 'leave'), inne mechanizmy (kursory, "kto pisze") muszą
 * posprzątać po nim swój stan — inaczej zostałby tam duch (kursor/wskaźnik
 * pisania kogoś, kogo już nie ma).
 *
 * DLACZEGO OSOBNY HOOK, A NIE PO PROSTU KOD W PROVIDERZE:
 * `useCursors`/`useTypingIndicator` nie wiedzą nawzajem o sobie i nie
 * powinny — każdy odpowiada tylko za swój kawałek stanu. Ale oba muszą
 * zareagować na TO SAMO zdarzenie ("user X wyszedł"). `usePresence` jest
 * tym wspólnym miejscem: `useCursors`/`useTypingIndicator` subskrybują się
 * przez `onPresenceLeave`, a Provider (jedyne miejsce, które faktycznie ma
 * dostęp do kanału Supabase) woła `handlePresenceLeave` z surowego
 * `channel.on('presence', { event: 'leave' }, ...)`.
 *
 * FILTR "GHOST LEAVE": Supabase potrafi wysłać 'leave' przy zwykłym
 * reconnect kanału, mimo że user nadal jest online — dlatego sprawdzamy
 * jeszcze raz aktualny `presenceState()`, zanim uznamy kogoś za faktycznie
 * nieobecnego. Zachowanie 1:1 przeniesione z oryginalnego pliku.
 */

import { useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { log } from './logger';

type LeaveCallback = (leftUserIds: number[]) => void;

export interface UsePresenceResult {
  /** Zarejestruj callback wywoływany z listą userId, którzy faktycznie wyszli. */
  onPresenceLeave: (callback: LeaveCallback) => () => void;
  /**
   * Woła się z `channel.on('presence', { event: 'leave' }, ({ leftPresences }) => ...)`
   * w Providerze. Filtruje "ghost leave" i fan-outuje do wszystkich zarejestrowanych
   * callbacków (useCursors, useTypingIndicator, ...).
   */
  handlePresenceLeave: (
    channel: RealtimeChannel,
    currentUserId: number,
    leftPresences: any[]
  ) => void;
}

export function usePresence(): UsePresenceResult {
  const leaveCallbacksRef = useRef<Set<LeaveCallback>>(new Set());

  const onPresenceLeave = useCallback((callback: LeaveCallback) => {
    leaveCallbacksRef.current.add(callback);
    return () => {
      leaveCallbacksRef.current.delete(callback);
    };
  }, []);

  const handlePresenceLeave = useCallback(
    (channel: RealtimeChannel, currentUserId: number, leftPresences: any[]) => {
      // 🛡️ Filtruj "ghost" leave events - sprawdź czy user naprawdę wyszedł.
      // Ghost leave może wystąpić przy reconnect kanału.
      const realLeftUsers = leftPresences.filter((p: any) => {
        // Nie reaguj na własne leave
        if (p.user_id === currentUserId) return false;
        // Sprawdź czy user nie jest już ponownie w presence state
        const currentState = channel.presenceState();
        const userStillPresent = Object.values(currentState).some((presences: any) =>
          presences.some((presence: any) => presence.user_id === p.user_id)
        );
        return !userStillPresent; // Tylko jeśli naprawdę wyszedł
      });

      if (realLeftUsers.length > 0) {
        log('🔴 Użytkownik wyszedł:', realLeftUsers.map((p: any) => p.username));
        const leftUserIds = realLeftUsers.map((p: any) => p.user_id);
        leaveCallbacksRef.current.forEach((callback) => callback(leftUserIds));
      }
    },
    []
  );

  return { onPresenceLeave, handlePresenceLeave };
}
