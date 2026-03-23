/**
 * invite-api.ts
 *
 * Funkcje do komunikacji z backend/dashboard/workspaces/invite_routes.py
 *
 * Endpointy:
 *   POST   /api/workspaces/{workspace_id}/invite         — wyślij zaproszenie
 *   POST   /api/workspaces/invites/accept/{token}        — akceptuj
 *   DELETE /api/workspaces/invites/{token}               — odrzuć
 *   GET    /api/workspaces/{workspace_id}/members/check/{user_id} — sprawdź status
 */

import { apiClient } from '@/_new/lib/api';
import {
  InviteResponse,
  InviteStatusResponse,
  AcceptInviteResponse,
  PendingInviteResponse,
} from '../types';

export const createInvite = (
  workspace_id: number,
  invited_user_id: number
): Promise<InviteResponse> =>
  apiClient
    .post<InviteResponse>(`/api/v1/workspaces/${workspace_id}/invite`, { invited_user_id })
    .then((res) => res.data);

export const getPendingInvites = (): Promise<PendingInviteResponse[]> =>
  apiClient
    .get<PendingInviteResponse[]>('/api/v1/workspaces/invites/pending')
    .then((res) => res.data);

export const acceptInvite = (invite_token: string): Promise<AcceptInviteResponse> =>
  apiClient
    .post<AcceptInviteResponse>(`/api/v1/workspaces/invites/accept/${invite_token}`)
    .then((res) => res.data);

export const rejectInvite = (invite_token: string): Promise<{ message: string }> =>
  apiClient
    .delete<{ message: string }>(`/api/v1/workspaces/invites/${invite_token}`)
    .then((res) => res.data);

export const checkUserInviteStatus = (
  workspace_id: number,
  user_id: number
): Promise<InviteStatusResponse> =>
  apiClient
    .get<InviteStatusResponse>(`/api/v1/workspaces/${workspace_id}/members/check/${user_id}`)
    .then((res) => res.data);

export const checkUsersInviteStatusBatch = (
  workspace_id: number,
  user_ids: number[]
): Promise<Record<number, InviteStatusResponse>> =>
  apiClient
    .post<{ statuses: Record<number, InviteStatusResponse> }>(
      `/api/v1/workspaces/${workspace_id}/members/check-batch`,
      { user_ids }
    )
    .then((res) => res.data.statuses);
