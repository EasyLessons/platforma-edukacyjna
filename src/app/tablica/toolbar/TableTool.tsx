/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/TableTool.tsx
 * ============================================================================
 * 
 * Narzędzie do tworzenia edytowalnych tabel na tablicy.
 * Przydatne do kombinatoryki, statystyki, danych.
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { Point, ViewportTransform, TableElement } from '../whiteboard/types';
import { inverseTransformPoint, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';
import { Plus, Minus } from 'lucide-react';

interface TableToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onTableCreate: (table: TableElement) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function TableTool({
  viewport,
  canvasWidth,
  canvasHeight,
  onTableCreate,
  onViewportChange,
}: TableToolProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [configPosition, setConfigPosition] = useState<Point | null>(null);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [headerRow, setHeaderRow] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Ref do viewport żeby uniknąć re-subscribe wheel listenera
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // Wheel events dla pan/zoom - używa viewportRef
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (showConfig) return; // Nie obsługuj scroll gdy jest popup
      e.preventDefault();
      e.stopPropagation();
      
      const currentViewport = viewportRef.current;

      if (e.ctrlKey) {
        const newViewport = zoomViewport(currentViewport, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight);
        onViewportChange(constrainViewport(newViewport));
      } else {
        const newViewport = panViewportWithWheel(currentViewport, e.deltaX, e.deltaY);
        onViewportChange(constrainViewport(newViewport));
      }
    };

    overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleNativeWheel);
  }, [canvasWidth, canvasHeight, onViewportChange, showConfig]);

  const handleClick = (e: React.MouseEvent) => {
    if (showConfig) {
      setShowConfig(false);
      return;
    }

    const screenPoint = { x: e.clientX, y: e.clientY };
    setConfigPosition(screenPoint);
    setShowConfig(true);
  };

  const createTable = () => {
    if (!configPosition) return;

    const worldPoint = inverseTransformPoint(configPosition, viewport, canvasWidth, canvasHeight);
    
    // Utwórz pustą tablicę komórek
    const cells: string[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        row.push('');
      }
      cells.push(row);
    }

    // Rozmiary komórek w world units (0.6 = 60px, 0.28 = 28px)
    const cellWidth = 0.6;
    const cellHeight = 0.28;

    const newTable: TableElement = {
      id: Date.now().toString(),
      type: 'table',
      x: worldPoint.x,
      y: worldPoint.y,
      width: cols * cellWidth,
      height: rows * cellHeight,
      rows,
      cols,
      cells,
      headerRow,
      borderColor: '#d1d5db',
      headerBgColor: '#f3f4f6',
    };

    onTableCreate(newTable);
    setShowConfig(false);
    setConfigPosition(null);
  };

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: 'crosshair' }}>
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onClick={handleClick}
      />

      {/* Popup konfiguracji tabeli */}
      {showConfig && configPosition && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 pointer-events-auto"
          style={{
            left: configPosition.x,
            top: configPosition.y,
            transform: 'translate(-50%, 10px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Utwórz tabelę</h3>
          
          {/* Wiersze */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Wiersze:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRows(Math.max(1, rows - 1))}
                className="p-1 rounded hover:bg-gray-100"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-6 text-center text-sm font-medium">{rows}</span>
              <button
                onClick={() => setRows(Math.min(20, rows + 1))}
                className="p-1 rounded hover:bg-gray-100"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Kolumny */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-600">Kolumny:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCols(Math.max(1, cols - 1))}
                className="p-1 rounded hover:bg-gray-100"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-6 text-center text-sm font-medium">{cols}</span>
              <button
                onClick={() => setCols(Math.min(10, cols + 1))}
                className="p-1 rounded hover:bg-gray-100"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Nagłówek */}
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={headerRow}
              onChange={(e) => setHeaderRow(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-xs text-gray-600">Wiersz nagłówka</span>
          </label>

          {/* Preview */}
          <div className="mb-3 border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {Array.from({ length: Math.min(rows, 4) }).map((_, r) => (
                  <tr key={r} className={r === 0 && headerRow ? 'bg-gray-100' : ''}>
                    {Array.from({ length: Math.min(cols, 4) }).map((_, c) => (
                      <td key={c} className="border border-gray-200 px-2 py-1 text-center text-gray-400">
                        {r === 0 && headerRow ? `K${c + 1}` : '...'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Przyciski */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfig(false)}
              className="flex-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Anuluj
            </button>
            <button
              onClick={createTable}
              className="flex-1 px-3 py-1.5 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors"
            >
              Utwórz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Komponent do wyświetlania i edycji tabeli (używany w renderowaniu)
// MEMOIZOWANY - nie re-renderuje się gdy zmienia się tylko viewport
interface TableViewProps {
  table: TableElement;
  onCellChange: (row: number, col: number, value: string) => void;
}

export const TableView = memo(function TableView({ table, onCellChange }: TableViewProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (row: number, col: number) => {
    setEditingCell({ row, col });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleCellChange = (e: React.ChangeEvent<HTMLInputElement>, row: number, col: number) => {
    onCellChange(row, col, e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab' && editingCell) {
      e.preventDefault();
      const { row, col } = editingCell;
      const nextCol = col + 1;
      const nextRow = row + 1;
      
      if (nextCol < table.cols) {
        setEditingCell({ row, col: nextCol });
      } else if (nextRow < table.rows) {
        setEditingCell({ row: nextRow, col: 0 });
      } else {
        setEditingCell(null);
      }
    }
  };

  // Stały rozmiar czcionki - bez dynamicznego skalowania dla lepszej wydajności
  const fontSize = 14;

  return (
    <table
      className="w-full h-full border-collapse"
      style={{ fontSize }}
    >
      <tbody>
        {table.cells.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            className={rowIndex === 0 && table.headerRow ? 'font-semibold' : ''}
            style={{
              backgroundColor: rowIndex === 0 && table.headerRow ? (table.headerBgColor || '#f3f4f6') : 'white',
            }}
          >
            {row.map((cell, colIndex) => (
              <td
                key={colIndex}
                className="border px-2 py-1 cursor-pointer"
                style={{ 
                  borderColor: table.borderColor || '#d1d5db',
                  wordBreak: 'break-word',
                }}
                onDoubleClick={() => handleCellClick(rowIndex, colIndex)}
              >
                {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={cell}
                    onChange={(e) => handleCellChange(e, rowIndex, colIndex)}
                    onBlur={handleCellBlur}
                    onKeyDown={handleKeyDown}
                    className="w-full border-none outline-none bg-blue-50 px-1 text-black"
                    style={{ fontSize }}
                  />
                ) : (
                  <span className="block min-h-[1.2em] text-black" style={{ wordBreak: 'break-word' }}>{cell || '\u00A0'}</span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - re-render only when table data changes
  return (
    prevProps.table.id === nextProps.table.id &&
    prevProps.table.cells === nextProps.table.cells &&
    prevProps.table.headerRow === nextProps.table.headerRow
  );
});
