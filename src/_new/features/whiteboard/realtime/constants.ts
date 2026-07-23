/**
 * Stałe (magic numbers) używane przez mechanizm realtime tablicy.
 *
 * Krok 1 wydzielania `BoardRealtimeContext` — wyciągnięte na wierzch zamiast
 * siedzieć zakopane w środku pliku, żeby było widać "co da się pokręcić"
 * bez czytania całej logiki.
 */

/**
 * Throttle = twardy limit "maksymalnie X razy na sekundę".
 * W przeciwieństwie do debounce (czekaj aż się uspokoi), throttle
 * przepuszcza regularnie, ale nie częściej niż co N milisekund.
 * Wartości w milisekundach.
 */
export const THROTTLE_MS = {
  ELEMENT_UPDATE: 100, // max 10 aktualizacji/s podczas rysowania
  // 🛠️ FIX (known-issues.md #2, Aktualizacja 7): było 50ms (20/s na usera).
  // Plan Free w Supabase ma twardy limit 100 wiadomości/s na CAŁY projekt —
  // sam kursor przy 2-3 aktywnych userach potrafił zjadać połowę tego limitu,
  // a z ack:true każda wiadomość i tak czeka na odpowiedź serwera (podwójny
  // ruch). 120ms = ~8 pozycji/s na usera — wciąż płynne dla oka, dużo mniej
  // ruchu w tle.
  CURSOR_MOVE: 120,
  VIEWPORT_CHANGE: 200, // max 5 aktualizacji viewportu/s
} as const;

/**
 * Rozmiar jednej paczki przy dogrywaniu całej tablicy nowemu userowi.
 *
 * 🛠️ FIX (known-issues.md #2, Audyt realtime): komentarz mówił o limicie
 * "~1MB" — to była stara/błędna liczba sprzed śledztwa w tej sesji, które
 * ustaliło, że realny twardy limit Supabase Broadcast to 256 KB na
 * wiadomość (patrz known-issues.md #2). SYNC_CHUNK_SIZE liczy elementy,
 * nie bajty, więc 100 "ciężkich" elementów w jednej paczce nadal teoretycznie
 * mogłoby przekroczyć 256 KB (np. bardzo długa treść markdown/tabeli w wielu
 * elementach naraz) — w praktyce mało prawdopodobne po Opcji C (obrazy/PDF-y
 * to już same URL-e, nie base64), ale warto o tym pamiętać przy dalszym
 * dostrajaniu. sync-response ma teraz retry (patrz useSafeBroadcast.ts).
 */
export const SYNC_CHUNK_SIZE = 100;

/** Odstęp między paczkami (ms) — daje czas Supabase na przepuszczenie poprzedniej */
export const SYNC_CHUNK_DELAY_MS = 80;

/** Po ilu ms bez odświeżenia uznajemy "ktoś pisze" za martwy wpis (np. zamknął kartę) */
export const TYPING_TIMEOUT_MS = 10_000;

/** Co ile ms sprzątamy martwe wpisy "ktoś pisze" */
export const TYPING_CLEANUP_INTERVAL_MS = 5_000;

/** Co ile ms odświeżamy własną obecność (Presence) w bazie backendu */
export const PRESENCE_HEARTBEAT_MS = 60_000;

/** Ile ms czekamy na ustabilizowanie się listy "kto online" zanim zaktualizujemy UI (zapobiega migotaniu) */
export const PRESENCE_SYNC_DEBOUNCE_MS = 300;

/** Kolory przydzielane kursorom innych userów (cyklicznie, wg user_id % długość tablicy) */
export const CURSOR_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
] as const;
