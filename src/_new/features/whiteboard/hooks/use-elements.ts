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
  loadBoardElements as apiLoadElements,
  saveBoardElementsBatch,
  deleteBoardElement as apiDeleteElement,
  toSaveFormat,
} from '../api/elements-api';
import type { DrawingElement, ImageElement } from '../types';
import type { BoardElementWithAuthor } from '../api/elements-api';

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
  /** Zapisz element do bazy danych bezpośrednio (dla undo/redo) */
  /** Zaktualizuj wiele elementów naraz (Bulk Update) */
  updateElements: (updates: DrawingElement[]) => void;
  saveElementDirectly: (boardIdNum: number, element: DrawingElement) => Promise<void>;
  /** Usuń element z bazy danych bezpośrednio (dla undo/redo) */
  deleteElementDirectly: (boardIdNum: number, elementId: string) => Promise<void>;
  /** Załaduj obraz do cache */
  loadImage: (id: string, src: string) => void;
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

  // Stabilne referencje
  const elementsRef = useRef<DrawingElement[]>(elements);
  const unsavedElementsRef = useRef<Set<string>>(new Set());
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { unsavedElementsRef.current = unsavedElements; }, [unsavedElements]);

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

        const dbElements = rawElements.map((e: BoardElementWithAuthor) => e.data);

        // 🔥 INTELIGENTNE ŁĄCZENIE ELEMENTÓW
        setElements((prev) => {
          const currentRamMap = new Map(prev.map(e => [e.id, e]));
          
          // Krok 1: Wersja RAM > Wersja DB. Jeśli element jest już w pamięci z WebSocket, ignoruj bazę!
          const merged = dbElements.map(dbEl => 
            currentRamMap.has(dbEl.id) ? currentRamMap.get(dbEl.id)! : dbEl
          );

          // Krok 2: Kreski z RAM, których baza jeszcze w ogóle nie zna
          const dbMap = new Map(dbElements.map(e => [e.id, e]));
          prev.forEach(ramEl => {
            if (!dbMap.has(ramEl.id)) merged.push(ramEl);
          });
          
          elementsRef.current = merged; // Natychmiastowa synchronizacja refa
          return merged;
        });

        // 🔥 INTELIGENTNE ŁĄCZENIE AUTORÓW (żeby panele boczne nie wariowały)
        setElementsWithAuthor((prev) => {
          const currentRamMap = new Map(prev.map(e => [e.element_id, e]));
          
          const merged = rawElements.map(dbEl => 
            currentRamMap.has(dbEl.element_id) ? currentRamMap.get(dbEl.element_id)! : dbEl
          );

          const dbMap = new Map(rawElements.map(e => [e.element_id, e]));
          prev.forEach(ramEl => {
            if (!dbMap.has(ramEl.element_id)) merged.push(ramEl);
          });
          
          return merged;
        });

        setLoadingProgress(70);

        // Załaduj wszystkie obrazy
        const imageEls = dbElements.filter((el: DrawingElement) => el.type === 'image');
        if (imageEls.length === 0) {
          setLoadingProgress(100);
          setTimeout(() => setIsLoading(false), 300);
          return;
        }

        let loaded_ = 0;
        await Promise.all(
          imageEls.map(
            (el: DrawingElement) =>
              new Promise<void>((resolve) => {
                if (el.type === 'image' && (el as ImageElement).src) {
                  const img = new Image();
                  img.src = (el as ImageElement).src;
                  img.onload = () => {
                    setLoadedImages((prev) => new Map(prev).set(el.id, img));
                    loaded_++;
                    setLoadingProgress(90 + (loaded_ / imageEls.length) * 10);
                    resolve();
                  };
                  img.onerror = () => { loaded_++; resolve(); };
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
  }, [boardId]);

  // ─── Debounced save ────────────────────────────────────────────────────
  const debouncedSave = useCallback((boardIdStr: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      const boardIdNum = parseInt(boardIdStr);
      if (isNaN(boardIdNum)) return;
      if (isSavingRef.current || unsavedElementsRef.current.size === 0) return;

      try {
        setIsSaving(true);
        isSavingRef.current = true;

        const toSave = elementsRef.current.filter((el) =>
          unsavedElementsRef.current.has(el.id)
        );
        if (toSave.length === 0) return;

        await saveBoardElementsBatch(boardIdNum, toSaveFormat(toSave));

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
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // ─── Mutatory ──────────────────────────────────────────────────────────

  const markUnsaved = useCallback((ids: string[]) => {
    setUnsavedElements((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    debouncedSave(boardId);
  }, [boardId, debouncedSave]);

  const addElements = useCallback((newEls: DrawingElement[]) => {
    setElements((prev) => [...prev, ...newEls]);
    setElementsWithAuthor((prev) => [
      ...prev,
      ...newEls.map((el) => ({
        element_id: el.id,
        type: el.type,
        data: el,
        created_by_id: 0,
        created_by_username: '',
        created_at: new Date().toISOString(),
      })),
    ]);
  }, []);

  const removeElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setElementsWithAuthor((prev) => prev.filter((el) => el.element_id !== id));
  }, []);

  const updateElement = useCallback((updated: DrawingElement) => {
    setElements((prev) => prev.map((el) => (el.id === updated.id ? updated : el)));
    setElementsWithAuthor((prev) =>
      prev.map((el) => (el.element_id === updated.id ? { ...el, data: updated } : el))
    );
  }, []);

const updateElements = useCallback((updates: DrawingElement[]) => {
    // 1. NATYCHMIASTOWA synchronizacja refa (Zabija lagi na płótnie!)
    const updateMap = new Map(updates.map(u => [u.id, u]));
    elementsRef.current = elementsRef.current.map((e) => 
      updateMap.has(e.id) ? updateMap.get(e.id)! : e
    );
    
    // 2. Aktualizacja Reacta w tle (dla paneli bocznych)
    setElements([...elementsRef.current]);
  }, []);

  const saveElementDirectly = useCallback(
    async (boardIdNum: number, element: DrawingElement) => {
      await saveBoardElementsBatch(boardIdNum, toSaveFormat([element]));
    },
    []
  );

  const deleteElementDirectly = useCallback(
    async (boardIdNum: number, elementId: string) => {
      await apiDeleteElement(boardIdNum, elementId);
    },
    []
  );

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
