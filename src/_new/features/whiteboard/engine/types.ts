/**
 * ============================================================================
 * PLIK: engine/types.ts — Kontrakt silnika tablicy (WhiteboardEngine)
 * ============================================================================
 *
 * WhiteboardEngine to FASADA, przez którą narzędzia i handlery mutują tablicę,
 * zamiast bezpośrednio wołać rt.broadcast*, el.markUnsaved, hist.pushUserAction.
 *
 * DWIE WARSTWY API:
 *  - INTENCJE (createElements / updateElements / deleteElements) — zwijają
 *    czterowierszowy rytuał (stan + persist + broadcast + zapis komendy) w jedno
 *    miejsce. Każda intencja zachowuje DZISIEJSZĄ persystencję 1:1:
 *      • create / update → markUnsaved (debounced batch),
 *      • delete          → deleteElementDirectly (natychmiast, chunki po 20).
 *  - LIVE (updateElementsLive) — szybki podgląd podczas drag/resize, bez historii.
 *
 * Generyczne `execute(command)` świadomie POMINIĘTE w Fazie 1 (rozwiązanie
 * „advanced") — intencje typowane są jedynym codziennym API.
 *
 * WhiteboardEngineDeps to wąski zestaw zdolności wstrzykiwanych z istniejących
 * hooków (use-elements / use-selection / use-viewport / use-realtime /
 * use-history). Silnik nie zna konkretnych hooków — tylko te zdolności.
 * ============================================================================
 */

import type { RefObject } from 'react';
import type { DrawingElement, Point, ViewportTransform } from '@/_new/features/whiteboard/types';
import type { Command } from '@/_new/features/whiteboard/commands';

export type UserRole = 'owner' | 'editor' | 'viewer';

// ─── PUBLICZNE API SILNIKA ─────────────────────────────────────────────────────

export interface WhiteboardEngine {
  // ── ODCZYT (refy do hot-path, gettery do snapshotów) ──
  readonly elementsRef: RefObject<DrawingElement[]>;
  getElements(): DrawingElement[];
  getById(id: string): DrawingElement | undefined;
  readonly viewportRef: RefObject<ViewportTransform>;
  readonly canvasSize: { readonly width: number; readonly height: number };
  readonly boardIdRef: RefObject<string>;
  readonly userRole: UserRole;
  readonly isReadOnly: boolean; // userRole === 'viewer'

  // ── INTENCJE: optymistyczny stan + broadcast + persist + zapis komendy ──
  /** Utwórz element(y). Persystencja: markUnsaved (debounced). 1 komenda na wywołanie. */
  createElements(elements: DrawingElement[]): void;
  /** Zaktualizuj element(y) z historią. Persystencja: markUnsaved (debounced). */
  updateElements(before: DrawingElement[], after: DrawingElement[]): void;
  /** Usuń element(y). Persystencja: deleteElementDirectly (natychmiast, chunki po 20). */
  deleteElements(elements: DrawingElement[]): void;

  // ── MUTACJA LIVE (bez historii — podgląd podczas drag/resize) ──
  /** Batch-update lokalny + markUnsaved + throttlowany broadcast (jak handleElementsUpdate). */
  updateElementsLive(updates: Map<string, Partial<DrawingElement>>): void;

  // ── HISTORIA ──
  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  // ── SELEKCJA ──
  readonly selectedIds: ReadonlySet<string>;
  select(ids: string[]): void;
  clearSelection(): void;

  // ── KOORDYNATY / VIEWPORT ──
  screenToWorld(p: Point): Point;
  worldToScreen(p: Point): Point;
  /** Środek aktualnego widoku w jednostkach świata (konsoliduje powtórzony inverseTransformPoint(środek)). */
  centerOfViewport(): Point;
}

// ─── ZALEŻNOŚCI WSTRZYKIWANE (zdolności z hooków) ──────────────────────────────

export interface WhiteboardEngineDeps {
  // ── elementy (use-elements) ──
  elementsRef: RefObject<DrawingElement[]>;
  loadedImages: Map<string, HTMLImageElement>;
  addElements(elements: DrawingElement[]): void;
  updateElements(elements: DrawingElement[]): void;
  removeElement(id: string): void;
  markUnsaved(ids: string[]): void;
  deleteElementDirectly(boardId: number, id: string): Promise<void>;

  // ── selekcja (use-selection) ──
  selectedElementIds: Set<string>;
  selectElements(ids: string[]): void;
  clearSelection(): void;

  // ── viewport (use-viewport) ──
  viewportRef: RefObject<ViewportTransform>;

  // ── realtime (use-realtime) ──
  broadcastElementCreated(element: DrawingElement): Promise<void>;
  broadcastElementUpdated(element: DrawingElement): Promise<void>;
  broadcastElementDeleted(id: string): Promise<void>;
  broadcastElementsBatch(elements: DrawingElement[]): Promise<void>;

  // ── historia (use-history) ──
  recordCommand(command: Command): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  saveToHistory(elements: DrawingElement[]): void;

  // ── kontekst ──
  canvasSize: { width: number; height: number };
  boardIdRef: RefObject<string>;
  userRole: UserRole;
}
