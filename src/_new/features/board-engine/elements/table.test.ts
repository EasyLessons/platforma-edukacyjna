import { describe, expect, it } from 'vitest';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  MAX_TABLE_SIZE,
  addCol,
  addRow,
  applyEdit,
  emptyMatrix,
  removeCol,
  removeRow,
  selectedTable,
  type TableLayout,
} from './table';

const m = [
  ['a', 'b'],
  ['c', 'd'],
];

describe('operacje na macierzy', () => {
  it('dodaje wiersz / kolumnę za wskazanym albo na końcu', () => {
    expect(addRow(m)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['', ''],
    ]);
    expect(addRow(m, 0)).toEqual([
      ['a', 'b'],
      ['', ''],
      ['c', 'd'],
    ]);
    expect(addCol(m)).toEqual([
      ['a', 'b', ''],
      ['c', 'd', ''],
    ]);
    expect(addCol(m, 0)).toEqual([
      ['a', '', 'b'],
      ['c', '', 'd'],
    ]);
  });

  it('usuwa wskazany albo ostatni; jedynego wiersza / kolumny nie usuwa', () => {
    expect(removeRow(m)).toEqual([['a', 'b']]);
    expect(removeRow(m, 0)).toEqual([['c', 'd']]);
    expect(removeCol(m, 0)).toEqual([['b'], ['d']]);
    const one = [['x']];
    expect(removeRow(one)).toBe(one);
    expect(removeCol(one)).toBe(one);
  });

  it('nie rośnie ponad limit', () => {
    const big = emptyMatrix(MAX_TABLE_SIZE, MAX_TABLE_SIZE);
    expect(addRow(big)).toBe(big);
    expect(addCol(big)).toBe(big);
  });
});

describe('applyEdit', () => {
  const layout: TableLayout = {
    matrix: m,
    origin: { x: 0, y: 0 },
    colWidths: [100, 200],
    rowHeights: [44, 60],
  };

  it('szerokości kolumn i wysokości wierszy idą za strukturą', () => {
    expect(applyEdit(layout, 'add-col', { row: 0, col: 0 }).colWidths).toEqual([
      100,
      CELL_WIDTH,
      200,
    ]);
    expect(applyEdit(layout, 'remove-col', { row: 0, col: 0 }).colWidths).toEqual([200]);
    expect(applyEdit(layout, 'add-row', null).rowHeights).toEqual([44, 60, CELL_HEIGHT]);
    expect(applyEdit(layout, 'remove-row', { row: 1, col: 1 }).rowHeights).toEqual([44]);
  });

  it('bez zmiany = ten sam obiekt (nic do zapisania)', () => {
    const single: TableLayout = { ...layout, matrix: [['x']], colWidths: [100], rowHeights: [44] };
    expect(applyEdit(single, 'remove-row', null)).toBe(single);
  });
});

describe('selectedTable', () => {
  const cell = (id: string, row: number, col: number, tableId = 't1') =>
    ({
      id,
      type: 'rectangle',
      isDeleted: false,
      customData: { kind: 'table-cell', tableId, row, col },
    }) as unknown as ExcalidrawElement;
  const label = (id: string, containerId: string) =>
    ({ id, type: 'text', isDeleted: false, containerId }) as unknown as ExcalidrawElement;
  const els = [cell('c00', 0, 0), cell('c01', 0, 1), label('t01', 'c01'), cell('x', 0, 0, 't2')];

  it('cała grupa = tabela bez komórki; jedna komórka (albo jej etykieta) = komórka', () => {
    expect(selectedTable(els, { selectedElementIds: { c00: true, c01: true } })).toEqual({
      tableId: 't1',
      cell: null,
    });
    expect(selectedTable(els, { selectedElementIds: { t01: true } })).toEqual({
      tableId: 't1',
      cell: { row: 0, col: 1 },
    });
  });

  it('nic z tabeli albo dwie tabele naraz = null', () => {
    expect(selectedTable(els, { selectedElementIds: {} })).toBeNull();
    expect(selectedTable(els, { selectedElementIds: { c00: true, x: true } })).toBeNull();
  });
});
