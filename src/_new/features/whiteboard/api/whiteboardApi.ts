/**
 * WHITEBOARD API
 *
 * Komunikacja z backendem — sesja tablicy (online, elements).
 * Używa apiClient — zero fetch, zero getToken, zero handleResponse.
 *
 * Board CRUD → board-api.ts
 */
import { apiClient } from '@/_new/lib/api';

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

export interface BoardSettings {
  ai_enabled: boolean;
  grid_visible: boolean;
  smartsearch_visible: boolean;
  toolbar_visible: boolean;
}

export const markOpened = (id: number): Promise<void> =>
  apiClient.post<void>(`/api/v1/whiteboard/${id}/opened`).then(() => undefined);

export const saveBoardElementsBatch = (
  id: number,
  elements: BoardElement[]
): Promise<SaveElementsResponse> =>
  apiClient
    .post<SaveElementsResponse>(`/api/v1/whiteboard/${id}/elements/batch`, elements)
    .then((res) => res.data);

export const loadBoardElements = (id: number): Promise<BoardElementWithAuthor[]> =>
  apiClient
    .get<BoardElementWithAuthor[]>(`/api/v1/whiteboard/${id}/elements`)
    .then((res) => res.data);

export const deleteBoardElement = (
  id: number,
  element_id: string
): Promise<{ success: boolean; message: string }> =>
  apiClient
    .delete<{
      success: boolean;
      message: string;
    }>(`/api/v1/whiteboard/${id}/elements/${element_id}`)
    .then((res) => res.data);

export const uploadBoardImage = (
  id: number,
  blob: Blob,
  filename: string
): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append('file', blob, filename);
  return apiClient
    .post<{
      url: string;
    }>(`/api/v1/whiteboard/${id}/upload-image`, formData, {
      headers: { 'Content-Type': undefined },
    })
    .then((res) => res.data);
};

export const fetchBoardSettings = (id: number): Promise<BoardSettings> =>
  apiClient.get<BoardSettings>(`/api/v1/whiteboard/${id}/settings`).then((res) => res.data);

export const updateBoardSettings = (
  id: number,
  patch: Partial<BoardSettings>
): Promise<BoardSettings> =>
  apiClient.put<BoardSettings>(`/api/v1/whiteboard/${id}/settings`, patch).then((res) => res.data);
