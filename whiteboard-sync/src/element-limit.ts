/**
 * element-limit.ts
 *
 * Limit zywych elementow tablicy Excalidraw (klucz `excalidraw-elements`) wg planu wlasciciela
 * przestrzeni. Limit przychodzi z `/access` (AuthContext.elementLimit) i jest staly dla polaczenia.
 *
 * Mechanizm: serwer PRZYJMUJE update, a w `observe` mapy cofa nadmiar tombstonem (isDeleted: true,
 * version + 1) z originem = polaczenie sprawcy (bez tego zapis nie jest planowany).
 * `beforeHandleMessage` sie nie nadaje: rzut zamyka polaczenie, a wiadomosci nie da sie pominac.
 * Przechodza zawsze: edycja, przesuwanie, gumka (nic nie "staje sie zywe"); blokowane jest tylko
 * dodawanie nowych zywych elementow ponad `max(limit, liczba zywych przy zaladowaniu)`.
 * Nigdy nie ustawiamy readOnly z powodu planu.
 *
 * Stary silnik (klucz `elements`) nie jest limitowany.
 */

import type { Extension } from '@hocuspocus/server';
import type * as Y from 'yjs';
import type { AuthContext } from './auth';

export const ELEMENTS_KEY = 'excalidraw-elements';

const isPlain = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/** Nie-obiekt (smiec) liczy sie jako zywy, zeby nie dalo sie go uzyc do obejscia limitu. */
const isLive = (v: unknown): boolean => !(isPlain(v) && v.isDeleted === true);

const countLive = (m: Y.Map<unknown>): number => {
  let n = 0;
  m.forEach((v) => {
    if (isLive(v)) n++;
  });
  return n;
};

export const elementLimit: Extension = {
  async afterLoadDocument({ document }) {
    const map = document.getMap<unknown>(ELEMENTS_KEY);
    const liveAtLoad = countLive(map);

    map.observe((event, tr) => {
      try {
        const limit = (tr.origin as { context?: Partial<AuthContext> } | null)?.context?.elementLimit;
        if (typeof limit !== 'number') return; // load, brak limitu, Premium

        const becameLive: string[] = [];
        event.changes.keys.forEach((change, key) => {
          const wasLive = change.action !== 'add' && isLive(change.oldValue);
          if (!wasLive && map.has(key) && isLive(map.get(key))) becameLive.push(key);
        });
        if (becameLive.length === 0) return; // edycja/gumka: zero skanow

        const excess = Math.min(
          countLive(map) - Math.max(limit, liveAtLoad),
          becameLive.length
        );
        if (excess <= 0) return;

        document.transact(() => {
          for (const key of becameLive.slice(-excess)) {
            const v = map.get(key);
            if (isPlain(v)) {
              map.set(key, {
                ...v,
                isDeleted: true,
                version: (Number(v.version) || 0) + 1,
                versionNonce: Math.floor(Math.random() * 2 ** 31),
                updated: Date.now(),
              });
            } else {
              map.delete(key); // Y.Map/tablica/liczba: tombstone zatrulby dokument
            }
          }
        }, tr.origin);
      } catch (err) {
        console.error('[whiteboard-sync] element-limit:', (err as Error).message);
      }
    });
  },
};
