/**
 * ============================================================================
 * API ELEMENTÓW TABLICY — jedyne miejsce komunikacji z backendem
 * ============================================================================
 * Wszystkie zapisy, odczyty i usuwanie elementów przechodzą przez ten plik.
 * Komponenty i hooki NIE importują bezpośrednio z boards_api/api.ts.
 *
 * ENDPOINT BASE: /api/boards/{boardId}/elements
 *
 * UŻYWANE PRZEZ:
 * - elements/use-elements.ts   (zapis i odczyt przy starcie)
 * - hooks/use-canvas.ts        (orchestrator)
 * ============================================================================
 */

import {
  saveBoardElementsBatch as _saveBatch,
  loadBoardElements as _loadElements,
  deleteBoardElement as _deleteElement,
  type BoardElement,
  type BoardElementWithAuthor,
} from './whiteboardApi';

import type { DrawingElement } from '../types';

// ─── RE-EKSPORT TYPÓW ────────────────────────────────────────────────────────

/** Surowy element z bazy (element_id + type + data jako `any`) */
export type { BoardElement, BoardElementWithAuthor };

// ─── TYPY DOMENOWE ──────────────────────────────────────────────────────────

/**
 * Element do zapisu w bazie — konwertuje DrawingElement → BoardElement.
 * `data` to pełny obiekt elementu, `type` to krótki string (np. 'path').
 */
export interface ElementToSave {
  element_id: string;
  type: DrawingElement['type'];
  data: Record<string, unknown>;
}

// ─── FUNKCJE API ─────────────────────────────────────────────────────────────

/**
 * Zapisz wiele elementów naraz (INSERT lub UPDATE jeśli element_id istnieje).
 * Backend używa transakcji — albo wszystkie zapisane, albo żaden.
 *
 * Max 100 elementów w jednym batchu.
 *
 * @returns { success, saved } — ile elementów zostało zapisanych
 */
export async function saveBoardElementsBatch(
  boardId: number,
  elements: BoardElement[]
): Promise<{ success: boolean; saved: number }> {
  return _saveBatch(boardId, elements);
}

/**
 * Załaduj wszystkie elementy tablicy z bazy.
 * Backend zwraca tylko nieusunięte (is_deleted = false), posortowane od najstarszego.
 *
 * @returns tablica elementów z metadanymi (autor, data created_at)
 */
export async function loadBoardElements(
  boardId: number
): Promise<BoardElementWithAuthor[]> {
  return _loadElements(boardId);
}

/**
 * Usuń element z tablicy (soft delete — fizycznie zostaje w bazie).
 * Po usunięciu element nie pojawi się w loadBoardElements().
 */
export async function deleteBoardElement(
  boardId: number,
  elementId: string
): Promise<{ success: boolean }> {
  return _deleteElement(boardId, elementId);
}

/**
 * Konwertuje DrawingElement[] → ElementToSave[] (gotowe do wysłania do backendu).
 *
 * Przykład użycia:
 *   const toSave = toSaveFormat(elements);
 *   await saveBoardElementsBatch(boardId, toSave);
 */
export function toSaveFormat(elements: DrawingElement[]): ElementToSave[] {
  return elements.map((el) => ({
    element_id: el.id,
    type: el.type,
    data: el as unknown as Record<string, unknown>,
  }));
}

/**
 * Konwertuje BoardElementWithAuthor[] → DrawingElement[] (gotowe do wyrenderowania).
 * Filtruje elementy z brakującymi danymi (zabezpieczenie przed złymi danymi w bazie).
 *
 * Przykład użycia:
 *   const raw = await loadBoardElements(boardId);
 *   const elements = fromSaveFormat(raw);
 *   setElements(elements);
 */
export function fromSaveFormat(raw: BoardElementWithAuthor[]): DrawingElement[] {
  return raw
    .filter((el) => el.data && el.element_id)
    .map((el) => el.data as unknown as DrawingElement);
}
