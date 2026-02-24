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
 * - fetchBoardOnlineUsers()    → Użytkownicy online na tablicy
 */

import type {
  Board,
  BoardCreateRequest,
  BoardUpdateRequest,
  BoardListResponse,
  BoardToggleFavouriteRequest,
  BoardToggleFavouriteResponse,
} from '../types';
import type { OnlineUser } from '@/_new/shared/types/user';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// HELPERS
// ================================

const handleResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data.detail || 'Wystąpił błąd';
    throw new Error(errorMessage);
  }

  return data;
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
};

// BOARD CRUD
// ================================

// fetchBoards - Pobiera listę tablic w workspace
export const fetchBoards = async (
  workspaceId: number,
  limit = 10,
  offset = 0
): Promise<BoardListResponse> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/boards?workspace_id=${workspaceId}&limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse(response);
};

// fetchBoardById - Pobiera jedną tablicę po ID
export const fetchBoardById = async (boardId: number): Promise<Board> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

// createBoard - Tworzy nową tablicę
export const createBoard = async (data: BoardCreateRequest): Promise<Board> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/boards`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

// updateBoard - Aktualizuje tablicę
export const updateBoard = async (
  boardId: number,
  data: BoardUpdateRequest
): Promise<Board> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

// deleteBoard - Usuwa tablicę
export const deleteBoard = async (boardId: number): Promise<void> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

// toggleBoardFavourite - Dodaje/usuwa tablicę z ulubionych
export const toggleBoardFavourite = async (
  boardId: number,
  isFavourite: boolean
): Promise<BoardToggleFavouriteResponse> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const body: BoardToggleFavouriteRequest = { is_favourite: isFavourite };

  const response = await fetch(
    `${API_BASE_URL}/api/boards/${boardId}/toggle-favourite`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  return handleResponse(response);
};

// ONLINE USERS
// ================================

// fetchBoardOnlineUsers - Pobiera użytkowników online na tablicy
export const fetchBoardOnlineUsers = async (
  boardId: number
): Promise<OnlineUser[]> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/boards/${boardId}/online-users`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse(response);
};
