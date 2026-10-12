/**
 * Tabela na tablicy Excalidraw (etap B2, ADR silnika tablicy - "Decyzja 01.10.2026" pkt 2, opcja A).
 *
 * Tabela = grupa prostokątów-komórek z etykietą (natywny tekst w kontenerze Excalidraw). Każda komórka ma
 * `customData: { kind: 'table-cell', tableId, row, col }`, a cała tabela wspólne `groupIds: [tableId]`:
 *   - przesuwanie całości = przesuwanie grupy (Excalidraw),
 *   - edycja komórki = natywna edycja etykiety (podwójne kliknięcie w komórkę po wejściu w grupę),
 *   - zmiana struktury (wiersz / kolumna) = przebudowa siatki: teksty i szerokości kolumn zostają,
 *     stare elementy oznaczone jako usunięte (jak każde usunięcie w Excalidraw - sync i cofanie działają).
 * Sync i F5 - zwykłe elementy, przez Y.Doc.
 *
 * Runtime `@excalidraw/excalidraw` tylko przez dynamiczny import - moduł trafia do strony z SSR.
 */

import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { viewportCenter } from '../panels/insert-resources';

export const TABLE_CELL_KIND = 'table-cell' as const;
export const CELL_WIDTH = 140;
export const CELL_HEIGHT = 44;
export const MAX_TABLE_SIZE = 20;
const CELL_FONT_SIZE = 16;

export interface TableCellData {
  kind: typeof TABLE_CELL_KIND;
  tableId: string;
  row: number;
  col: number;
}

export type TableMatrix = string[][];

export interface TableLayout {
  matrix: TableMatrix;
  origin: { x: number; y: number };
  colWidths: number[];
  rowHeights: number[];
}

// --- operacje na macierzy (czyste) -----------------------------------------------

export const emptyMatrix = (rows: number, cols: number): TableMatrix =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

/** Nowy wiersz pod wierszem `after` (domyślnie na końcu). */
export function addRow(matrix: TableMatrix, after = matrix.length - 1): TableMatrix {
  if (matrix.length >= MAX_TABLE_SIZE) return matrix;
  const cols = matrix[0]?.length ?? 1;
  const at = Math.min(Math.max(after + 1, 0), matrix.length);
  return [...matrix.slice(0, at), Array(cols).fill(''), ...matrix.slice(at)];
}

/** Nowa kolumna za kolumną `after` (domyślnie na końcu). */
export function addCol(matrix: TableMatrix, after = (matrix[0]?.length ?? 1) - 1): TableMatrix {
  if ((matrix[0]?.length ?? 0) >= MAX_TABLE_SIZE) return matrix;
  return matrix.map((row) => {
    const at = Math.min(Math.max(after + 1, 0), row.length);
    return [...row.slice(0, at), '', ...row.slice(at)];
  });
}

/** Usuwa wiersz `index` (domyślnie ostatni); ostatniego wiersza tabeli nie usuwa. */
export function removeRow(matrix: TableMatrix, index = matrix.length - 1): TableMatrix {
  if (matrix.length <= 1) return matrix;
  return matrix.filter((_, i) => i !== index);
}

/** Usuwa kolumnę `index` (domyślnie ostatnią); ostatniej kolumny nie usuwa. */
export function removeCol(matrix: TableMatrix, index = (matrix[0]?.length ?? 1) - 1): TableMatrix {
  if ((matrix[0]?.length ?? 0) <= 1) return matrix;
  return matrix.map((row) => row.filter((_, i) => i !== index));
}

// --- elementy <-> układ --------------------------------------------------------------

export function tableCellData(el: ExcalidrawElement | null | undefined): TableCellData | null {
  const data = el?.customData as Partial<TableCellData> | undefined;
  if (!el || el.isDeleted || el.type !== 'rectangle' || data?.kind !== TABLE_CELL_KIND) return null;
  if (
    typeof data.tableId !== 'string' ||
    !Number.isInteger(data.row) ||
    !Number.isInteger(data.col)
  )
    return null;
  return data as TableCellData;
}

