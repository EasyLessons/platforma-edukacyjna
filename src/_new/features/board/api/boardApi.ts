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
  BoardMembersResponse,
  UpdateSettingsResponse,
  JoinBoardResponse,
  BoardSettings,
} from '../types';

export const fetchBoards = (
  workspace_id: number,
  limit = 10,
  offset = 0
): Promise<BoardListResponse> =>
  apiClient
    .get<BoardListResponse>('/api/v1/boards', {
      params: { workspace_id, limit, offset },
    })
    .then((res) => res.data);

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

export const fetchBoardMembers = (id: number): Promise<BoardMembersResponse> =>
  apiClient.get<BoardMembersResponse>(`/api/v1/boards/${id}/members`).then((res) => res.data);

export const updateBoardMemberRole = (
  id: number,
  user_id: number,
  role: 'editor' | 'viewer'
): Promise<{ message: string; new_role: string }> =>
  apiClient
    .patch<{
      message: string;
      new_role: string;
    }>(`/api/v1/boards/${id}/members/${user_id}/role`, { role })
    .then((res) => res.data);

export const updateBoardSettings = (
  id: number,
  settings: BoardSettings,
): Promise<UpdateSettingsResponse> =>
  apiClient.put<UpdateSettingsResponse>(
    `/api/v1/boards/${id}/settings`,
    { settings },
  ).then(res => res.data);

export const joinBoardWorkspace = (id: number): Promise<JoinBoardResponse> =>
  apiClient
    .post<JoinBoardResponse>(`/api/v1/boards/${id}/join`)
    .then(res => res.data);
