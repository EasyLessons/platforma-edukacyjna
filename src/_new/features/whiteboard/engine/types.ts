/**
 * engine/types.ts — Kontrakt silnika tablicy (WhiteboardEngine)
 *
 * WhiteboardEngine to FASADA, przez którą narzędzia i handlery mutują tablicę.
 * Pod spodem: mutatory z `useYjsBoard` - Yjs sam robi persystencję (Hocuspocus) i historię (Y.UndoManager).
 */

import type { RefObject } from 'react';
import type { DrawingElement, Point, ViewportTransform } from '@/_new/features/whiteboard/types';

export type UserRole = 'owner' | 'editor' | 'viewer';

// API silnika tablicy ------------------------------------
export interface WhiteboardEngine {
  readonly elementsRef: RefObject<DrawingElement[]>;
  getElements(): DrawingElement[];
  getById(id: string): DrawingElement | undefined;
  readonly viewportRef: RefObject<ViewportTransform>;
  readonly canvasSize: { readonly width: number; readonly height: number };
  readonly boardIdRef: RefObject<string>;
  readonly userRole: UserRole;
  readonly isReadOnly: boolean;

  createElements(elements: DrawingElement[]): void;
  updateElements(before: DrawingElement[], after: DrawingElement[]): void;
  deleteElements(elements: DrawingElement[]): void;
  updateElementsLive(updates: Map<string, Partial<DrawingElement>>): void;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  readonly selectedIds: ReadonlySet<string>;
  select(ids: string[]): void;
  clearSelection(): void;

  screenToWorld(p: Point): Point;
  worldToScreen(p: Point): Point;
  centerOfViewport(): Point;
}

// Zależności silnika tablicy ----------------------------

export interface WhiteboardEngineDeps {
  // ── elementy (use-elements) ──
  elementsRef: RefObject<DrawingElement[]>;
  mutators: {
    upsert(element: DrawingElement): void;
    delete(id: string): void;
    batch(elements: DrawingElement[]): void;
    deleteMany(ids: string[]): void;
  };

  // ── selekcja (use-selection) ──
  selectedElementIds: Set<string>;
  selectElements(ids: string[]): void;
  clearSelection(): void;

  // ── viewport (use-viewport) ──
  viewportRef: RefObject<ViewportTransform>;

  // ── undo/redo ──
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;

  // ── kontekst ──
  canvasSize: { width: number; height: number };
  boardIdRef: RefObject<string>;
  userRole: UserRole;
}
