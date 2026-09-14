/**
 * invite-api.ts
 *
 * Funkcje do komunikacji z backend/dashboard/workspaces/invite_routes.py
 *
 * Endpointy:
 *   POST   /api/workspaces/{workspace_id}/invite         — wyślij zaproszenie
 *   POST   /api/workspaces/invites/accept/{token}        — akceptuj
 *   DELETE /api/workspaces/invites/{token}               — odrzuć
 *   GET    /api/workspaces/{workspace_id}/invite/users   — szukaj kandydatów do zaproszenia
 */

import { apiClient } from '@/_new/lib/api';
import { InviteResponse, AcceptInviteResponse, UserSearchResult } from '../types';

export const createInvite = (
  workspace_id: number,
  invited_user_id: number
): Promise<InviteResponse> =>
  apiClient
    .post<InviteResponse>(`/api/v1/workspaces/${workspace_id}/invite`, { invited_user_id })
    .then((res) => res.data);

export const acceptInvite = (invite_token: string): Promise<AcceptInviteResponse> =>
  apiClient
    .post<AcceptInviteResponse>(`/api/v1/workspaces/invites/accept/${invite_token}`)
    .then((res) => res.data);

export const rejectInvite = (invite_token: string): Promise<{ message: string }> =>
  apiClient
    .delete<{ message: string }>(`/api/v1/workspaces/invites/${invite_token}`)
    .then((res) => res.data);

export const searchWorkspaceUsers = (
  workspace_id: number,
  query: string,
  limit: number = 10
): Promise<UserSearchResult[]> =>
  apiClient
    .get<UserSearchResult[]>(`/api/v1/workspaces/${workspace_id}/invite/users`, {
      params: { query, limit },
    })
    .then((res) => res.data);
