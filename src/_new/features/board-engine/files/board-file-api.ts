/**
 * Pliki tablicy w Storage - wywołania backendu (backend/api/v1/whiteboard/files.py).
 *
 * Bucket jest prywatny: plik da się pobrać tylko przez backend, z tokenem członka tablicy.
 * Dlatego pobieranie idzie przez `apiClient` (nagłówek Authorization, odświeżanie sesji),
 * a nie przez `<img src>`.
 */

import { apiClient } from '@/_new/lib/api';

/** Nazwa pliku nadawana przez backend. Jedyny kształt, jaki wolno wstawić do adresu. */
export const BOARD_FILE_NAME_PATTERN = /^[0-9a-f]{32}\.webp$/;

export interface UploadedBoardFile {
  file_name: string;
  mime_type: string;
  size: number;
  width: number;
  height: number;
}

export interface BoardFileTransport {
  upload(boardId: string, blob: Blob): Promise<UploadedBoardFile>;
  download(boardId: string, fileName: string): Promise<Blob>;
}

export const boardFileApi: BoardFileTransport = {
  upload(boardId, blob) {
    const formData = new FormData();
    formData.append('file', blob, 'image');
    return apiClient
      .post<UploadedBoardFile>(
        `/api/v1/whiteboard/${encodeURIComponent(boardId)}/files`,
        formData,
        {
          // Bez domyślnego application/json: przeglądarka sama ustawi multipart z boundary.
          headers: { 'Content-Type': undefined },
        }
      )
      .then((res) => res.data);
  },

  download(boardId, fileName) {
    return apiClient
      .get<Blob>(
        `/api/v1/whiteboard/${encodeURIComponent(boardId)}/files/${encodeURIComponent(fileName)}`,
        { responseType: 'blob' }
      )
      .then((res) => res.data);
  },
};