/** Odczyt tabeli z elementów sceny (teksty z etykiet, położenie, szerokości kolumn, wysokości wierszy). */
export function readTable(
  elements: readonly ExcalidrawElement[],
  tableId: string
): TableLayout | null {
  const cells = elements
    .map((el) => ({ el, data: tableCellData(el) }))
    .filter(
      (c): c is { el: ExcalidrawElement; data: TableCellData } => c.data?.tableId === tableId
    );
  if (cells.length === 0) return null;
  const rows = Math.max(...cells.map((c) => c.data.row)) + 1;
  const cols = Math.max(...cells.map((c) => c.data.col)) + 1;
  const matrix = emptyMatrix(rows, cols);
  const colWidths = Array<number>(cols).fill(CELL_WIDTH);
  const rowHeights = Array<number>(rows).fill(CELL_HEIGHT);
  // etykieta komórki = element tekstowy z `containerId` komórki
  const labels = new Map<string, string>();
  for (const el of elements) {
    if (el.type === 'text' && !el.isDeleted && el.containerId)
      labels.set(el.containerId, el.originalText);
  }
  for (const { el, data } of cells) {
    matrix[data.row][data.col] = labels.get(el.id) ?? '';
    if (data.row === 0) colWidths[data.col] = el.width;
    rowHeights[data.row] = Math.max(rowHeights[data.row], el.height);
  }
  const origin = {
    x: Math.min(...cells.map((c) => c.el.x)),
    y: Math.min(...cells.map((c) => c.el.y)),
  };
  return { matrix, origin, colWidths, rowHeights };
}

/** Elementy tabeli (komórki + ich etykiety) - do usunięcia przy przebudowie. */
export function tableElementIds(
  elements: readonly ExcalidrawElement[],
  tableId: string
): Set<string> {
  const cellIds = new Set(
    elements.filter((el) => tableCellData(el)?.tableId === tableId).map((el) => el.id)
  );
  const ids = new Set(cellIds);
  for (const el of elements) {
    if (el.type === 'text' && el.containerId && cellIds.has(el.containerId)) ids.add(el.id);
  }
  return ids;
}

/** Elementy Excalidraw dla układu tabeli (komórka = prostokąt z etykietą), jedna grupa `tableId`. */
export async function buildTableElements(
  layout: TableLayout,
  tableId: string
): Promise<ExcalidrawElement[]> {
  const { convertToExcalidrawElements, FONT_FAMILY } = await import('@excalidraw/excalidraw');
  const { matrix, origin } = layout;
  const colWidth = (c: number) => layout.colWidths[c] ?? CELL_WIDTH;
  const rowHeight = (r: number) => layout.rowHeights[r] ?? CELL_HEIGHT;
  const skeletons = matrix.flatMap((row, r) =>
    row.map((text, c) => ({
      type: 'rectangle' as const,
      x: origin.x + Array.from({ length: c }, (_, i) => colWidth(i)).reduce((a, b) => a + b, 0),
      y: origin.y + Array.from({ length: r }, (_, i) => rowHeight(i)).reduce((a, b) => a + b, 0),
      width: colWidth(c),
      height: rowHeight(r),
      strokeColor: '#374151',
      backgroundColor: r === 0 ? '#f3f4f6' : '#ffffff',
      fillStyle: 'solid' as const,
      roughness: 0,
      strokeWidth: 1,
      customData: { kind: TABLE_CELL_KIND, tableId, row: r, col: c } satisfies TableCellData,
      label: { text, fontSize: CELL_FONT_SIZE, fontFamily: FONT_FAMILY.Nunito },
    }))
  );
  return convertToExcalidrawElements(skeletons).map(
    (el) => ({ ...el, groupIds: [tableId] }) as ExcalidrawElement
  );
}

