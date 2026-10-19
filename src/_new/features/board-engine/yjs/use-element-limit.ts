'use client';

/**
 * Licznik żywych elementów tablicy względem limitu planu właściciela przestrzeni.
 *
 * Limit egzekwuje whiteboard-sync na serwerze (nadmiar jest cofany tombstonem) - ten hook
 * tylko pokazuje ostrzeżenie przy 80% i blokadę narzędzi rysujących przy 100%, żeby użytkownik
 * wiedział, czemu nowy element znika. Nigdy nie przełącza tablicy w tryb tylko do odczytu.
 * `limit` null/undefined (Premium, demo, brak pola) = brak limitu.
 */

import { useEffect, useState } from 'react';
import type * as Y from 'yjs';
import { ELEMENTS_KEY } from './excalidraw-binding';

/** Ułamek limitu, od którego pokazujemy ostrzeżenie (jak ELEMENTS_WARN_RATIO w backendzie). */
export const ELEMENT_LIMIT_WARN_RATIO = 0.8;

export type ElementLimitLevel = 'none' | 'warn' | 'full';

export function countLiveElements(doc: Y.Doc): number {
  let n = 0;
  doc.getMap<unknown>(ELEMENTS_KEY).forEach((v) => {
    if (!(v && typeof v === 'object' && (v as { isDeleted?: boolean }).isDeleted === true)) n++;
  });
  return n;
}

export function elementLimitLevel(
  count: number,
  limit: number | null | undefined
): ElementLimitLevel {
  if (typeof limit !== 'number' || limit <= 0) return 'none';
  if (count >= limit) return 'full';
  if (count >= Math.ceil(limit * ELEMENT_LIMIT_WARN_RATIO)) return 'warn';
  return 'none';
}

export function useElementLimit(doc: Y.Doc, limit: number | null | undefined) {
  const [count, setCount] = useState(() => countLiveElements(doc));

  useEffect(() => {
    const map = doc.getMap<unknown>(ELEMENTS_KEY);
    const update = () => setCount(countLiveElements(doc));
    update();
    map.observe(update);
    return () => map.unobserve(update);
  }, [doc]);

  return { count, limit: limit ?? null, level: elementLimitLevel(count, limit) };
}
