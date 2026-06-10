/**
 * use-history.ts
 *
 * Hook zarządzający historią undo/redo na tablicy — wzorzec Command.
 *
 * Historia to stos KOMEND bieżącego użytkownika (userUndoStack / userRedoStack).
 * Każda komenda umie się wykonać (do) i cofnąć (undo); undo/redo nie mają ani
 * jednego if/else po typie akcji. Każde Ctrl+Z/Y odwraca tylko TWOJE zmiany.
 *
 * Zależności zewnętrzne przekazywane jako parametry (nie hardkodowane wewnątrz):
 *  - onDeleteElement / onSaveElement — baza danych
 *  - onBroadcastCreated/Deleted/Updated — Supabase Realtime
 *  - onAddElement / onRemoveElement / onUpdateElement — lokalny stan React
 */

import { useState, useRef, useCallback } from 'react';
import type { DrawingElement } from '../types';
import type { Command, CommandContext } from '../commands';

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
  /** Broadcast "element updated" do innych użytkowników (undo/redo update) */
  onBroadcastUpdated: (element: DrawingElement) => Promise<void>;
  /** Usuń element z lokalnego stanu React (setElements) */
  onRemoveElement: (elementId: string) => void;
  /** Dodaj element do lokalnego stanu React (setElements) */
  onAddElement: (element: DrawingElement) => void;
  /** Zaktualizuj element w lokalnym stanie React */
  onUpdateElement: (element: DrawingElement) => void;
  /** Czyszczenie zaznaczenia po undo/redo */
  onClearSelection: () => void;
  /** Ref do niezapisanych elementów (czy element jest już w bazie) */
  unsavedElementsRef: React.RefObject<Set<string>>;
  /** Ref do aktualnego boardId */
  boardIdRef: React.RefObject<string>;
}

export interface UseHistoryReturn {
  /** Cofnij ostatnią akcję bieżącego użytkownika */
  undo: () => void;
  /** Ponów cofniętą akcję */
  redo: () => void;
  /**
   * Zarejestruj gotową komendę na stosie undo (API silnika).
   * Komenda jest tylko zapamiętywana — NIE jest wykonywana (do() robi wywołujący
   * przez optymistyczny update). Undo/redo wywołają jej undo()/do().
   */
  recordCommand: (command: Command) => void;
  /** Czy jest co cofać */
  canUndo: boolean;
  /** Czy jest co ponawiać */
  canRedo: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

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

  // Stos KOMEND bieżącego użytkownika (wzorzec Command).
  const userUndoStackRef = useRef<Command[]>([]);
  const userRedoStackRef = useRef<Command[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ─── Kontekst komend ─────────────────────────────────────────────────────
  // Opakowuje callbacki hooka w CommandContext — jedyne miejsce styku komend
  // z realnymi efektami (stan React, broadcast, baza).
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

  // ─── Zarejestruj komendę na stosie undo ──────────────────────────────────
  // Komenda jest TYLKO zapamiętywana (nie woła do()) — pierwsze wykonanie robi
  // wywołujący przez optymistyczny update (intencje WhiteboardEngine / handlery).
  const recordCommand = useCallback((command: Command) => {
    userUndoStackRef.current = [...userUndoStackRef.current, command];
    userRedoStackRef.current = []; // nowa akcja czyści redo stack
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // ─── Undo ───────────────────────────────────────────────────────────────
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
    undo,
    redo,
    recordCommand,
    canUndo,
    canRedo,
  };
}
