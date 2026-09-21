import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import {
  createBoardDoc,
  getElementsMap,
  getElements,
  getElementsWithAuthor,
  upsertElement as docUpsertElement,
  upsertElements as docUpsertElements,
  deleteElement as docDeleteElement,
} from '../yjs/board-doc';
import { ElementSpatialIndex } from '../navigation/spatial-index';
import type { DrawingElement } from '../types';
import type { BoardElementWithAuthor } from '../api/whiteboardApi';

// Types

export interface UseYjsBoardOptions {
  userId: number | null;
  username: string | null;
}

export interface UseYjsBoardMutators {
  upsert: (element: DrawingElement) => void;
  delete: (id: string) => void;
  batch: (elements: DrawingElement[]) => void;
}

export interface UseYjsBoardReturn {
  doc: Y.Doc;
  elements: DrawingElement[];
  elementsRef: React.RefObject<DrawingElement[]>;
  spatialIndex: ElementSpatialIndex;
  loadedImages: Map<string, HTMLImageElement>;
  loadImage: (id: string, src: string) => void;
  elementsWithAuthor: BoardElementWithAuthor[];
  mutators: UseYjsBoardMutators;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// Hook

/** Stan tablicy oparty o Y.Doc (yjs/board-doc.ts). */
export function useYjsBoard({ userId, username }: UseYjsBoardOptions): UseYjsBoardReturn {
  const doc = useRef(createBoardDoc()).current;
  const spatialIndex = useRef(new ElementSpatialIndex()).current;

  const [elements, setElements] = useState<DrawingElement[]>([]);
  const elementsRef = useRef<DrawingElement[]>(elements);

  const [elementsWithAuthor, setElementsWithAuthor] = useState<BoardElementWithAuthor[]>([]);

  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const loadedIdsRef = useRef<Set<string>>(new Set());

  /** Ładuje bitmapę raz na id. */
  const loadImage = useCallback((id: string, src: string) => {
    if (loadedIdsRef.current.has(id)) return;
    loadedIdsRef.current.add(id);
    const img = new Image();
    img.src = src;
    img.onload = () => setLoadedImages((prev) => new Map(prev).set(id, img));
    img.onerror = () => {
      loadedIdsRef.current.delete(id);
      console.error(`Błąd ładowania obrazu: ${id}`);
    };
  }, []);

  // Y.UndoManager - "cofnij tylko moje"
  const undoManager = useMemo(
    () => new Y.UndoManager(getElementsMap(doc), { trackedOrigins: new Set([userId]) }),
    [doc, userId]
  );

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const sync = () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    };
    undoManager.on('stack-item-added', sync);
    undoManager.on('stack-item-popped', sync);
    undoManager.on('stack-cleared', sync);
    sync();
    return () => {
      undoManager.off('stack-item-added', sync);
      undoManager.off('stack-item-popped', sync);
      undoManager.off('stack-cleared', sync);
      undoManager.destroy();
    };
  }, [undoManager]);

  const undo = useCallback(() => undoManager.undo(), [undoManager]);
  const redo = useCallback(() => undoManager.redo(), [undoManager]);

  // Projekcja Y.Doc -> elementsRef / spatialIndex / elementsWithAuthor
  useEffect(() => {
    const elementsMap = getElementsMap(doc);

    const applySnapshot = () => {
      const next = getElements(doc);
      elementsRef.current = next;
      setElements(next);
      setElementsWithAuthor(getElementsWithAuthor(doc));
    };

    // Stan początkowy
    spatialIndex.rebuild(getElements(doc));
    applySnapshot();

    const handleDeepChange = (events: Array<Y.YEvent<any>>) => {
      const added = new Set<string>();
      const removed = new Set<string>();
      const updated = new Set<string>();

      for (const event of events) {
        if (event.target === elementsMap) {
          event.changes.keys.forEach((change, key) => {
            if (change.action === 'add') added.add(key);
            else if (change.action === 'delete') removed.add(key);
            else updated.add(key);
          });
        } else {
          const id = event.path[0];
          if (typeof id === 'string') updated.add(id);
        }
      }
      for (const id of removed) {
        added.delete(id);
        updated.delete(id);
        spatialIndex.remove(id);

        loadedIdsRef.current.delete(id);
        setLoadedImages((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }

      const byId = new Map(getElements(doc).map((el) => [el.id, el]));

      for (const id of added) {
        const el = byId.get(id);
        if (!el) continue;
        spatialIndex.insert([el]);
        if (el.type === 'image' && el.src) loadImage(el.id, el.src);
      }
      for (const id of updated) {
        const el = byId.get(id);
        if (el) spatialIndex.update(el);
      }

      applySnapshot();
    };

    elementsMap.observeDeep(handleDeepChange);
    return () => elementsMap.unobserveDeep(handleDeepChange);
  }, [doc, spatialIndex, loadImage]);

  // Sprządanie Y.Doc przy odmontowaniu komponentu
  useEffect(() => () => doc.destroy(), [doc]);

  // Mutatory
  const mutators = useMemo<UseYjsBoardMutators>(
    () => ({
      upsert: (element) =>
        docUpsertElement(doc, element, userId, { createdBy: userId, createdByName: username }),
      delete: (id) => docDeleteElement(doc, id, userId),
      batch: (els) =>
        docUpsertElements(doc, els, userId, () => ({
          createdBy: userId,
          createdByName: username,
        })),
    }),
    [doc, userId, username]
  );

  return {
    doc,
    elements,
    elementsRef,
    spatialIndex,
    loadedImages,
    loadImage,
    elementsWithAuthor,
    mutators,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
