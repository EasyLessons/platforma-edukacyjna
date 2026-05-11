/**
 * use-elements.ts
 *
 * Zarządza stanem elementów tablicy: loading, zapis, pamięć podręczna obrazów.
 *
 * ODPOWIEDZIALNOŚĆ:
 *  - Ładuje elementy z bazy po inicjalizacji (`loadBoardElements`)
 *  - Przechowuje tablicę elementów i stabilną referencję `elementsRef`
 *  - Śledzi elementy niezapisane (`unsavedElements`) i triggeruje `debouncedSave` po 2s
 *  - Przechowuje cache załadowanych obrazów (`loadedImages`) dla renderowania canvas
 *  - Przechowuje `elementsWithAuthor` dla panelu Historia Aktywności
 *
 * NIE robi:
 *  - Nie renderuje canvas (to jest w komponencie)
 *  - Nie broadcastuje zmian (to robi use-realtime.ts)
 *  - Nie zarządza historią undo/redo (to jest use-history.ts)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  toSaveFormat,
  loadBoardElements as apiLoadElements,
  saveBoardElementsBatch,
  deleteBoardElement as apiDeleteElement,
} from '../api/elements-api';
import type { DrawingElement, ImageElement } from '../types';
import { BoardElementWithAuthor } from '../api/whiteboardApi';
import { ElementSpatialIndex } from '../navigation/spatial-index';

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface UseElementsOptions {
  boardId: string;
}

export interface UseElementsReturn {
  // Stan
  elements: DrawingElement[];
  elementsWithAuthor: BoardElementWithAuthor[];
  loadedImages: Map<string, HTMLImageElement>;
  isLoading: boolean;
  loadingProgress: number;
  isSaving: boolean;
  unsavedElements: Set<string>;

  // Stabilne referencje (do odczytu w event handlerach bez closures)
  elementsRef: React.RefObject<DrawingElement[]>;
  unsavedElementsRef: React.RefObject<Set<string>>;
  /** R-Tree spatial index — O(log n) culling zamiast O(n) iteracji przez wszystkie elementy */
  spatialIndex: ElementSpatialIndex;

  // Mutatory — używane przez inne hooki i canvas
  setElements: React.Dispatch<React.SetStateAction<DrawingElement[]>>;
  setElementsWithAuthor: React.Dispatch<React.SetStateAction<BoardElementWithAuthor[]>>;
  setLoadedImages: React.Dispatch<React.SetStateAction<Map<string, HTMLImageElement>>>;

  /** Oznacza elementy jako "wymagające zapisu", triggeruje debouncedSave */
  markUnsaved: (ids: string[]) => void;
  /** Dodaj nowe elementy do tablicy */
  addElements: (newElements: DrawingElement[]) => void;
  /** Usuń element z tablicy i z bazy danych */
  removeElement: (id: string) => void;
  /** Zaktualizuj element w tablicy */
  updateElement: (updated: DrawingElement) => void;
  /** Zaktualizuj wiele elementów naraz (Bulk Update) */
  updateElements: (updates: DrawingElement[]) => void;
  /** Zapisz element do bazy danych bezpośrednio (dla undo/redo) */
  saveElementDirectly: (boardIdNum: number, element: DrawingElement) => Promise<void>;
  /** Usuń element z bazy danych bezpośrednio (dla undo/redo) */
  deleteElementDirectly: (boardIdNum: number, elementId: string) => Promise<void>;
  /** Załaduj obraz do cache */
  loadImage: (id: string, src: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Buduje Map z tablicy — używane przy inicjalizacji i merge */
function toMap(elements: DrawingElement[]): Map<string, DrawingElement> {
  const m = new Map<string, DrawingElement>();
  for (const el of elements) m.set(el.id, el);
  return m;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const SAVE_DEBOUNCE_MS = 2000;

export function useElements({ boardId }: UseElementsOptions): UseElementsReturn {
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [elementsWithAuthor, setElementsWithAuthor] = useState<BoardElementWithAuthor[]>([]);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [unsavedElements, setUnsavedElements] = useState<Set<string>>(new Set());

  // Stabilna tablica — używana przez canvas, clipboard, sync, rendering
  const elementsRef = useRef<DrawingElement[]>(elements);
  // Mapa id→element — O(1) lookup dla updateElement/removeElement/find
  const elementsMapRef = useRef<Map<string, DrawingElement>>(new Map());
  // R-Tree spatial index — O(log n) culling w pętli renderowania
  const spatialIndex = useRef(new ElementSpatialIndex()).current;

  const unsavedElementsRef = useRef<Set<string>>(new Set());
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Synchronizuje refe, mapę, indeks i stan Reacta z jednej tablicy źródłowej */
  const applyElements = useCallback((next: DrawingElement[]) => {
    elementsRef.current = next;
    elementsMapRef.current = toMap(next);
    spatialIndex.rebuild(next);
    setElements(next);
  }, [spatialIndex]);

  useEffect(() => {
    unsavedElementsRef.current = unsavedElements;
  }, [unsavedElements]);

  // ─── Załaduj obraz do cache ────────────────────────────────────────────
  const loadImage = useCallback((id: string, src: string) => {
    const img = new Image();
    img.src = src;
    img.onload = () => setLoadedImages((prev) => new Map(prev).set(id, img));
    img.onerror = () => console.error(`Błąd ładowania obrazu: ${id}`);
  }, []);

  // ─── Ładowanie elementów z bazy ─────────────────────────────────────────
  useEffect(() => {
    const boardIdNum = parseInt(boardId);
    if (isNaN(boardIdNum)) return;

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadingProgress(10);

        const rawElements = await apiLoadElements(boardIdNum);
        setLoadingProgress(50);

        const dbElements = rawElements.map(
          (e: BoardElementWithAuthor) => e.data as unknown as DrawingElement
        );

        // INTELIGENTNE ŁĄCZENIE: RAM > DB (elementy z WebSocket mają pierwszeństwo)
        const currentRamMap = elementsMapRef.current;

        const merged = dbElements.map((dbEl) =>
          currentRamMap.has(dbEl.id) ? currentRamMap.get(dbEl.id)! : dbEl
        );

        // Elementy z RAM których baza jeszcze nie zna
        const dbMap = toMap(dbElements);
        for (const ramEl of elementsRef.current) {
          if (!dbMap.has(ramEl.id)) merged.push(ramEl);
        }

        applyElements(merged);

        // INTELIGENTNE ŁĄCZENIE AUTORÓW
        setElementsWithAuthor((prev) => {
          const currentRamAuthorMap = new Map(prev.map((e) => [e.element_id, e]));

          const mergedAuthors = rawElements.map((dbEl) =>
            currentRamAuthorMap.has(dbEl.element_id)
              ? currentRamAuthorMap.get(dbEl.element_id)!
              : dbEl
          );

          const dbAuthorMap = new Map(rawElements.map((e) => [e.element_id, e]));
          prev.forEach((ramEl) => {
            if (!dbAuthorMap.has(ramEl.element_id)) mergedAuthors.push(ramEl);
          });

          return mergedAuthors;
        });

        setLoadingProgress(70);

        // Załaduj wszystkie obrazy
        const imageEls = dbElements.filter((el: DrawingElement) => el.type === 'image');
        if (imageEls.length === 0) {
          setLoadingProgress(100);
          setTimeout(() => setIsLoading(false), 300);
          return;
        }

        let loadedCount = 0;
        const total = imageEls.length;
        await Promise.all(
          imageEls.map(
            (el: DrawingElement) =>
              new Promise<void>((resolve) => {
                if (el.type === 'image' && (el as ImageElement).src) {
                  const img = new Image();
                  img.src = (el as ImageElement).src;
                  img.onload = () => {
                    setLoadedImages((prev) => new Map(prev).set(el.id, img));
                    loadedCount += 1;
                    setLoadingProgress(90 + (loadedCount / total) * 10);
                    resolve();
                  };
                  img.onerror = () => {
                    loadedCount += 1;
                    resolve();
                  };
                } else {
                  resolve();
                }
              })
          )
        );

        setLoadingProgress(100);
        setTimeout(() => setIsLoading(false), 300);
      } catch (err) {
        console.error('Błąd ładowania elementów:', err);
        setIsLoading(false);
      }
    };

    load();
  }, [boardId, applyElements]);

  // ─── Debounced save ────────────────────────────────────────────────────
  const idleCallbackRef = useRef<number | null>(null);

  const debouncedSave = useCallback((boardIdStr: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      const boardIdNum = parseInt(boardIdStr);
      if (isNaN(boardIdNum)) return;
      if (isSavingRef.current || unsavedElementsRef.current.size === 0) return;

      const doSave = async () => {
        try {
          setIsSaving(true);
          isSavingRef.current = true;

          // O(1) lookup per element zamiast filter() przez całą tablicę
          const toSave: DrawingElement[] = [];
          for (const id of unsavedElementsRef.current) {
            const el = elementsMapRef.current.get(id);
            if (el) toSave.push(el);
          }
          if (toSave.length === 0) return;

          const BATCH_SIZE = 100;
          for (let i = 0; i < toSave.length; i += BATCH_SIZE) {
            const chunk = toSave.slice(i, i + BATCH_SIZE);
            await saveBoardElementsBatch(boardIdNum, toSaveFormat(chunk));
          }

          const savedIds = new Set(toSave.map((e) => e.id));
          setUnsavedElements((prev) => {
            const next = new Set(prev);
            savedIds.forEach((id) => next.delete(id));
            return next;
          });
        } catch (err) {
          console.error('Błąd zapisu:', err);
        } finally {
          setIsSaving(false);
          isSavingRef.current = false;
        }
      };

      // Odpal zapis gdy przeglądarka jest idle — nie blokuje animacji rysowania
      if (typeof requestIdleCallback !== 'undefined') {
        if (idleCallbackRef.current) cancelIdleCallback(idleCallbackRef.current);
        idleCallbackRef.current = requestIdleCallback(() => doSave(), { timeout: 5000 });
      } else {
        doSave();
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // ─── Mutatory ──────────────────────────────────────────────────────────

  const markUnsaved = useCallback(
    (ids: string[]) => {
      setUnsavedElements((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      debouncedSave(boardId);
    },
    [boardId, debouncedSave]
  );

  const addElements = useCallback((newEls: DrawingElement[]) => {
    // Dodaj do Mapy i indeksu — O(1) per element
    for (const el of newEls) elementsMapRef.current.set(el.id, el);
    spatialIndex.insert(newEls);
    const next = [...elementsRef.current, ...newEls];
    elementsRef.current = next;
    setElements(next);

    setElementsWithAuthor((prev) => [
      ...prev,
      ...newEls.map((el) => ({
        element_id: el.id,
        type: el.type,
        data: el as unknown as Record<string, unknown>,
        created_by_id: 0,
        created_by_username: '',
        created_at: new Date().toISOString(),
      })),
    ]);
  }, [spatialIndex]);

  const removeElement = useCallback((id: string) => {
    if (!elementsMapRef.current.has(id)) return;
    elementsMapRef.current.delete(id);
    spatialIndex.remove(id);
    const next = elementsRef.current.filter((el) => el.id !== id);
    elementsRef.current = next;
    setElements(next);
    setElementsWithAuthor((prev) => prev.filter((el) => el.element_id !== id));
  }, [spatialIndex]);

  const updateElement = useCallback((updated: DrawingElement) => {
    elementsMapRef.current.set(updated.id, updated);
    spatialIndex.update(updated);

    if (!elementsRef.current.some((e) => e.id === updated.id)) {
      // Nieznany element — dodaj jako nowy
      const next = [...elementsRef.current, updated];
      elementsRef.current = next;
      setElements(next);
    } else {
      const next = elementsRef.current.map((el) => (el.id === updated.id ? updated : el));
      elementsRef.current = next;
      setElements(next);
    }

    setElementsWithAuthor((prev) =>
      prev.map((el) =>
        el.element_id === updated.id
          ? { ...el, data: updated as unknown as Record<string, unknown> }
          : el
      )
    );
  }, [spatialIndex]);

  const updateElements = useCallback((updates: DrawingElement[]) => {
    const newElements: DrawingElement[] = [];

    // O(1) per update — podmień w mapie i indeksie, zbierz nieznane jako nowe
    for (const u of updates) {
      if (elementsMapRef.current.has(u.id)) {
        elementsMapRef.current.set(u.id, u);
        spatialIndex.update(u);
      } else {
        elementsMapRef.current.set(u.id, u);
        spatialIndex.insert([u]);
        newElements.push(u);
      }
    }

    // Przebuduj tablicę — istniejące biorą zaktualizowane wartości z mapy
    const updateIds = new Set(updates.map((u) => u.id));
    const updateMap = new Map(updates.map((u) => [u.id, u]));

    const next = elementsRef.current.map((e) =>
      updateIds.has(e.id) ? updateMap.get(e.id)! : e
    );
    if (newElements.length > 0) next.push(...newElements);

    elementsRef.current = next;
    setElements([...next]);

    setElementsWithAuthor((prev) => {
      const updatedAuthors = prev.map((authorEl) => {
        const u = updateMap.get(authorEl.element_id);
        return u ? { ...authorEl, data: u as unknown as Record<string, unknown> } : authorEl;
      });
      const newAuthors = newElements.map((el) => ({
        element_id: el.id,
        type: el.type,
        data: el as unknown as Record<string, unknown>,
        created_by_id: 0,
        created_by_username: 'Ktoś inny',
        created_at: new Date().toISOString(),
      }));
      return [...updatedAuthors, ...newAuthors];
    });
  }, [spatialIndex]);

  const saveElementDirectly = useCallback(async (boardIdNum: number, element: DrawingElement) => {
    await saveBoardElementsBatch(boardIdNum, toSaveFormat([element]));
  }, []);

  const deleteElementDirectly = useCallback(async (boardIdNum: number, elementId: string) => {
    await apiDeleteElement(boardIdNum, elementId);
  }, []);

  return {
    elements,
    elementsWithAuthor,
    loadedImages,
    isLoading,
    loadingProgress,
    isSaving,
    unsavedElements,
    elementsRef,
    unsavedElementsRef,
    spatialIndex,
    setElements,
    setElementsWithAuthor,
    setLoadedImages,
    markUnsaved,
    addElements,
    removeElement,
    updateElement,
    updateElements,
    saveElementDirectly,
    deleteElementDirectly,
    loadImage,
  };
}
