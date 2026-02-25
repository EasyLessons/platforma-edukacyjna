/**
 * WORKSPACE API
 *
 * Plik zawiera wszystkie funkcje do komunikacji z backendem FastAPI.
 *
 * FUNKCJE:
 * - fetchWorkspaces() → Pobiera listę workspace'ów użytkownika
 * - fetchWorkspaceById() → Pobiera jeden workspace
 * - createWorkspace() → Tworzy nowy workspace
 * - updateWorkspace() → Aktualizuje workspace
 * - deleteWorkspace() → Usuwa workspace
 * - toggleWorkspaceFavourite() → Ulubione
 * - fetchWorkspaceMembers() → Lista członków
 * - removeWorkspaceMember() → Usuwa członka
 * - updateMemberRole() → Zmienia rolę członka
 */

import type {
    Workspace,
    WorkspaceCreateRequest,
    WorkspaceUpdateRequest,
    WorkspaceListResponse,
    WorkspaceMembersResponse,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// HELPERS
// ================================

// Obsługa odpowiedzi z API
const handleResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data.detail || 'Wystąpił błąd';
    throw new Error(errorMessage);
  }

  return data;
};

// Pobiera token z localStorage
export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
};

// WORKSPACE CRUD
// ================================

// fetchWorkspaces - Pobiera listę workspace'ów użytkownika
export const fetchWorkspaces = async (): Promise<WorkspaceListResponse> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

// fetchWorkspaceById - Pobiera jeden workspace po ID
export const fetchWorkspaceById = async (id: number): Promise<Workspace> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/workspaces/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

// createWorkspace - Tworzy nowy workspace
export const createWorkspace = async (
  data: WorkspaceCreateRequest
): Promise<Workspace> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

// updateWorkspace - Aktualizuje workspace
export const updateWorkspace = async (
  id: number,
  data: WorkspaceUpdateRequest
): Promise<Workspace> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/workspaces/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

// deleteWorkspace - Usuwa workspace
export const deleteWorkspace = async (id: number): Promise<void> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/workspaces/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

// leaveWorkspace - Opuszcza workspace (członek)
export const leaveWorkspace = async (
  id: number
): Promise<{ message: string }> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/workspaces/${id}/leave`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

// toggleWorkspaceFavourite - Dodaje/usuwa workspace z ulubionych
export const toggleWorkspaceFavourite = async (
  workspaceId: number,
  isFavourite: boolean
): Promise<void> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/favourite`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_favourite: isFavourite }),
    }
  );

  return handleResponse(response);
};

// WORKSPACE MEMBERS
// ================================

// fetchWorkspaceMembers - Pobiera listę członków workspace'a
export const fetchWorkspaceMembers = async (
  workspaceId: number
): Promise<WorkspaceMembersResponse> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/members`,
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

// removeWorkspaceMember - Usuwa członka z workspace'a
export const removeWorkspaceMember = async (
  workspaceId: number,
  userId: number
): Promise<{ message: string }> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/members/${userId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse(response);
};

// updateMemberRole - Zmienia rolę członka workspace'a
export const updateMemberRole = async (
  workspaceId: number,
  userId: number,
  role: 'owner' | 'editor' | 'viewer'
): Promise<{ message: string; new_role: string }> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/members/${userId}/role`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    }
  );

  return handleResponse(response);
};
