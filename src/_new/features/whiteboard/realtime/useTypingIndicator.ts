/**
 * useTypingIndicator — "kto teraz edytuje ten element" (np. notatkę tekstową).
 *
 * Krok 4 wydzielania `BoardRealtimeContext` (patrz docs/migration-status.md).
 *
 * Ref + subscribers, nie `useState` — z tego samego powodu co w `useCursors`:
 * unikamy re-renderu całego Providera przy każdym "zaczął pisać"/"skończył pisać".
 *
 * AUTO-CLEANUP: co `TYPING_CLEANUP_INTERVAL_MS` usuwamy wpisy starsze niż
 * `TYPING_TIMEOUT_MS` — zabezpieczenie na wypadek, gdy ktoś zamknie kartę
 * bez wysłania `typing-stopped` (inaczej zostałby "duch" na zawsze).
 *
 * 🛠️ Drobna, celowa zmiana zachowania względem oryginału: w starym pliku ten
 * interval startował/kończył się razem z (re)connectem kanału Supabase
 * (bo żył w `registerListeners`, wołanym przy każdym connect). Tutaj żyje
 * przez cały czas życia komponentu (`useEffect` z pustą tablicą zależności)
 * — prostsze, i funkcjonalnie różni się tylko tym, że interval nie restartuje
 * się przy reconnect (co i tak nie miało znaczenia, bo tylko czyści stare
 * wpisy — restart niczego by nie zmienił).
 */

import { useCallback, useEffect, useRef } from 'react';
import type { TypingUser } from './types';
import { TYPING_TIMEOUT_MS, TYPING_CLEANUP_INTERVAL_MS } from './constants';
import { log } from './logger';

export interface UseTypingIndicatorOptions {
  user: { id: number; username: string } | null;
  safeBroadcast: (event: string, payload: unknown) => Promise<boolean>;
}

export interface UseTypingIndicatorResult {
  broadcastTypingStarted: (elementId: string) => Promise<void>;
  broadcastTypingStopped: (elementId: string) => Promise<void>;
  subscribeTyping: (callback: (typingUsers: TypingUser[]) => void) => () => void;
  /** Woła się z `channel.on('broadcast', { event: 'typing-started' }, ...)` w Providerze. */
  handleTypingStarted: (elementId: string, userId: number, username: string) => void;
  /** Woła się z `channel.on('broadcast', { event: 'typing-stopped' }, ...)` w Providerze. */
  handleTypingStopped: (elementId: string, userId: number) => void;
  /** Woła się z `usePresence().onPresenceLeave(...)` — usuwa wskaźniki wychodzących userów. */
  handlePresenceLeave: (leftUserIds: number[]) => void;
  /** Reset przy rozłączaniu kanału. */
  reset: () => void;
}

export function useTypingIndicator({
  user,
  safeBroadcast,
}: UseTypingIndicatorOptions): UseTypingIndicatorResult {
  const typingUsersRef = useRef<TypingUser[]>([]);
  const typingSubscribersRef = useRef<Set<(typing: TypingUser[]) => void>>(new Set());

  const notifyTypingSubscribers = useCallback(() => {
    typingSubscribersRef.current.forEach((callback) => {
      callback(typingUsersRef.current);
    });
  }, []);

  const broadcastTypingStarted = useCallback(
    async (elementId: string) => {
      if (!user) return;
      await safeBroadcast('typing-started', {
        elementId,
        userId: user.id,
        username: user.username,
      });
    },
    [user, safeBroadcast]
  );

  const broadcastTypingStopped = useCallback(
    async (elementId: string) => {
      if (!user) return;
      await safeBroadcast('typing-stopped', {
        elementId,
        userId: user.id,
        username: user.username,
      });
    },
    [user, safeBroadcast]
  );

  const subscribeTyping = useCallback((callback: (typingUsers: TypingUser[]) => void) => {
    typingSubscribersRef.current.add(callback);
    callback(typingUsersRef.current);
    return () => {
      typingSubscribersRef.current.delete(callback);
    };
  }, []);

  const handleTypingStarted = useCallback(
    (elementId: string, userId: number, username: string) => {
      log(`✏️ [TYPING] ${username} zaczął edytować element ${elementId}`);

      const now = Date.now();
      const existingIndex = typingUsersRef.current.findIndex(
        (t) => t.userId === userId && t.elementId === elementId
      );

      if (existingIndex === -1) {
        // Nowy wpis — dodaj z aktualnym timestampem
        typingUsersRef.current = [
          ...typingUsersRef.current,
          { userId, username, elementId, lastSeen: now },
        ];
      } else {
        // Już istnieje — odśwież lastSeen żeby timer nie usunął aktywnego użytkownika
        typingUsersRef.current = typingUsersRef.current.map((t, i) =>
          i === existingIndex ? { ...t, lastSeen: now } : t
        );
      }

      log(`✏️ [TYPING] Aktualna lista:`, typingUsersRef.current);
      notifyTypingSubscribers();
    },
    [notifyTypingSubscribers]
  );

  const handleTypingStopped = useCallback(
    (elementId: string, userId: number) => {
      log(`✏️ [TYPING] User ${userId} skończył edytować element ${elementId}`);

      typingUsersRef.current = typingUsersRef.current.filter(
        (t) => !(t.userId === userId && t.elementId === elementId)
      );
      log(`✏️ [TYPING] Aktualna lista po usunięciu:`, typingUsersRef.current);
      notifyTypingSubscribers();
    },
    [notifyTypingSubscribers]
  );

  const handlePresenceLeave = useCallback(
    (leftUserIds: number[]) => {
      const before = typingUsersRef.current.length;
      typingUsersRef.current = typingUsersRef.current.filter(
        (t) => !leftUserIds.includes(t.userId)
      );
      if (typingUsersRef.current.length !== before) {
        notifyTypingSubscribers();
      }
    },
    [notifyTypingSubscribers]
  );

  const reset = useCallback(() => {
    typingUsersRef.current = [];
  }, []);

  // ⏰ AUTO-CLEANUP — patrz komentarz na górze pliku o różnicy vs oryginał.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const before = typingUsersRef.current.length;
      typingUsersRef.current = typingUsersRef.current.filter(
        (t) => now - t.lastSeen < TYPING_TIMEOUT_MS
      );
      if (typingUsersRef.current.length !== before) {
        log(`✏️ [TYPING] Auto-cleanup: usunięto ${before - typingUsersRef.current.length} starych wpisów`);
        notifyTypingSubscribers();
      }
    }, TYPING_CLEANUP_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [notifyTypingSubscribers]);

  return {
    broadcastTypingStarted,
    broadcastTypingStopped,
    subscribeTyping,
    handleTypingStarted,
    handleTypingStopped,
    handlePresenceLeave,
    reset,
  };
}
