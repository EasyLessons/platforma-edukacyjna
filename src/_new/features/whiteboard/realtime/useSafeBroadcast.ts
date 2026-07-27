/**
 * useSafeBroadcast — wysyła event, a gdy się nie uda, próbuje ponownie.
 *
 * Supabase Broadcast czasem zawodzi przy chwilowym zerwaniu połączenia.
 * Ta funkcja nie blokuje UI: próbuje wysłać wiadomość, a potem ponawia
 * próbę w tle.
 *
 * `channelRef` jest wstrzykiwany z zewnątrz, więc hook nie musi znać
 * szczegółów tworzenia kanału. Dzięki temu łatwo go testować na fake'u.
 */

import { useCallback, type RefObject } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logWarn } from './logger';

/**
 * Opóźnienia przed kolejnymi próbami dla ważnych eventów typu `element-*`.
 * Kursor i viewport nie są retry'owane, bo i tak wysyłają się często.
 */
const RETRY_DELAY_1_MS = 100;
const RETRY_DELAY_2_MS = 200;

export function useSafeBroadcast(channelRef: RefObject<RealtimeChannel | null>) {
  const safeBroadcast = useCallback(
    async (event: string, payload: unknown): Promise<boolean> => {
      const channel = channelRef.current;
      if (!channel) {
        logWarn(`📤 [BROADCAST] ❌ Brak kanału dla ${event}`);
        return false;
      }

      const sendMessage = async (): Promise<boolean> => {
        try {
          // 🛠️ FIX (known-issues.md #2): kanał ma teraz `ack: true`, więc
          // `channel.send()` faktycznie CZEKA na odpowiedź serwera i zwraca
          // 'ok' | 'timed_out' | 'error' — musimy to przeczytać, a nie tylko
          // sprawdzić czy rzuciło wyjątek. Wcześniej nawet odpowiedź 'error'
          // (np. za duży payload) była cicho traktowana jak sukces.
          const status = await channel.send({
            type: 'broadcast',
            event,
            payload,
          });
          if (status !== 'ok') {
            logWarn(`📤 [BROADCAST] status "${status}" dla ${event} — traktuję jako porażkę`);
          }
          return status === 'ok';
        } catch {
          return false;
        }
      };

      // Pierwsza próba — natychmiastowa
      const success = await sendMessage();

      if (!success) {
        // Retry w tle — nie blokuje, nie dodaje latency do UI.
        // Tylko dla ważnych eventów (nie cursor/viewport).
        // 🛠️ FIX (known-issues.md #2, Audyt realtime): było `startsWith('element-')`
        // (z myślnikiem) — to NIGDY nie łapało `elements-batch` (liczba mnoga,
        // myślnik jest dopiero na 9. znaku, więc string nie pasował). Efekt:
        // batch-update przy przeciąganiu wielu zaznaczonych elementów naraz
        // (bardzo częsta operacja) nie miał ŻADNEJ ochrony przed chwilowym
        // zerwaniem połączenia — w przeciwieństwie do pojedynczego
        // `element-updated`. Dodajemy też `sync-response`, bo to on donosi
        // nowemu userowi elementy jeszcze niezapisane do bazy (świeżo
        // utworzone przez innych) — zgubiona paczka = user nie widzi ich, aż
        // ktoś zrobi kolejny ruch. `startsWith('element')` łapie razem
        // 'element-created'/'element-updated'/'element-deleted'/'elements-batch'.
        const isImportant = event.startsWith('element') || event === 'sync-response';
        if (isImportant) {
          setTimeout(async () => {
            const retry1 = await sendMessage();
            if (!retry1) {
              setTimeout(async () => {
                const retry2 = await sendMessage();
                if (!retry2) {
                  logWarn(`📤 [BROADCAST] ❌ Nie udało się wysłać ${event} po 3 próbach`);
                }
              }, RETRY_DELAY_2_MS);
            }
          }, RETRY_DELAY_1_MS);
        }
      }

      return success;
    },
    // `channelRef` ma stabilną tożsamość, więc nie trzeba go dodawać do deps.
    []
  );

  return safeBroadcast;
}
