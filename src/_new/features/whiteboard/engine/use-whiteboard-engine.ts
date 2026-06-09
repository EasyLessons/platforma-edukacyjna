/**
 * ============================================================================
 * PLIK: engine/use-whiteboard-engine.ts — Rdzeń silnika tablicy
 * ============================================================================
 *
 * Montuje WhiteboardEngine z zdolności wstrzykniętych z hooków (WhiteboardEngineDeps)
 * i implementuje intencje create/update/delete tak, by zachować DZISIEJSZĄ
 * persystencję 1:1 (patrz komentarze przy każdej metodzie).
 *
 * STABILNOŚĆ TOŻSAMOŚCI:
 *  - Najświeższe deps trzymamy w `depsRef` (aktualizowany przy każdym renderze).
 *  - Sam obiekt silnika budujemy RAZ (useMemo []), a jego metody/gettery czytają
 *    `depsRef.current` → zero stale-closures i brak re-renderów konsumentów przy
 *    zmianie canUndo/selekcji (kluczowe, gdy w Fazie 2 silnik trafi do narzędzi).
 * ============================================================================
 */

import { useMemo, useRef } from 'react';
import type { DrawingElement, Point } from '@/_new/features/whiteboard/types';
import {
  CreateElementsCommand,
  DeleteElementsCommand,
  UpdateElementsCommand,
} from '@/_new/features/whiteboard/commands';
import {
  transformPoint,
  inverseTransformPoint,
} from '@/_new/features/whiteboard/navigation/viewport-math';
import type { WhiteboardEngine, WhiteboardEngineDeps } from './types';

// Stałe odtworzone 1:1 z deleteSelectedElements / handleElementsUpdate w canvasie
const DELETE_CHUNK_SIZE = 20;
const DELETE_CHUNK_DELAY_MS = 50;
const GROUP_BROADCAST_THROTTLE_MS = 50;

export function useWhiteboardEngine(deps: WhiteboardEngineDeps): WhiteboardEngine {
  // Najświeższe deps w refie (aktualizacja synchroniczna przy każdym renderze).
  const depsRef = useRef(deps);
  depsRef.current = deps;

  // Throttle broadcastu grupowego podczas drag (jak lastGroupBroadcastRef w canvasie).
  const lastGroupBroadcastRef = useRef(0);

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
      // ── ODCZYT ──
      get elementsRef() { return d().elementsRef; },
      getElements: () => d().elementsRef.current,
      getById: (id) => d().elementsRef.current.find((e) => e.id === id),
      get viewportRef() { return d().viewportRef; },
      get canvasSize() { return d().canvasSize; },
      get boardIdRef() { return d().boardIdRef; },
      get userRole() { return d().userRole; },
      get isReadOnly() { return isReadOnly(); },

      // ── INTENCJA: CREATE (persystencja markUnsaved, jak createElement) ──
      createElements: (elements) => {
        if (isReadOnly() || elements.length === 0) return;
        const {
          addElements, markUnsaved,
          broadcastElementCreated, broadcastElementsBatch, recordCommand,
        } = d();
        addElements(elements);
        markUnsaved(elements.map((e) => e.id));
        if (elements.length > 1) broadcastElementsBatch(elements).catch(console.error);
        else broadcastElementCreated(elements[0]).catch(console.error);
        recordCommand(new CreateElementsCommand(elements));
      },

      // ── INTENCJA: UPDATE (persystencja markUnsaved, jak handleElementUpdateWithHistory) ──
      updateElements: (before, after) => {
        if (isReadOnly() || after.length === 0) return;
        const {
          updateElements, markUnsaved, broadcastElementUpdated,
          recordCommand, saveToHistory, elementsRef,
        } = d();
        updateElements(after);
        markUnsaved(after.map((e) => e.id));
        after.forEach((e) => broadcastElementUpdated(e).catch(console.error));
        recordCommand(new UpdateElementsCommand(before, after));
        saveToHistory(elementsRef.current); // legacy snapshot — zostaje do Fazy 3
      },

      // ── INTENCJA: DELETE (persystencja natychmiastowa w chunkach, jak deleteSelectedElements) ──
      deleteElements: (elements) => {
        if (isReadOnly() || elements.length === 0) return;
        const {
          removeElement, loadedImages, recordCommand,
          broadcastElementDeleted, deleteElementDirectly, boardIdRef,
        } = d();
        // 1. natychmiastowe usunięcie lokalne
        elements.forEach((e) => {
          removeElement(e.id);
          loadedImages.delete(e.id);
        });
        // 2. historia (jedna komenda)
        recordCommand(new DeleteElementsCommand(elements));
        // 3. broadcast + baza w chunkach po 20 (ochrona przed rate limit)
        const boardIdNum = parseInt(boardIdRef.current ?? '');
        const ids = elements.map((e) => e.id);
        void (async () => {
          for (let i = 0; i < ids.length; i += DELETE_CHUNK_SIZE) {
            const chunk = ids.slice(i, i + DELETE_CHUNK_SIZE);
            chunk.forEach((id) => broadcastElementDeleted(id));
            if (!Number.isNaN(boardIdNum)) {
              await Promise.all(
                chunk.map((id) => deleteElementDirectly(boardIdNum, id).catch(console.error)),
              );
            }
            if (i + DELETE_CHUNK_SIZE < ids.length) {
              await new Promise((resolve) => setTimeout(resolve, DELETE_CHUNK_DELAY_MS));
            }
          }
        })();
      },

      // ── LIVE: batch-update bez historii (jak handleElementsUpdate) ──
      updateElementsLive: (updates) => {
        if (isReadOnly() || updates.size === 0) return;
        const { elementsRef, updateElements, markUnsaved, broadcastElementsBatch } = d();
        const updated: DrawingElement[] = [];
        updates.forEach((patch, id) => {
          const current = elementsRef.current.find((e) => e.id === id);
          if (current) updated.push({ ...current, ...patch } as DrawingElement);
        });
        if (updated.length === 0) return;
        updateElements(updated);
        markUnsaved(updated.map((e) => e.id));
        const now = Date.now();
        if (now - lastGroupBroadcastRef.current > GROUP_BROADCAST_THROTTLE_MS) {
          lastGroupBroadcastRef.current = now;
          broadcastElementsBatch(updated).catch(console.error);
        }
      },

      // ── HISTORIA ──
      undo: () => d().undo(),
      redo: () => d().redo(),
      get canUndo() { return d().canUndo; },
      get canRedo() { return d().canRedo; },

      // ── SELEKCJA ──
      get selectedIds() { return d().selectedElementIds; },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
