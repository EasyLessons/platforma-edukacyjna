/**
 * Wstawianie z paneli na prawdziwym Excalidraw: wzór (obraz + plik) i odpowiedź Tutora AI
 * (notatka z zawiniętym tekstem).
 */

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { insertResources, resourceFileId } from './insert-resources';
import { NOTE_WIDTH, insertTextNote } from './insert-note';

// 1x1 PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

beforeAll(() => {
  // src/test/setup.ts podmienia window.location bez `search`/`hash`, a Excalidraw ich używa.
  Object.assign(window.location, { search: '', hash: '' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

/** Odpowiedź fetch z Blobem jsdom (Response z Node daje Blob, którego nie czyta FileReader jsdom). */
function pngResponse() {
  const bytes = Uint8Array.from(atob(PNG_BASE64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'image/png' });
  return { ok: true, status: 200, blob: async () => blob };
}

const failedResponse = (status: number) => ({ ok: false, status, blob: async () => new Blob() });

describe('insertResources', () => {
  it('wstawia obraz z plikiem i zaznacza go; nieudane pobranie pomija wzór', async () => {
    const api = await mountExcalidraw();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => (path.includes('brak') ? failedResponse(404) : pngResponse()))
    );

    const added = await insertResources(api, [
      { path: '/resources/a.png', title: 'A', dimensions: { width: 200, height: 100 } },
      { path: '/resources/brak.png', title: 'B', dimensions: { width: 100, height: 100 } },
    ]);

    expect(added).toBe(1);
    const elements = api.getSceneElements();
    expect(elements).toHaveLength(1);
    const [image] = elements;
    expect(image.type).toBe('image');
    expect(image.type === 'image' && image.fileId).toBe(resourceFileId('/resources/a.png'));
    expect(image.customData).toEqual({ kind: 'resource', title: 'A' });
    expect(image.width / image.height).toBeCloseTo(2);
    expect(api.getFiles()[resourceFileId('/resources/a.png')]?.dataURL).toMatch(
      /^data:image\/png;base64,/
    );
    await waitFor(() => expect(api.getAppState().selectedElementIds).toEqual({ [image.id]: true }));
  });

  it('żaden wzór się nie pobrał - nic nie trafia na tablicę', async () => {
    const api = await mountExcalidraw();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failedResponse(500))
    );
    expect(
      await insertResources(api, [
        { path: '/x.png', title: 'X', dimensions: { width: 1, height: 1 } },
      ])
    ).toBe(0);
    expect(api.getSceneElements()).toHaveLength(0);
  });
});

describe('insertTextNote', () => {
  it('notatka = prostokąt o stałej szerokości z tekstem jako etykietą', async () => {
    const api = await mountExcalidraw();
    await insertTextNote(api, '  Pole koła: P = πr²\nObwód: 2πr  ');

    const elements = api.getSceneElements();
    const rect = elements.find((e) => e.type === 'rectangle')!;
    const text = elements.find((e) => e.type === 'text')!;
    expect(rect.width).toBe(NOTE_WIDTH);
    expect(rect.customData).toEqual({ kind: 'ai-note' });
    expect(text.type === 'text' && text.containerId).toBe(rect.id);
    expect(text.type === 'text' && text.originalText).toBe('Pole koła: P = πr²\nObwód: 2πr');
    await waitFor(() => expect(api.getAppState().selectedElementIds).toEqual({ [rect.id]: true }));
  });

  it('pusta odpowiedź nic nie wstawia', async () => {
    const api = await mountExcalidraw();
    await insertTextNote(api, '   ');
    expect(api.getSceneElements()).toHaveLength(0);
  });
});
