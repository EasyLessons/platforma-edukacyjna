/**
 * USE BOARDS HOOK
 *
 * Hook zarządzający tablicami w danym workspace'ie.
 *
 * Odpowiada za:
 * - Pobieranie listy tablic
 * - Tworzenie nowej tablicy
 * - Aktualizacja tablicy
 * - Usuwanie tablicy
 * - Toggle ulubione
 * - Zarządzanie stanem (loading, error)
 *
 */

import { useState, useEffect } from 'react';
import {
  fetchBoards,
  createBoard as apiCreateBoard,
  updateBoard as apiUpdateBoard,
  deleteBoard as apiDeleteBoard,
  toggleBoardFavourite as apiToggleFavourite,
} from '../api/board-api';
import type { Board, BoardCreateRequest, BoardUpdateRequest } from '../types';

interface UseBoardsOptions {
  workspaceId: number | null;
  autoLoad?: boolean;
}

export function useBoards(options: UseBoardsOptions) {
  const { workspaceId, autoLoad = true } = options;

  // STATE
  // ================================

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // BOARD CRUD
  // ================================

  // loadBoards - Pobiera tablice z backendu
  const loadBoards = async () => {
    if (!workspaceId) {
      setBoards([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetchBoards(workspaceId);
      setBoards(response.boards);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Błąd ładowania tablic';
      setError(errorMessage);
      console.error('Error loading boards:', err);
    } finally {
      setLoading(false);
    }
  };

  // createBoard - Tworzy nową tablicę
  const createBoard = async (data: BoardCreateRequest) => {
    const newBoard = await apiCreateBoard(data);

    // Optimistic update - dodaj do listy od razu
    setBoards((prev) => [...prev, newBoard]);

    return newBoard;
  };

  // updateBoard - Aktualizuje tablicę
  const updateBoard = async (id: number, data: BoardUpdateRequest) => {
    const updatedBoard = await apiUpdateBoard(id, data);

    // Update w stanie
    setBoards((prev) => prev.map((b) => (b.id === id ? updatedBoard : b)));

    return updatedBoard;
  };

  // deleteBoard - Usuwa tablicę
  const deleteBoard = async (id: number) => {
    await apiDeleteBoard(id);

    // Usuń ze stanu
    setBoards((prev) => prev.filter((b) => b.id !== id));
  };

  // toggleFavourite - Dodaje/usuwa tablicę z ulubionych
  const toggleFavourite = async (id: number, isFavourite: boolean) => {
    await apiToggleFavourite(id, isFavourite);

    // Update w stanie
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, is_favourite: isFavourite } : b)));
  };

  // HELPERS
  // ================================

  // refreshBoards - Odśwież listę tablic
  const refreshBoards = loadBoards;

  // getBoardById - Znajdź tablicę w stanie
  const getBoardById = (id: number): Board | undefined => {
    return boards.find((b) => b.id === id);
  };

  // EFFECTS
  // ================================

  // Pobierz tablice gdy workspaceId się zmieni
  useEffect(() => {
    if (autoLoad) {
      loadBoards();
    }
  }, [workspaceId]);

  return {
    // State
    boards,
    loading,
    error,
    // CRUD
    createBoard,
    updateBoard,
    deleteBoard,
    toggleFavourite,
    // Helpers
    refreshBoards,
    getBoardById,
  };
}
