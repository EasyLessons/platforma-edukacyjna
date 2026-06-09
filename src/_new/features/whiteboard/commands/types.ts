/**
 * ============================================================================
 * PLIK: commands/types.ts — Kontrakt wzorca Command
 * ============================================================================
 *
 * Każda trwała mutacja tablicy (utworzenie / usunięcie / aktualizacja
 * elementów) jest reprezentowana jako obiekt Command, który umie się
 * WYKONAĆ (do) i COFNĄĆ (undo). Dzięki temu historia undo/redo nie zawiera
 * ani jednego if/else po typie akcji — operuje wyłącznie na Command[].
 *
 * Zależności (broadcast, zapis w bazie, stan React) NIE są zaszyte w komendzie
 * — są wstrzykiwane przez CommandContext. Komenda nie wie nic o hookach
 * ani o Supabase, co czyni ją czystą i testowalną w izolacji.
 * ============================================================================
 */

import type { DrawingElement } from '@/_new/features/whiteboard/types';

/**
 * Zależności, których komenda potrzebuje do wykonania efektów ubocznych.
 * Wstrzykiwane przez useHistory — opakowują istniejące callbacki hooka.
 */
export interface CommandContext {
  // ── lokalny stan React (setElements) ──
  addElement(element: DrawingElement): void;
  removeElement(id: string): void;
  updateElement(element: DrawingElement): void;

  // ── broadcast do innych użytkowników (Supabase Realtime) ──
  broadcastCreated(element: DrawingElement): void | Promise<void>;
  broadcastDeleted(id: string): void | Promise<void>;
  broadcastUpdated(element: DrawingElement): void | Promise<void>;

  // ── trwały zapis w bazie ──
  saveElement(boardId: number, element: DrawingElement): Promise<void>;
  deleteElement(boardId: number, id: string): Promise<void>;

  // ── refy potrzebne do warunków (parsowanie boardId, gwardia "unsaved") ──
  boardIdRef: { readonly current: string | null };
  unsavedElementsRef: { readonly current: Set<string> | null };
}

/** Pojedyncza, odwracalna mutacja tablicy. */
export interface Command {
  /** Etykieta do ActivityHistory / debug (np. 'create', 'update'). */
  readonly label: string;
  /** Wykonaj (używane także jako redo). */
  do(ctx: CommandContext): void;
  /** Cofnij. */
  undo(ctx: CommandContext): void;
}
