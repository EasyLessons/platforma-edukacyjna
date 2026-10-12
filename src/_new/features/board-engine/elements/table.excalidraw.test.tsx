/**
 * Tabela na prawdziwym Excalidraw: wstawienie (grupa komórek), zmiana struktury z zachowaniem
 * tekstów i szerokości kolumn, stare elementy oznaczone jako usunięte.
 */

import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import {
  CaptureUpdateAction,
  Excalidraw,
  convertToExcalidrawElements,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { CELL_WIDTH, editTable, insertTable, readTable, tableCellData } from './table';

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

const cells = (api: ExcalidrawImperativeAPI) =>
  api.getSceneElements().filter((el) => tableCellData(el) !== null);

/** Wpisuje tekst do komórki tak, jak robi to edycja Excalidraw: etykieta związana z komórką. */
function typeIntoCell(api: ExcalidrawImperativeAPI, row: number, col: number, text: string) {
  const cell = cells(api).find((el) => {
    const d = tableCellData(el)!;
    return d.row === row && d.col === col;
  })!;
  const [label] = convertToExcalidrawElements([
    { type: 'text', x: cell.x, y: cell.y, text, containerId: cell.id } as never,
  ]);
  api.updateScene({
    elements: [
      ...api
        .getSceneElementsIncludingDeleted()
        .map((el): ExcalidrawElement =>
          el.id === cell.id ? { ...el, boundElements: [{ id: label.id, type: 'text' }] } : el
        ),
      { ...label, groupIds: cell.groupIds } as ExcalidrawElement,
    ],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}

describe('tabela', () => {
  it('wstawia 3x3 komórki w jednej grupie, zaznaczone', async () => {
    const api = await mountExcalidraw();
    const tableId = await insertTable(api);

    expect(cells(api)).toHaveLength(9);
    expect(cells(api).every((el) => el.groupIds[0] === tableId)).toBe(true);
    await waitFor(() => expect(api.getAppState().selectedGroupIds[tableId]).toBe(true));
    const layout = readTable(api.getSceneElements(), tableId)!;
    expect(layout.matrix).toEqual([
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]);
    expect(layout.colWidths).toEqual([CELL_WIDTH, CELL_WIDTH, CELL_WIDTH]);
  });

  it('dodanie kolumny przy komórce zachowuje teksty; stare elementy usunięte', async () => {
    const api = await mountExcalidraw();
    const tableId = await insertTable(api, 2, 2);
    typeIntoCell(api, 0, 0, 'A');
    typeIntoCell(api, 1, 1, 'D');
    const oldIds = new Set(api.getSceneElements().map((el) => el.id));

    await editTable(api, tableId, 'add-col', { row: 0, col: 0 });

    const layout = readTable(api.getSceneElements(), tableId)!;
    expect(layout.matrix).toEqual([
      ['A', '', ''],
      ['', '', 'D'],
    ]);
    expect(cells(api)).toHaveLength(6);
    expect(api.getSceneElements().some((el) => oldIds.has(el.id))).toBe(false);
    expect(
      api
        .getSceneElementsIncludingDeleted()
        .filter((el) => oldIds.has(el.id))
        .every((el) => el.isDeleted)
    ).toBe(true);
  });

  it('usunięcie wiersza na końcu; jedynego wiersza nie usuwa', async () => {
    const api = await mountExcalidraw();
    const tableId = await insertTable(api, 2, 1);
    await editTable(api, tableId, 'remove-row', null);
    expect(cells(api)).toHaveLength(1);
    await editTable(api, tableId, 'remove-row', null);
    expect(cells(api)).toHaveLength(1);
  });
});
