'use client';

/**
 * Mini-pasek tabeli (etap B2): widoczny, gdy zaznaczona jest tabela (cała grupa albo komórka po wejściu
 * w grupę). Dodaje / usuwa wiersz i kolumnę - przy zaznaczonej komórce obok niej, inaczej na końcu.
 * Tekst komórki edytuje się natywnie (podwójne kliknięcie w komórkę). Viewer paska nie dostaje.
 */

import { useEffect, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { createLogger } from '@/_new/lib/logger';
import { editTable, selectedTable, type TableEdit } from './table';

const log = createLogger('board-engine/table-toolbar');

type Selection = ReturnType<typeof selectedTable>;

/** Zaznaczona tabela (śledzi `api.onChange`; null bez API albo w trybie tylko do odczytu). */
export function useSelectedTable(
  api: ExcalidrawImperativeAPI | null,
  readOnly: boolean
): Selection {
  const [selection, setSelection] = useState<Selection>(null);
  useEffect(() => {
    if (!api || readOnly) {
      setSelection(null);
      return;
    }
    return api.onChange((elements, appState) => {
      const next = selectedTable(elements, appState);
      setSelection((prev) =>
        prev?.tableId === next?.tableId &&
        prev?.cell?.row === next?.cell?.row &&
        prev?.cell?.col === next?.cell?.col
          ? prev
          : next
      );
    });
  }, [api, readOnly]);
  return selection;
}

const BUTTONS: { edit: TableEdit; label: string; title: string }[] = [
  { edit: 'add-row', label: '+ wiersz', title: 'Dodaj wiersz' },
  { edit: 'remove-row', label: '− wiersz', title: 'Usuń wiersz' },
  { edit: 'add-col', label: '+ kolumna', title: 'Dodaj kolumnę' },
  { edit: 'remove-col', label: '− kolumna', title: 'Usuń kolumnę' },
];

interface TableToolbarProps {
  api: ExcalidrawImperativeAPI | null;
  selection: Selection;
}

export function TableToolbar({ api, selection }: TableToolbarProps) {
  if (!api || !selection) return null;
  const { tableId, cell } = selection;
  return (
    <div
      role="toolbar"
      aria-label="Tabela"
      data-testid="table-toolbar"
      className="pointer-events-auto absolute left-1/2 top-16 z-20 flex -translate-x-1/2 flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-md"
    >
      <span className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Tabela{cell ? ` · ${cell.row + 1}:${cell.col + 1}` : ''}
      </span>
      {BUTTONS.map(({ edit, label, title }) => (
        <button
          key={edit}
          type="button"
          title={title}
          data-testid={`table-${edit}`}
          onClick={() =>
            editTable(api, tableId, edit, cell).catch((error) =>
              log.error('Zmiana tabeli nie powiodła się', error)
            )
          }
          className="whitespace-nowrap rounded-md px-2 py-1 text-gray-800 hover:bg-gray-100"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
