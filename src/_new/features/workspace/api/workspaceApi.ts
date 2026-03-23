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
 */
import { apiClient } from '@/_new/lib/api';

import type {
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceUpdateRequest,
  WorkspaceListResponse,
} from '../types';

export const fetchWorkspaces = (): Promise<WorkspaceListResponse> =>
  apiClient.get<WorkspaceListResponse>('/api/v1/workspaces').then((res) => res.data);

export const fetchWorkspaceById = (id: number): Promise<Workspace> =>
  apiClient.get<Workspace>('/api/v1/workspaces/${id}').then((res) => res.data);

export const createWorkspace = (data: WorkspaceCreateRequest): Promise<Workspace> =>
  apiClient.post<Workspace>('/api/v1/workspaces', data).then((res) => res.data);

export const updateWorkspace = (id: number, data: WorkspaceUpdateRequest): Promise<Workspace> =>
  apiClient.put<Workspace>(`/api/v1/workspaces/${id}`, data).then((res) => res.data);

export const deleteWorkspace = (id: number): Promise<void> =>
  apiClient.delete(`/api/v1/workspaces/${id}`).then(() => undefined);

export const leaveWorkspace = (id: number): Promise<{ message: string }> =>
  apiClient.delete<{ message: string }>(`/api/v1/workspaces/${id}/leave`).then((res) => res.data);

export const toggleWorkspaceFavourite = (id: number, is_favourite: boolean): Promise<void> =>
  apiClient.patch(`/api/v1/workspaces/${id}/favourite`, { is_favourite }).then(() => undefined);

export const setActiveWorkspace = (id: number): Promise<void> =>
  apiClient.patch(`/api/v1/workspaces/${id}/set-active`).then(() => undefined);
