/**
 * use-selection.ts
 *
 * Zarządza stanem zaznaczenia elementów na tablicy.
 *
 * ODPOWIEDZIALNOŚĆ:
 *  - Zestaw zaznaczonych ID (`selectedElementIds`)
 *  - Który element text/markdown jest teraz edytowany (`editingTextId`, `editingMarkdownId`)
 *  - Stabilne referencje do odczytu w event handlerach
 *
 * NIE robi:
 *  - Nie oblicza granic zaznaczenia (to jest w SelectTool.tsx)
 *  - Nie obsługuje drag-select rysowania prostokąta zaznaczenia (to jest w SelectTool.tsx)
 *  - Nie zmienia pozycji elementów (to jest w SelectTool.tsx)
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface UseSelectionReturn {
  selectedElementIds: Set<string>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Stabilna referencja — bezpieczna do odczytu w event handlerach */
  selectedElementIdsRef: React.RefObject<Set<string>>;
  /** ID elementu tekstowego aktualnie w trybie edycji (null = żaden) */
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  /** ID notatki Markdown aktualnie w trybie edycji (null = żaden) */
  editingMarkdownId: string | null;
  setEditingMarkdownId: (id: string | null) => void;
  /** Skrót: usuń wszystkie zaznaczenia i wyjdź z trybów edycji */
  clearSelection: () => void;
  /** Zaznacz pojedynczy element (resetuje poprzednie zaznaczenie) */
  selectElement: (id: string) => void;
  /** Przełącz zaznaczenie elementu (Ctrl+click) */
  toggleElement: (id: string) => void;
  /** Zaznacz wiele elementów naraz (np. z historii aktywności) */
  selectElements: (ids: string[]) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSelection(): UseSelectionReturn {
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingMarkdownId, setEditingMarkdownId] = useState<string | null>(null);

  // Stabilna referencja — event handlery korzystają z niej bez closures
  const selectedElementIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedElementIdsRef.current = selectedElementIds;
  }, [selectedElementIds]);

  const clearSelection = useCallback(() => {
    setSelectedElementIds(new Set());
    setEditingTextId(null);
    setEditingMarkdownId(null);
  }, []);

  const selectElement = useCallback((id: string) => {
    setSelectedElementIds(new Set([id]));
  }, []);

  const toggleElement = useCallback((id: string) => {
    setSelectedElementIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectElements = useCallback((ids: string[]) => {
    setSelectedElementIds(new Set(ids));
  }, []);

  return {
    selectedElementIds,
    setSelectedElementIds,
    selectedElementIdsRef,
    editingTextId,
    setEditingTextId,
    editingMarkdownId,
    setEditingMarkdownId,
    clearSelection,
    selectElement,
    toggleElement,
    selectElements,
  };
}
