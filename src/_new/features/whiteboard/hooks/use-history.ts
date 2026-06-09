/**
 * use-history.ts
 *
 * Hook zarządzający historią undo/redo na tablicy.
 *
 * Dwa systemy działają równolegle:
 *  1. history[]  — legacy pełna historia stanów (używana przez rendering, maksymalnie 50 snaphotów)
 *  2. userUndoStack / userRedoStack — nowy system, śledzi TYLKO akcje bieżącego użytkownika (create/delete)
 *     Każde Ctrl+Z/Y odwraca tylko to co zrobiłeś ty, nie cudze zmiany.
 *
 * Zależności zewnętrzne przekazywane jako parametry (nie hardkodowane wewnątrz hooka):
 *  - onDeleteElement  — usuwa element z bazy danych
 *  - onSaveElement    — zapisuje element do bazy danych
 *  - onBroadcastCreated / onBroadcastDeleted — wysyłają event do innych użytkowników przez Supabase
 */

import { useState, useRef, useCallback } from 'react';
import type { DrawingElement, UserAction } from '../types';
import type { Command, CommandContext } from '../commands';
import { commandFromUserAction } from '../commands';

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface UseHistoryOptions {
  /** Usuń element z bazy danych (używane przy undo create / redo delete) */
  onDeleteElement: (boardId: number, elementId: string) => Promise<void>;
  /** Zapisz element do bazy danych (używane przy undo delete / redo create) */
  onSaveElement: (boardId: number, element: DrawingElement) => Promise<void>;
  /** Broadcast "element created" do innych użytkowników */
  onBroadcastCreated: (element: DrawingElement) => Promise<void>;
  /** Broadcast "element deleted" do innych użytkowników */
  onBroadcastDeleted: (elementId: string) => Promise<void>;
  /** Broadcast "element updated" do innych użytkowników (używane przy undo/redo update) */
  onBroadcastUpdated: (element: DrawingElement) => Promise<void>;
  /**
   * Usuń element z lokalnego stanu React (setElements).
   * BEZ tego undo 'create' tylko broadcastuje i usuwa z bazy,
   * ale element zostaje widoczny na ekranie użytkownika.
   */
  onRemoveElement: (elementId: string) => void;
  /**
   * Dodaj element do lokalnego stanu React (setElements).
   * BEZ tego undo 'delete' tylko broadcastuje i zapisuje do bazy,
   * ale element nie pojawia się z powrotem na ekranie użytkownika.
   */
  onAddElement: (element: DrawingElement) => void;
  /**
   * Zaktualizuj element w lokalnym stanie React (używane przy undo/redo update).
   */
  onUpdateElement: (element: DrawingElement) => void;
  /** Funkcja do czyszczenia zaznaczenia po undo/redo */
  onClearSelection: () => void;
  /** Ref do aktualnych niezapisanych elementów (żeby wiedzieć czy element jest w bazie) */
  unsavedElementsRef: React.RefObject<Set<string>>;
  /** Ref do aktualnego boardId */
  boardIdRef: React.RefObject<string>;
}

export interface UseHistoryReturn {
  /** Zapisz nowy snapshot do historii (wywołaj po każdej zmianie elementów) */
  saveToHistory: (elements: DrawingElement[]) => void;
  /** Cofnij ostatnią akcję bieżącego użytkownika */
  undo: () => void;
  /** Ponów cofniętą akcję */
  redo: () => void;
  /** Zarejestruj akcję użytkownika (żeby undo wiedziało co cofać) */
  pushUserAction: (action: UserAction) => void;
  /** Czy jest co cofać */
  canUndo: boolean;
  /** Czy jest co ponawiać */
  canRedo: boolean;
  /** Aktualny histogram stanów (do debugowania) */
  historyLength: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const MAX_HISTORY_SIZE = 50;

export function useHistory({
  onDeleteElement,
  onSaveElement,
  onBroadcastCreated,
  onBroadcastDeleted,
  onBroadcastUpdated,
  onRemoveElement,
  onAddElement,
  onUpdateElement,
  onClearSelection,
  unsavedElementsRef,
  boardIdRef,
}: UseHistoryOptions): UseHistoryReturn {

  // Legacy history — pełna historia stanów (snapshoty tablicy)
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);

