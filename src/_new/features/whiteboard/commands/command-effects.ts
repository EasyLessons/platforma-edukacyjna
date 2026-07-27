/**
 * ============================================================================
 * PLIK: commands/command-effects.ts — Współdzielone efekty komend
 * ============================================================================
 *
 * Trzy elementarne efekty, z których złożone są wszystkie komendy.
 * Odtwarzają logikę applyUndo / applyRedo z poprzedniej wersji use-history.ts
 * CO DO LINIJKI — żeby Faza 0 nie zmieniła zachowania tablicy:
 *
 *   - stan lokalny + broadcast wykonują się ZAWSZE,
 *   - zapis/usunięcie w bazie tylko gdy boardId jest prawdziwe (semantyka
 *     `if (boardId)` — 0 i NaN są pomijane),
 *   - usunięcie z bazy dodatkowo pomija elementy "unsaved" (nie ma ich jeszcze
 *     w bazie, więc nie ma czego kasować).
 * ============================================================================
 */

import type { CommandContext } from './types';
import type { DrawingElement } from '@/_new/features/whiteboard/types';

/**
 * Parsuje boardId zachowując semantykę `if (boardId)` z dawnego use-history:
 * 0 oraz NaN → null (operacje na bazie są wtedy pomijane).
 */
function boardIdOrNull(ctx: CommandContext): number | null {
  const id = parseInt(ctx.boardIdRef.current ?? '');
  return id || null;
}

/**
 * Materializacja elementu: stan lokalny + broadcast + zapis w bazie.
 * Odpowiednik applyRedo('create') / applyUndo('delete').
 */
export function createEffect(ctx: CommandContext, element: DrawingElement): void {
  ctx.addElement(element);
  // 🛠️ FIX (known-issues.md #2, Aktualizacja 10): bez tego undo usunięcia
  // obrazu (i redo jego utworzenia) wracało jako szary blok — element trafiał
  // z powrotem do `elements`, ale jego bitmapa nigdy nie ładowała się do
  // cache'u renderowania (loadedImages), bo TYLKO to robiło to jawnie
  // (handleImageCreate w whiteboard-canvas.tsx), a undo/redo idzie
  // WYŁĄCZNIE przez ten wspólny efekt, z pominięciem tamtego kodu.
  if (element.type === 'image' && element.src) {
    ctx.loadImage(element.id, element.src);
  }
  ctx.broadcastCreated(element);
  const boardId = boardIdOrNull(ctx);
  if (boardId) ctx.saveElement(boardId, element).catch(console.error);
}

/**
 * Usunięcie elementu: stan lokalny + broadcast + usunięcie z bazy (z gwardią unsaved).
 * Odpowiednik applyUndo('create') / applyRedo('delete').
 */
export function removeEffect(ctx: CommandContext, element: DrawingElement): void {
  ctx.removeElement(element.id);
  ctx.broadcastDeleted(element.id);
  const boardId = boardIdOrNull(ctx);
  if (boardId && !ctx.unsavedElementsRef.current?.has(element.id)) {
    ctx.deleteElement(boardId, element.id).catch(console.error);
  }
}

/**
 * Nadpisanie elementu nowym stanem: lokalnie + broadcast + zapis.
 * Odpowiednik apply('update').
 */
export function updateEffect(ctx: CommandContext, element: DrawingElement): void {
  ctx.updateElement(element);
  ctx.broadcastUpdated(element);
  const boardId = boardIdOrNull(ctx);
  if (boardId) ctx.saveElement(boardId, element).catch(console.error);
}
