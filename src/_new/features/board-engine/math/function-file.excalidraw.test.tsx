/**
 * Plik SVG wykresu przechodzi przez prawdziwe `excalidrawAPI.addFiles` bez błędu.
 *
 * Regresja z prototypu: dataURL `;charset=utf-8,<encodeURIComponent>` kończył się
 * w `addFiles` -> `dataURLToString` -> `atob` wyjątkiem `InvalidCharacterError`
 * (łapanym przez Excalidraw i logowanym przez console.error).
 */

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { act, render, waitFor, cleanup } from '@testing-library/react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { buildFunctionFile } from './function-element';
import { DEFAULT_FUNCTION_SPEC } from './function-plot';

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

/** Wywołania console.error z wyjątkiem `InvalidCharacterError` (atob na nie-base64). */
function invalidCharacterErrors(calls: unknown[][]): unknown[][] {
  return calls.filter((args) =>
    args.some((a) => (a as { name?: unknown } | null)?.name === 'InvalidCharacterError')
  );
}

describe('plik wykresu w Excalidraw', () => {
  it('addFiles przyjmuje SVG wykresu (z polskimi znakami) bez console.error', async () => {
    const api = await mountExcalidraw();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const file = buildFunctionFile({ ...DEFAULT_FUNCTION_SPEC, expression: 'x^2 - 3' });
    act(() => api.addFiles([file]));

    expect(errors).not.toHaveBeenCalled();
    const stored = api.getFiles()[file.id];
    expect(stored?.mimeType).toBe('image/svg+xml');
    expect(stored?.dataURL.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('stary format dataURL (charset=utf-8 + encodeURIComponent) logował błąd - kontrola testu', async () => {
    const api = await mountExcalidraw();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const file = buildFunctionFile(DEFAULT_FUNCTION_SPEC);
    const legacy = {
      ...file,
      id: `${file.id}-legacy` as typeof file.id,
      dataURL:
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><text>ż</text></svg>')}` as typeof file.dataURL,
    };
    act(() => api.addFiles([legacy]));

    expect(invalidCharacterErrors(errors.mock.calls)).toHaveLength(1);
  });
});