  // Nowy system — stos KOMEND tylko bieżącego użytkownika (wzorzec Command).
  // Każda komenda umie się wykonać (do) i cofnąć (undo) — undo/redo nie mają
  // już ani jednego if/else po typie akcji.
  const userUndoStackRef = useRef<Command[]>([]);
  const userRedoStackRef = useRef<Command[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ─── Kontekst komend ─────────────────────────────────────────────────────
  // Opakowuje callbacki tego hooka w CommandContext. To jedyne miejsce, gdzie
  // komendy stykają się z realnymi efektami (stan React, broadcast, baza).
  const getContext = useCallback((): CommandContext => ({
    addElement: onAddElement,
    removeElement: onRemoveElement,
    updateElement: onUpdateElement,
    broadcastCreated: onBroadcastCreated,
    broadcastDeleted: onBroadcastDeleted,
    broadcastUpdated: onBroadcastUpdated,
    saveElement: onSaveElement,
    deleteElement: onDeleteElement,
    boardIdRef,
    unsavedElementsRef,
  }), [
    onAddElement, onRemoveElement, onUpdateElement,
    onBroadcastCreated, onBroadcastDeleted, onBroadcastUpdated,
    onSaveElement, onDeleteElement, boardIdRef, unsavedElementsRef,
  ]);

  // ─── Zapisz snapshot stanu ──────────────────────────────────────────────
  const saveToHistory = useCallback((newElements: DrawingElement[]) => {
    setHistory((prev) => {
      const currentIndex = historyIndexRef.current;
      const trimmed = prev.slice(0, currentIndex + 1);
      trimmed.push([...newElements]);

      if (trimmed.length > MAX_HISTORY_SIZE) {
        const sliced = trimmed.slice(trimmed.length - MAX_HISTORY_SIZE);
        historyIndexRef.current = sliced.length - 1;
        setHistoryIndex(sliced.length - 1);
        return sliced;
      }

      historyIndexRef.current = trimmed.length - 1;
      setHistoryIndex(trimmed.length - 1);
      return trimmed;
    });
  }, []);

  // ─── Zarejestruj akcję użytkownika (po create/delete/update) ────────────
  // Sygnatura pozostaje (action: UserAction) — wywołania w whiteboard-canvas
  // i use-clipboard działają bez zmian. Wewnętrznie akcja jest tłumaczona na
  // Command przez adapter zgodności wstecznej. pushUserAction TYLKO rejestruje
  // komendę (nie woła do()) — pierwsze wykonanie robią handlery w canvasie.
  const pushUserAction = useCallback((action: UserAction) => {
    userUndoStackRef.current = [...userUndoStackRef.current, commandFromUserAction(action)];
    // Każda nowa akcja czyści redo stack
    userRedoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // ─── Undo ───────────────────────────────────────────────────────────────
  // Zdejmij ostatnią komendę z undo-stacku, cofnij ją i przełóż na redo-stack.
  const undo = useCallback(() => {
    const undoStack = userUndoStackRef.current;
    if (undoStack.length === 0) return;

    const lastCommand = undoStack[undoStack.length - 1];
    userUndoStackRef.current = undoStack.slice(0, -1);
    userRedoStackRef.current = [...userRedoStackRef.current, lastCommand];

    setCanUndo(userUndoStackRef.current.length > 0);
    setCanRedo(true);

    lastCommand.undo(getContext());
    onClearSelection();
  }, [getContext, onClearSelection]);

  // ─── Redo ───────────────────────────────────────────────────────────────
  // Zdejmij ostatnią komendę z redo-stacku, wykonaj ją i przełóż na undo-stack.
  const redo = useCallback(() => {
    const redoStack = userRedoStackRef.current;
    if (redoStack.length === 0) return;

    const lastCommand = redoStack[redoStack.length - 1];
    userRedoStackRef.current = redoStack.slice(0, -1);
    userUndoStackRef.current = [...userUndoStackRef.current, lastCommand];

    setCanUndo(true);
    setCanRedo(userRedoStackRef.current.length > 0);

    lastCommand.do(getContext());
    onClearSelection();
  }, [getContext, onClearSelection]);

  return {
    saveToHistory,
    undo,
    redo,
    pushUserAction,
    canUndo,
    canRedo,
    historyLength: history.length,
  };
}
