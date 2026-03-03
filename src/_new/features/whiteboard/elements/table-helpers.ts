/**
 * table-helpers.ts
 * 
 * Pomocnicze funkcje do zarządzania tabelami.
 * Głównie obliczanie fontSize na podstawie rozmiaru tabeli.
 */

import type { TableElement } from '../types';

/**
 * Oblicz optymalny fontSize dla tabeli w world units.
 * Wywoływane przy tworzeniu i resizing tabeli.
 * 
 * @param height - wysokość tabeli w world units
 * @param rows - liczba wierszy
 * @returns fontSize w world units (np. 0.12)
 */
export function calculateTableFontSize(height: number, rows: number): number {
  const cellHeight = height / rows;
  // cellHeight * 0.42 to dobry stosunek tekstu do wysokości komórki
  // Minimalnie 0.08 (8px przy scale=1), maksymalnie 0.15 (15px przy scale=1)
  return Math.max(0.08, Math.min(cellHeight * 0.42, 0.15));
}

/**
 * Przebuduj tablicę cells po zmianie liczby wierszy/kolumn.
 * Zachowuje istniejące dane, dodaje puste komórki gdzie trzeba.
 */
export function resizeTableCells(
  oldCells: string[][],
  oldRows: number,
  oldCols: number,
  newRows: number,
  newCols: number
): string[][] {
  const newCells: string[][] = [];
  
  for (let r = 0; r < newRows; r++) {
    const row: string[] = [];
    for (let c = 0; c < newCols; c++) {
      // Kopiuj istniejącą komórkę lub wstaw pustą
      row.push(oldCells[r]?.[c] ?? '');
    }
    newCells.push(row);
  }
  
  return newCells;
}