const newTableId = () =>
  `table-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

/** Wstawia pustą tabelę rows x cols na środek widoku i zaznacza ją. Zwraca id tabeli. */
export async function insertTable(
  api: ExcalidrawImperativeAPI,
  rows = 3,
  cols = 3
): Promise<string> {
  const { CaptureUpdateAction } = await import('@excalidraw/excalidraw');
  const tableId = newTableId();
  const center = viewportCenter(api.getAppState());
  const elements = await buildTableElements(
    {
      matrix: emptyMatrix(rows, cols),
      origin: { x: center.x - (cols * CELL_WIDTH) / 2, y: center.y - (rows * CELL_HEIGHT) / 2 },
      colWidths: Array(cols).fill(CELL_WIDTH),
      rowHeights: Array(rows).fill(CELL_HEIGHT),
    },
    tableId
  );
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
    appState: {
      selectedElementIds: Object.fromEntries(elements.map((e) => [e.id, true as const])),
      selectedGroupIds: { [tableId]: true },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return tableId;
}

export type TableEdit = 'add-row' | 'add-col' | 'remove-row' | 'remove-col';

export function applyEdit(
  layout: TableLayout,
  edit: TableEdit,
  at: { row: number; col: number } | null
): TableLayout {
  const { matrix } = layout;
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  switch (edit) {
    case 'add-row': {
      const after = at?.row ?? rows - 1;
      const next = addRow(matrix, after);
      if (next === matrix) return layout;
      const heights = [...layout.rowHeights];
      heights.splice(after + 1, 0, CELL_HEIGHT);
      return { ...layout, matrix: next, rowHeights: heights };
    }
    case 'remove-row': {
      const index = at?.row ?? rows - 1;
      const next = removeRow(matrix, index);
      if (next === matrix) return layout;
      return {
        ...layout,
        matrix: next,
        rowHeights: layout.rowHeights.filter((_, i) => i !== index),
      };
    }
    case 'add-col': {
      const after = at?.col ?? cols - 1;
      const next = addCol(matrix, after);
      if (next === matrix) return layout;
      const widths = [...layout.colWidths];
      widths.splice(after + 1, 0, CELL_WIDTH);
      return { ...layout, matrix: next, colWidths: widths };
    }
    case 'remove-col': {
      const index = at?.col ?? cols - 1;
      const next = removeCol(matrix, index);
      if (next === matrix) return layout;
      return { ...layout, matrix: next, colWidths: layout.colWidths.filter((_, i) => i !== index) };
    }
  }
}

/**
 * Zmiana struktury tabeli: odczyt -> operacja -> nowe elementy (ta sama grupa) w miejsce starych.
 * `at` = wybrana komórka (operacja przy niej) albo null (ostatni wiersz / kolumna). Nic się nie
 * zmieniło (np. usunięcie jedynego wiersza) = brak aktualizacji sceny.
 */
export async function editTable(
  api: ExcalidrawImperativeAPI,
  tableId: string,
  edit: TableEdit,
  at: { row: number; col: number } | null
): Promise<void> {
  const scene = api.getSceneElementsIncludingDeleted();
  const layout = readTable(scene, tableId);
  if (!layout) return;
  const next = applyEdit(layout, edit, at);
  if (next === layout) return;
  const { CaptureUpdateAction } = await import('@excalidraw/excalidraw');
  const fresh = await buildTableElements(next, tableId);
  const old = tableElementIds(scene, tableId);
  const now = Date.now();
  api.updateScene({
    elements: [
      ...scene.map((el) =>
        old.has(el.id)
          ? ({
              ...el,
              isDeleted: true,
              version: el.version + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
              updated: now,
            } as ExcalidrawElement)
          : el
      ),
      ...fresh,
    ],
    appState: {
      selectedElementIds: Object.fromEntries(fresh.map((e) => [e.id, true as const])),
      selectedGroupIds: { [tableId]: true },
      editingGroupId: null,
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}

/**
 * Zaznaczona tabela: id tabeli i - gdy zaznaczona dokładnie jedna komórka (po wejściu w grupę) -
 * jej wiersz i kolumna. Zaznaczona etykieta komórki liczy się jak komórka.
 */
export function selectedTable(
  elements: readonly ExcalidrawElement[],
  appState: Pick<AppState, 'selectedElementIds'>
): { tableId: string; cell: { row: number; col: number } | null } | null {
  const ids = Object.keys(appState.selectedElementIds).filter(
    (id) => appState.selectedElementIds[id]
  );
  if (ids.length === 0) return null;
  const byId = new Map(elements.map((el) => [el.id, el]));
  const cells = ids
    .map((id) => {
      const el = byId.get(id);
      const container = el?.type === 'text' && el.containerId ? byId.get(el.containerId) : el;
      return tableCellData(container);
    })
    .filter((d): d is TableCellData => d !== null);
  if (cells.length === 0) return null;
  const tableId = cells[0].tableId;
  if (cells.some((c) => c.tableId !== tableId)) return null;
  const unique = new Set(cells.map((c) => `${c.row}:${c.col}`));
  const cell = unique.size === 1 ? { row: cells[0].row, col: cells[0].col } : null;
  return { tableId, cell };
}
