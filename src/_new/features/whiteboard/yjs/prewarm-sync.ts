/**
 * prewarm-sync.ts
 *
 * Prewarmuje serwis whiteboard-sync (Hocuspocus) po załadowaniu strony, żeby przy pierwszym użyciu tablicy nie było opóźnienia spowodowanego cold startem serwisu.
 * Jedno lekkie żądanie HTTP z dashboardu zaczyna budzenie wcześniej. Hocuspocus odpowiada na zwykły GET stroną powitalną.
 */

import { useEffect } from 'react';
import { WHITEBOARD_SYNC_URL } from './sync-url';

/** Raz na załadowanie strony. */
let prewarmed = false;

export function prewarmWhiteboardSync(): void {
  if (prewarmed || typeof window === 'undefined') return;
  prewarmed = true;

  const httpUrl = WHITEBOARD_SYNC_URL.replace(/^ws/, 'http');

  fetch(httpUrl, { mode: 'no-cors', cache: 'no-store' }).catch(() => undefined);
}

/** Wywołuje prewarmWhiteboardSync() po zamontowaniu komponentu. */
export function usePrewarmWhiteboardSync(): void {
  useEffect(() => {
    prewarmWhiteboardSync();
  }, []);
}
