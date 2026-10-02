/**
 * `createExcalidrawFileSync` z prawdziwym Excalidraw: po nieudanej wysyłce element-obraz
 * znika lokalnie i pojawia się komunikat; po udanej element trafia do Y.Doc razem
 * z odwołaniem do pliku (bez dataURL).
 */

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { act, render, waitFor, cleanup } from '@testing-library/react';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type {
  BinaryFileData,
  DataURL,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { FileId } from '@excalidraw/excalidraw/element/types';
import * as Y from 'yjs';

import {
  ExcalidrawYjsBinding,
  isFileRef,
  type StoredElement,
  type StoredFile,
} from '../yjs/excalidraw-binding';
import type { BoardFileTransport } from './board-file-api';
import { createExcalidrawFileSync, UPLOAD_FAILURE_MESSAGES } from './excalidraw-file-sync';

// Treść nie musi być prawdziwym PNG: jsdom nie dekoduje obrazów, a backend jest atrapą.
const PNG_1X1 = `data:image/png;base64,${btoa('obraz-testowy-nie-png')}`;
const FILE_ID = 'img-test-1' as FileId;
const FILE_NAME = `${'0f'.repeat(16)}.webp`;

beforeAll(() => {
  // src/test/setup.ts podmienia window.location bez `search`/`hash`, a Excalidraw
  // przy montowaniu czyta `location.search.slice(1)`.
  Object.assign(window.location, { search: '', hash: '' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function mountExcalidraw(): Promise<ExcalidrawImperativeAPI> {
  let api: ExcalidrawImperativeAPI | null = null;
  render(
    <div style={{ width: 800, height: 600 }}>
      <Excalidraw excalidrawAPI={(a) => (api = a)} />
    </div>
  );
  await waitFor(() => expect(api).not.toBeNull());
  return api as unknown as ExcalidrawImperativeAPI;
}

/** Wstawia obraz tak, jak robi to Excalidraw po wklejeniu: plik + element z `fileId`. */
function insertImage(api: ExcalidrawImperativeAPI) {
  const file: BinaryFileData = {
    id: FILE_ID,
    mimeType: 'image/png',
    dataURL: PNG_1X1 as DataURL,
    created: 1,
  };
  const [image] = convertToExcalidrawElements([
    { type: 'image', x: 10, y: 10, width: 50, height: 50, fileId: FILE_ID },
  ]);
  act(() => {
    api.addFiles([file]);
    api.updateScene({ elements: [...api.getSceneElementsIncludingDeleted(), image] });
  });
  return image;
}

function flush(
  api: ExcalidrawImperativeAPI,
  binding: ExcalidrawYjsBinding,
  sync: ReturnType<typeof createExcalidrawFileSync>
) {
  const elements = api.getSceneElementsIncludingDeleted() as unknown as StoredElement[];
  sync.syncLocal(api.getFiles() as unknown as Record<string, StoredFile>, elements);
  binding.pushLocal(sync.shareable(elements));
}

describe('createExcalidrawFileSync', () => {
  it('nieudana wysyłka: element usunięty lokalnie, komunikat, nic w Y.Doc', async () => {
    const api = await mountExcalidraw();
    const setToast = vi.spyOn(api, 'setToast');
    const binding = new ExcalidrawYjsBinding(new Y.Doc(), 'A');
    const transport: BoardFileTransport = {
      upload: vi.fn().mockRejectedValue(Object.assign(new Error('413'), { status: 413 })),
      download: vi.fn(),
    };
    const sync = createExcalidrawFileSync({ api, binding, boardId: '5', transport });
    const image = insertImage(api);
    expect(api.getSceneElements().map((e) => e.id)).toContain(image.id);

    await act(async () => {
      flush(api, binding, sync);
      await Promise.resolve();
    });

    await waitFor(() => expect(api.getSceneElements().map((e) => e.id)).not.toContain(image.id));
    expect(setToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: UPLOAD_FAILURE_MESSAGES['too-large'] })
    );

    // Kolejny flush (onChange po usunięciu) nie wypycha skasowanego obrazu ani pliku.
    flush(api, binding, sync);
    expect(binding.getElements()).toEqual([]);
    expect(binding.getFiles()).toEqual([]);
    expect(transport.upload).toHaveBeenCalledTimes(1);
    sync.dispose();
  });

  it('udana wysyłka: element i odwołanie w Y.Doc, dataURL zostaje tylko w Excalidraw', async () => {
    const api = await mountExcalidraw();
    const binding = new ExcalidrawYjsBinding(new Y.Doc(), 'A');
    const transport: BoardFileTransport = {
      upload: vi.fn().mockResolvedValue({
        file_name: FILE_NAME,
        mime_type: 'image/webp',
        size: 1,
        width: 1,
        height: 1,
      }),
      download: vi.fn(),
    };
    const sync = createExcalidrawFileSync({ api, binding, boardId: '5', transport });
    const image = insertImage(api);

    flush(api, binding, sync);
    expect(binding.getElements()).toEqual([]);

    await waitFor(() => expect(binding.hasFile(FILE_ID)).toBe(true));
    const stored = binding.getFile(FILE_ID) as StoredFile;
    expect(isFileRef(stored)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain('data:');
    expect(binding.getElements().map((e) => e.id)).toEqual([image.id]);
    expect(api.getFiles()[FILE_ID].dataURL).toBe(PNG_1X1);
    sync.dispose();
  });
});
