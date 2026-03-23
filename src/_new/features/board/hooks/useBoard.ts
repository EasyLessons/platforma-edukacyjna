/**
 * USE BOARDS HOOK
 *
 * Hook zarządzający tablicami w danym workspace'ie.
 *
 * Odpowiada za:
 * - Pobieranie listy tablic (z cache React Query — 5 min stale time)
 * - Tworzenie nowej tablicy
 * - Aktualizacja tablicy
 * - Usuwanie tablicy
 * - Toggle ulubione
 * - Inwalidacja/aktualizacja cache po mutacjach
 */
'use client'

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBoards,
  createBoard as apiCreateBoard,
  updateBoard as apiUpdateBoard,
  deleteBoard as apiDeleteBoard,
  toggleBoardFavourite as apiToggleFavourite,
} from '../api/boardApi';
import type { Board, BoardCreateRequest, BoardListResponse, BoardUpdateRequest } from '../types';

// ─── Query key factory ───────────────────────────────────────────────────────
export const boardKeys = {
  all: ['boards'] as const,
  workspace: (workspaceId: number) => ['boards', workspaceId] as const,
};

// ─── Hook options ─────────────────────────────────────────────────────────────
interface UseBoardsOptions {
  workspace_id: number | null;
  autoLoad?: boolean;
}

export function useBoards(options: UseBoardsOptions) {
  const { workspace_id, autoLoad = true } = options;
  const queryClient = useQueryClient();

  // ── QUERY ──────────────────────────────────────────────────────────────────
  // Dane są cache'owane przez 5 minut (staleTime globalny z query-provider.tsx).
  // Powrót do wcześniej załadowanego workspace'a jest natychmiastowy — bez
  // żadnego request do API, dopóki cache nie wygaśnie.

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery<BoardListResponse>({
    queryKey: boardKeys.workspace(workspace_id!),
    queryFn: () => fetchBoards(workspace_id!),
    enabled: !!workspace_id && autoLoad,
  });

  const boards: Board[] = data?.boards ?? [];
  const error: string | null = queryError
    ? (queryError instanceof Error ? queryError.message : String(queryError))
    : null;

  // ── MUTATIONS ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: BoardCreateRequest) => apiCreateBoard(payload),
    onSuccess: () => {
      // Pełna inwalidacja — backend zwraca posortowaną listę z metadanymi,
      // więc prościej przeładować niż próbować wstawić ręcznie.
      if (workspace_id) {
        queryClient.invalidateQueries({ queryKey: boardKeys.workspace(workspace_id) });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BoardUpdateRequest }) =>
      apiUpdateBoard(id, data),
    onSuccess: (updated) => {
      // Optimistic cache update — zamień konkretny rekord bez round-tripu.
      if (workspace_id) {
        queryClient.setQueryData<BoardListResponse>(
          boardKeys.workspace(workspace_id),
          (old) =>
            old
              ? { ...old, boards: old.boards.map((b) => (b.id === updated.id ? updated : b)) }
              : old,
        );
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDeleteBoard(id),
    onSuccess: (_, deletedId) => {
      if (workspace_id) {
        queryClient.setQueryData<BoardListResponse>(
          boardKeys.workspace(workspace_id),
          (old) =>
            old
              ? { ...old, boards: old.boards.filter((b) => b.id !== deletedId), total: (old.total ?? 0) - 1 }
              : old,
        );
      }
    },
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: ({ id, is_favourite }: { id: number; is_favourite: boolean }) =>
      apiToggleFavourite(id, is_favourite),
    onSuccess: (_, { id, is_favourite }) => {
      if (workspace_id) {
        queryClient.setQueryData<BoardListResponse>(
          boardKeys.workspace(workspace_id),
          (old) =>
            old
              ? { ...old, boards: old.boards.map((b) => (b.id === id ? { ...b, is_favourite } : b)) }
              : old,
        );
      }
    },
  });

  // ── Public API (zachowana sygnatura dla komponentów) ───────────────────────

  const createBoard = useCallback(
    (payload: BoardCreateRequest): Promise<Board> => createMutation.mutateAsync(payload),
    [createMutation]
  );

  const updateBoard = useCallback(
    (id: number, data: BoardUpdateRequest): Promise<Board> => updateMutation.mutateAsync({ id, data }),
    [updateMutation]
  );

  const deleteBoard = useCallback(
    (id: number): Promise<void> => deleteMutation.mutateAsync(id),
    [deleteMutation]
  );

  const toggleFavourite = useCallback(
    (id: number, is_favourite: boolean): Promise<void> =>
      toggleFavouriteMutation.mutateAsync({ id, is_favourite }).then(() => undefined),
    [toggleFavouriteMutation]
  );

  const refreshBoards = useCallback(() => {
    if (workspace_id) {
      queryClient.invalidateQueries({ queryKey: boardKeys.workspace(workspace_id) });
    }
  }, [workspace_id, queryClient]);

  const getBoardById = useCallback(
    (id: number): Board | undefined => boards.find((b) => b.id === id),
    [boards]
  );

  return useMemo(
    () => ({
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
    }),
    [
      boards,
      loading,
      error,
      createBoard,
      updateBoard,
      deleteBoard,
      toggleFavourite,
      refreshBoards,
      getBoardById,
    ]
  );
}
