/**
 * Spięcie `BoardFileSync` z API Excalidraw - żeby `excalidraw-board.tsx` miał tylko
 * krótkie wpięcia (plik jest blisko progu 400 linii).
 *
 * Importuje `@excalidraw/excalidraw` statycznie: ładować tylko z modułów, które same są
 * ładowane przez `next/dynamic` z `ssr: false` (jak `excalidraw-board.tsx`).
 */

import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw';
import type { BinaryFileData, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

import type { ExcalidrawYjsBinding, StoredElement } from '../yjs/excalidraw-binding';
import { BoardFileSync, type BoardFileSyncOptions, type UploadFailure } from './board-file-sync';

export const UPLOAD_FAILURE_MESSAGES: Record<UploadFailure, string> = {
  'too-large': 'Obraz jest za duży (maksymalnie 5 MB) - nie został dodany.',
  dimensions: 'Obraz ma zbyt duże wymiary - zmniejsz go i dodaj ponownie.',
  unsupported: 'Ten format obrazu nie jest obsługiwany (PNG, JPG, WEBP, GIF) - nie został dodany.',
  svg: 'Pliki SVG nie są obsługiwane na tablicy - dodaj obraz jako PNG lub JPG.',
  quota: 'Ta tablica osiągnęła limit obrazów - obraz nie został dodany.',
  forbidden: 'Nie masz uprawnień do dodawania obrazów na tej tablicy.',
  failed: 'Nie udało się wgrać obrazu - spróbuj ponownie.',
};

/** Usuwa lokalnie (bez wpisu w historii cofania) elementy-obrazy korzystające z pliku. */
export function removeImageElements(api: ExcalidrawImperativeAPI, fileId: string): void {
  const isOrphan = (el: ExcalidrawElement) =>
    el.type === 'image' && !el.isDeleted && el.fileId === fileId;
  const elements = api.getSceneElementsIncludingDeleted();
  if (!elements.some(isOrphan)) return;
  api.updateScene({
    elements: elements.map((el) => (isOrphan(el) ? newElementWith(el, { isDeleted: true }) : el)),
    captureUpdate: CaptureUpdateAction.NEVER,
  });
}

export interface ExcalidrawFileSyncOptions {
  api: ExcalidrawImperativeAPI;
  binding: ExcalidrawYjsBinding;
  /** Id tablicy na serwerze; null = tablica lokalna (demo, gość). */
  boardId: string | null;
  transport?: BoardFileSyncOptions['transport'];
  retryDelaysMs?: BoardFileSyncOptions['retryDelaysMs'];
}

export function createExcalidrawFileSync({
  api,
  binding,
  boardId,
  transport,
  retryDelaysMs,
}: ExcalidrawFileSyncOptions): BoardFileSync {
  const sync: BoardFileSync = new BoardFileSync({
    binding,
    boardId,
    transport,
    retryDelaysMs,
    addFiles: (files) => api.addFiles(files as unknown as BinaryFileData[]),
    // Plik ma już wpis w Y.Doc - wstrzymany element-obraz może trafić do dokumentu.
    onStored: () =>
      binding.pushLocal(
        sync.shareable(api.getSceneElementsIncludingDeleted() as unknown as StoredElement[])
      ),
    onUploadFailed: (fileId, reason) => {
      removeImageElements(api, fileId);
      api.setToast({ message: UPLOAD_FAILURE_MESSAGES[reason], closable: true, duration: 8000 });
    },
  });
  return sync;
}
