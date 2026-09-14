import { apiClient } from '@/_new/lib/api';
import type { ShareLinkResponse, ShareLinkPreview, JoinShareLinkResponse } from '../types';

export const createShareLink = (
  workspace_id: number,
  board_id?: number
): Promise<ShareLinkResponse> =>
  apiClient
    .post<ShareLinkResponse>(`/api/v1/workspaces/${workspace_id}/share-link`, null, {
      params: board_id ? { board_id } : undefined,
    })
    .then((res) => res.data);

export const refreshShareLink = (
  workspace_id: number,
  board_id?: number
): Promise<ShareLinkResponse> =>
  apiClient
    .post<ShareLinkResponse>(`/api/v1/workspaces/${workspace_id}/share-link/refresh`, null, {
      params: board_id ? { board_id } : undefined,
    })
    .then((res) => res.data);

export const revokeShareLink = (
  workspace_id: number,
  token: string
): Promise<{ message: string }> =>
  apiClient
    .delete<{ message: string }>(`/api/v1/workspaces/${workspace_id}/share-link/${token}`)
    .then((res) => res.data);

export const previewShareLink = (token: string): Promise<ShareLinkPreview> =>
  apiClient.get<ShareLinkPreview>(`/api/v1/workspaces/share-link/${token}`).then((res) => res.data);

export const joinShareLink = (token: string): Promise<JoinShareLinkResponse> =>
  apiClient
    .post<JoinShareLinkResponse>(`/api/v1/workspaces/share-link/${token}/join`)
    .then((res) => res.data);
