/**
 * engine/use-whiteboard-engine.ts — Rdzeń silnika tablicy
 *
 * Montuje WhiteboardEngine nad `mutators` z useYjsBoard.
 */

import { useMemo, useRef } from 'react';
import type { DrawingElement, Point } from '@/_new/features/whiteboard/types';
import {
  transformPoint,
  inverseTransformPoint,
} from '@/_new/features/whiteboard/navigation/viewport-math';
import type { WhiteboardEngine, WhiteboardEngineDeps } from './types';

export function useWhiteboardEngine(deps: WhiteboardEngineDeps): WhiteboardEngine {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  return useMemo<WhiteboardEngine>(() => {
    const d = () => depsRef.current;
    const isReadOnly = () => d().userRole === 'viewer';

    const screenToWorld = (p: Point): Point => {
      const { canvasSize, viewportRef } = d();
      return inverseTransformPoint(p, viewportRef.current, canvasSize.width, canvasSize.height);
    };
    const worldToScreen = (p: Point): Point => {
      const { canvasSize, viewportRef } = d();
      return transformPoint(p, viewportRef.current, canvasSize.width, canvasSize.height);
    };

    return {
      get elementsRef() {
        return d().elementsRef;
      },
      getElements: () => d().elementsRef.current,
      getById: (id) => d().elementsRef.current.find((e) => e.id === id),
      get viewportRef() {
        return d().viewportRef;
      },
      get canvasSize() {
        return d().canvasSize;
      },
      get boardIdRef() {
        return d().boardIdRef;
      },
      get userRole() {
        return d().userRole;
      },
      get isReadOnly() {
        return isReadOnly();
      },

      createElements: (elements) => {
        if (isReadOnly() || elements.length === 0) return;
        d().mutators.batch(elements);
      },

      updateElements: (_before, after) => {
        if (isReadOnly() || after.length === 0) return;
        d().mutators.batch(after);
      },

      deleteElements: (elements) => {
        if (isReadOnly() || elements.length === 0) return;
        d().mutators.deleteMany(elements.map((e) => e.id));
      },

      updateElementsLive: (updates) => {
        if (isReadOnly() || updates.size === 0) return;
        const { elementsRef, mutators } = d();
        const updated: DrawingElement[] = [];
        updates.forEach((patch, id) => {
          const current = elementsRef.current.find((e) => e.id === id);
          if (current) updated.push({ ...current, ...patch } as DrawingElement);
        });
        if (updated.length === 0) return;
        mutators.batch(updated);
      },

      // ── undo/redo ──
      undo: () => d().undo(),
      redo: () => d().redo(),
      get canUndo() {
        return d().canUndo;
      },
      get canRedo() {
        return d().canRedo;
      },

      // ── SELEKCJA ──
      get selectedIds() {
        return d().selectedElementIds;
      },
      select: (ids) => d().selectElements(ids),
      clearSelection: () => d().clearSelection(),

      // ── KOORDYNATY ──
      screenToWorld,
      worldToScreen,
      centerOfViewport: () => {
        const { canvasSize } = d();
        return screenToWorld({ x: canvasSize.width / 2, y: canvasSize.height / 2 });
      },
    };
    // Pusta lista zależności — obiekt stabilny; runtime czytany przez depsRef.
  }, []);
}
