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
 */
'use client'

import { useState, useEffect } from 'react';
import {
  fetchBoards,
  createBoard as apiCreateBoard,
  updateBoard as apiUpdateBoard,
  deleteBoard as apiDeleteBoard,
  toggleBoardFavourite as apiToggleFavourite,
} from '../api/boardApi';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { Board, BoardCreateRequest, BoardUpdateRequest } from '../types';

interface UseBoardsOptions {
  workspace_id: number | null;
  autoLoad?: boolean;
}

export function useBoards(options: UseBoardsOptions) {
  const { workspace_id, autoLoad = true } = options;

  // STATE
  // ================================

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { handleError } = useErrorHandler({ onError: setError });

  // BOARD CRUD

  const loadBoards = async () => {
    if (!workspace_id) {
      setBoards([]);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetchBoards(workspace_id);
      setBoards(response.boards);
    } catch (err) {
      await handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async (data: BoardCreateRequest) => {
    const newBoard = await apiCreateBoard(data);
    setBoards((prev) => [...prev, newBoard]);
    return newBoard;
  };

  const updateBoard = async (id: number, data: BoardUpdateRequest): Promise<Board> => {
    const updated = await apiUpdateBoard(id, data);
    setBoards((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  };

  const deleteBoard = async (id: number): Promise<void> => {
    await apiDeleteBoard(id);
    setBoards((prev) => prev.filter((b) => b.id !== id));
  };

  const toggleFavourite = async (id: number, is_favourite: boolean): Promise<void> => {
    await apiToggleFavourite(id, is_favourite);
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, is_favourite } : b)));
  };

  // HELPERS

  const refreshBoards = loadBoards;
  const getBoardById = (id: number): Board | undefined => {
    return boards.find((b) => b.id === id);
  };

  // EFFECTS

  // Pobierz tablice gdy workspaceId się zmieni
  useEffect(() => {
    if (autoLoad) loadBoards();
  }, [workspace_id, autoLoad]);

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
