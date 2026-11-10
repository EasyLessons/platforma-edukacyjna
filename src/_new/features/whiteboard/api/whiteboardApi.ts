/**
 * WHITEBOARD API
 *
 * Komunikacja z backendem - ustawienia tablicy (`/api/v1/whiteboard/{id}/settings`).
 * Elementy, obrazy i `opened` starego silnika zniknęły w etapie F; treść tablicy idzie
 * przez Yjs/whiteboard-sync (board-engine/yjs), pliki przez board-engine/files.
 * Używa apiClient - zero fetch, zero getToken, zero handleResponse.
 *
 * Board CRUD -> features/board/api/boardApi.ts
 */
import { apiClient } from '@/_new/lib/api';

export interface BoardSettings {
  ai_enabled: boolean;
  grid_visible: boolean;
  smartsearch_visible: boolean;
  toolbar_visible: boolean;
}

export const fetchBoardSettings = (id: number): Promise<BoardSettings> =>
  apiClient.get<BoardSettings>(`/api/v1/whiteboard/${id}/settings`).then((res) => res.data);

export const updateBoardSettings = (
  id: number,
  patch: Partial<BoardSettings>
): Promise<BoardSettings> =>
  apiClient.put<BoardSettings>(`/api/v1/whiteboard/${id}/settings`, patch).then((res) => res.data);
