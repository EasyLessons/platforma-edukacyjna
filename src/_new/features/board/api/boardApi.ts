/**
 * BOARD API
 *
 * Funkcje do komunikacji z backendem FastAPI.
 *
 * FUNKCJE:
 * - fetchBoards()              → Pobiera listę tablic w workspace
 * - fetchBoardById()           → Pobiera jedną tablicę
 * - createBoard()              → Tworzy nową tablicę
 * - updateBoard()              → Aktualizuje tablicę
 * - deleteBoard()              → Usuwa tablicę
 * - toggleBoardFavourite()     → Ulubione
 */
import { apiClient } from '@/_new/lib/api';

import type {
  Board,
  BoardCreateRequest,
  BoardUpdateRequest,
  BoardListResponse,
  BoardToggleFavouriteResponse,
  UpdateSettingsResponse,
  BoardSettings,
} from '../types';

export const fetchBoards = (
  workspace_id: number,
  limit = 50,
  offset = 0
): Promise<BoardListResponse> =>
  apiClient
    .get<{ boards: BoardListResponse }>(`/api/v1/workspaces/${workspace_id}`, {
      params: { boards_limit: limit, boards_offset: offset },
    })
    .then((res) => res.data.boards);

export const fetchBoardById = (id: number): Promise<Board> =>
  apiClient.get<Board>(`/api/v1/boards/${id}`).then((res) => res.data);

export const createBoard = (data: BoardCreateRequest): Promise<Board> =>
  apiClient.post<Board>('/api/v1/boards', data).then((res) => res.data);

export const updateBoard = (id: number, data: BoardUpdateRequest): Promise<Board> =>
  apiClient.put<Board>(`/api/v1/boards/${id}`, data).then((res) => res.data);

export const deleteBoard = (id: number): Promise<void> =>
  apiClient.delete(`/api/v1/boards/${id}`).then(() => undefined);

export const toggleBoardFavourite = (
  id: number,
  is_favourite: boolean
): Promise<BoardToggleFavouriteResponse> =>
  apiClient
    .post<BoardToggleFavouriteResponse>(`/api/v1/boards/${id}/toggle-favourite`, { is_favourite })
    .then((res) => res.data);

export const updateBoardSettings = (
  id: number,
  settings: BoardSettings
): Promise<UpdateSettingsResponse> =>
  apiClient
    .put<UpdateSettingsResponse>(`/api/v1/boards/${id}/settings`, { settings })
    .then((res) => res.data);
