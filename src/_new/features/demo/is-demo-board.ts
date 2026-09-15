/**
 * ============================================================================
 * is-demo-board.ts - rozpoznawanie tablicy demo
 * ============================================================================
 *
 * Tablica demo nie istnieje w bazie. Jej `boardId` to STRING `demo-<sessionId>`,
 * a nie liczba - dzieki temu:
 *  - nazwa kanalu Supabase `board:demo-<id>` nie koliduje z numerycznymi id
 *    prawdziwych tablic,
 *  - kazde `parseInt(boardId)` daje NaN, co w wiekszosci miejsc JUZ dzis
 *    zatrzymuje wywolanie REST (patrz use-elements.ts i use-whiteboard-engine.ts).
 *
 * Ten modul daje jawny, czytelny test zamiast polegania na przypadkowym NaN.
 */

export const DEMO_BOARD_PREFIX = 'demo-';

/** Czy ten boardId nalezy do sesji demo (a wiec: zero zapisu do bazy). */
export function isDemoBoard(boardId: string | number | null | undefined): boolean {
  return typeof boardId === 'string' && boardId.startsWith(DEMO_BOARD_PREFIX);
}

/** sessionId -> boardId uzywany przez BoardRealtimeProvider i kanal Supabase. */
export function toDemoBoardId(sessionId: string): string {
  return `${DEMO_BOARD_PREFIX}${sessionId}`;
}

/** Odwrotnosc toDemoBoardId; null gdy to nie jest tablica demo. */
export function toDemoSessionId(boardId: string): string | null {
  return isDemoBoard(boardId) ? boardId.slice(DEMO_BOARD_PREFIX.length) : null;
}
