/**
 * Arkusz na prawdziwym Excalidraw: wszystkie strony jako obrazy ze wspólnymi plikami (`tpl:`), w jednej
 * grupie, jedna pod drugą; `hasSheet` rozpoznaje wstawiony arkusz (jednorazowe wstawienie z `?arkusz=`).
 */

import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { sheetById } from './catalog';
import { TEMPLATE_PAGE_KIND, hasSheet, insertSheet } from './insert-sheet';

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

describe('insertSheet', () => {
  it('strony arkusza jako obrazy ze wspólnymi plikami, w grupie, jedna pod drugą', async () => {
    const api = await mountExcalidraw();
    const template = sheetById('egzamin-8-2023')!;
    const fetchPage = vi.fn(async () => new Blob(['webp'], { type: 'image/webp' }));

    expect(hasSheet(api.getSceneElements(), template.id)).toBe(false);
    await insertSheet(api, template, fetchPage);

    const pages = api
      .getSceneElements()
      .filter((el) => (el.customData as { kind?: string })?.kind === TEMPLATE_PAGE_KIND);
    expect(pages).toHaveLength(template.pages);
    expect(fetchPage).toHaveBeenCalledWith('/templates/arkusze/egzamin-8-2023/p01.webp');
    expect(pages[0].type === 'image' && pages[0].fileId).toBe(
      'tpl:templates/arkusze/egzamin-8-2023/p01.webp'
    );
    expect(new Set(pages.map((p) => p.groupIds[0])).size).toBe(1);
    for (let i = 1; i < pages.length; i++) expect(pages[i].y).toBeGreaterThan(pages[i - 1].y);
    expect(api.getFiles()['tpl:templates/arkusze/egzamin-8-2023/p24.webp']).toBeTruthy();
    expect(hasSheet(api.getSceneElements(), template.id)).toBe(true);
  });
});
