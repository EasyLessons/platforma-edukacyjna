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

/**
 * Upload obrazu (po kompresji, patrz elements/image-compress.ts) do Supabase
 * Storage przez backend — patrz docs/known-issues.md #2.
 *
 * NIE wysyłamy już base64 obrazka przez Realtime Broadcast (plan Free ma
 * twardy limit 256 KB na wiadomość, prawdziwe zdjęcia/PDF-y regularnie go
 * przekraczały). Zamiast tego: upload zwykłym HTTP POST tutaj, backend
 * zapisuje w Storage i zwraca publiczny URL — TEN URL (kilkadziesiąt bajtów)
 * jedzie potem przez broadcast jako element.src.
 *
 * `Content-Type: undefined` w headers jest celowe: axios domyślnie ustawia
 * 'application/json' (patrz client.ts), ale FormData z plikiem potrzebuje
 * 'multipart/form-data; boundary=...' — boundary umie dograć tylko
 * przeglądarka, więc usuwamy nasz nagłówek i pozwalamy jej to zrobić.
 */
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
