/**
 * WHITEBOARD API
 *
 * Komunikacja z backendem — sesja tablicy (online, elements).
 * Używa apiClient — zero fetch, zero getToken, zero handleResponse.
 *
 * Board CRUD → board-api.ts
 */
import { apiClient } from "@/_new/lib/api";

export interface OnlineUser {
  user_id: number;
  username: string;
}

export interface BoardElement {
  element_id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface BoardElementWithAuthor extends BoardElement {
  created_by_id: number | null;
  created_by_username: string | null;
  created_at: string | null;
}

export interface SaveElementsResponse {
  success: boolean;
  saved: number;
}

export const markUserOnline = (id: number): Promise<void> =>
  apiClient.post(`/api/v1/whiteboard/${id}/online`).then(() => undefined);

export const fetchOnlineUsers = (
  id: number,
  limit = 50,
  offset = 0,
): Promise<OnlineUser[]> =>
  apiClient.get<OnlineUser[]>(`/api/v1/whiteboard/${id}/online-users`, {
    params: { limit, offset },
  }).then(res => res.data);

export const saveBoardElementsBatch = (
  id: number,
  elements: BoardElement[],
): Promise<SaveElementsResponse> =>
  apiClient.post<SaveElementsResponse>(
    `/api/v1/whiteboard/${id}/elements/batch`,
    elements,
  ).then(res => res.data);

export const loadBoardElements = (id: number): Promise<BoardElementWithAuthor[]> =>
  apiClient.get<BoardElementWithAuthor[]>(`/api/v1/whiteboard/${id}/elements`)
    .then(res => res.data);

export const deleteBoardElement = (
  id: number,
  element_id: string,
): Promise<{ success: boolean; message: string }> =>
  apiClient.delete<{ success: boolean; message: string }>(
    `/api/v1/whiteboard/${id}/elements/${element_id}`,
  ).then(res => res.data);
