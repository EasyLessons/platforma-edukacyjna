/**
 * Wstawianie stron PDF na prawdziwym Excalidraw (render pdfjs sprawdza e2e w przeglądarce).
 */

import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { PAGE_SCENE_WIDTH, PDF_PAGE_KIND, insertPdfPages } from './pdf';

// Montowanie Excalidraw w jsdom trwa kilka sekund pod obciążeniem (pełny przebieg) - 5 s to za mało.
vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  // src/test/setup.ts podmienia window.location bez `search`/`hash`, a Excalidraw ich używa.
  Object.assign(window.location, { search: '', hash: '' });
});

afterEach(() => cleanup());

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

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

describe('insertPdfPages', () => {
  it('strony jako obrazy w jednej grupie, pliki JPEG, zaznaczone', async () => {
    const api = await mountExcalidraw();
    const ids = await insertPdfPages(
      api,
      [
        { blob: jpeg(), width: 1018, height: 1440 },
        { blob: jpeg(), width: 1018, height: 1440 },
      ],
      'zadania.pdf'
    );

    const pages = api.getSceneElements().filter((el) => ids.includes(el.id));
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.type)).toEqual(['image', 'image']);
    expect(pages.map((p) => p.customData)).toEqual([
      { kind: PDF_PAGE_KIND, name: 'zadania.pdf', page: 1, pages: 2 },
      { kind: PDF_PAGE_KIND, name: 'zadania.pdf', page: 2, pages: 2 },
    ]);
    expect(new Set(pages.map((p) => p.groupIds[0])).size).toBe(1);
    expect(pages.every((p) => p.width === PAGE_SCENE_WIDTH)).toBe(true);
    expect(pages[1].y).toBeGreaterThan(pages[0].y + pages[0].height);
    const files = api.getFiles();
    expect(
      pages.every((p) => p.type === 'image' && files[p.fileId!]?.mimeType === 'image/jpeg')
    ).toBe(true);
  });

  it('pusta lista stron - nic nie wstawia', async () => {
    const api = await mountExcalidraw();
    expect(await insertPdfPages(api, [], 'x.pdf')).toEqual([]);
    expect(api.getSceneElements()).toHaveLength(0);
  });
});
