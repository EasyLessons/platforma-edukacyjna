/**
 * MEMBER API
 *
 * Komunikacja z backendem — zarządzanie członkami workspace'ów.
 */
import { apiClient } from '@/_new/lib/api';

import type { WorkspaceMembersResponse, MyRoleResponse } from '../types';

export const fetchWorkspaceMembers = (workspace_id: number): Promise<WorkspaceMembersResponse> =>
  apiClient
    .get<WorkspaceMembersResponse>(`/api/v1/workspaces/${workspace_id}/members`)
    .then((res) => res.data);

export const removeWorkspaceMember = (
  workspace_id: number,
  user_id: number
): Promise<{ message: string }> =>
  apiClient
    .delete<{ message: string }>(`/api/v1/workspaces/${workspace_id}/members/${user_id}`)
    .then((res) => res.data);

export const updateMemberRole = (
  workspace_id: number,
  user_id: number,
  role: 'owner' | 'editor' | 'viewer',
): Promise<{ message: string; new_role: string }> =>
  apiClient.patch<{ message: string; new_role: string }>(
    `/api/v1/workspaces/${workspace_id}/members/${user_id}/role`,
    { role },
  ).then(res => res.data);

export const getMyRole = (workspace_id: number): Promise<MyRoleResponse> =>
  apiClient.get<MyRoleResponse>(`/api/v1/workspaces/${workspace_id}/my-role`)
    .then(res => res.data);
