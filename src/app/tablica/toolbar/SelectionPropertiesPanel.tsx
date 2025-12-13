/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/SelectionPropertiesPanel.tsx
 * ============================================================================
 * 
 * Panel właściwości dla zaznaczonych elementów (shape, path)
 * Wyświetla się gdy zaznaczone są elementy inne niż tekst
 * 
 * UŻYWANE PRZEZ:
 * - SelectTool.tsx (gdy zaznaczony kształt lub ścieżka)
 * ============================================================================
 */

'use client';

import { DrawingElement, DrawingPath, Shape } from '../whiteboard/types';

interface SelectionPropertiesPanelProps {
  elements: DrawingElement[];
  selectedIds: Set<string>;
  position: { x: number; y: number };
  onElementUpdate: (id: string, updates: Partial<DrawingElement>) => void;
}

export function SelectionPropertiesPanel({
  elements,
  selectedIds,
  position,
  onElementUpdate,
}: SelectionPropertiesPanelProps) {
  // Pobierz zaznaczone elementy
  const selectedElements = elements.filter(el => selectedIds.has(el.id));
  
  // Filtruj tylko kształty i ścieżki (nie tekst i nie obrazy)
  const editableElements = selectedElements.filter(
    el => el.type === 'shape' || el.type === 'path'
  ) as (Shape | DrawingPath)[];
  
  if (editableElements.length === 0) return null;
  
  // Pobierz wspólne właściwości
  const firstElement = editableElements[0];
  const hasMultiple = editableElements.length > 1;
  
  // Sprawdź czy wszystkie mają ten sam kolor
  const allSameColor = editableElements.every(el => el.color === firstElement.color);
  const currentColor = allSameColor ? firstElement.color : '#000000';
  
  // Sprawdź grubość (strokeWidth dla shape, width dla path)
  const getStrokeWidth = (el: Shape | DrawingPath): number => {
    if (el.type === 'shape') return el.strokeWidth;
    if (el.type === 'path') return el.width;
    return 3;
  };
  
  const allSameWidth = editableElements.every(el => getStrokeWidth(el) === getStrokeWidth(firstElement));
  const currentWidth = allSameWidth ? getStrokeWidth(firstElement) : 3;
  
  // Sprawdź czy są kształty z fill
  const shapesWithFill = editableElements.filter(el => 
    el.type === 'shape' && el.shapeType !== 'line' && el.shapeType !== 'arrow'
  ) as Shape[];
  const hasFillableShapes = shapesWithFill.length > 0;
  const allSameFill = shapesWithFill.every(s => s.fill === shapesWithFill[0]?.fill);
  const currentFill = hasFillableShapes && allSameFill ? shapesWithFill[0].fill : false;
  
  // Handlery
  const handleColorChange = (newColor: string) => {
    editableElements.forEach(el => {
      onElementUpdate(el.id, { color: newColor });
    });
  };
  
  const handleWidthChange = (newWidth: number) => {
    editableElements.forEach(el => {
      if (el.type === 'shape') {
        onElementUpdate(el.id, { strokeWidth: newWidth });
      } else if (el.type === 'path') {
        onElementUpdate(el.id, { width: newWidth });
      }
    });
  };
  
  const handleFillChange = (newFill: boolean) => {
    shapesWithFill.forEach(shape => {
      onElementUpdate(shape.id, { fill: newFill });
    });
  };
  
  return (
    <div
      className="absolute bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 p-2 z-50 pointer-events-auto"
      style={{
        left: position.x,
        top: position.y - 50,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Kolor */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500">Kolor</label>
        <input
          type="color"
          value={currentColor}
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-7 h-7 rounded border border-gray-300 cursor-pointer"
          title={hasMultiple && !allSameColor ? 'Różne kolory' : 'Kolor'}
        />
      </div>
      
      <div className="w-px h-6 bg-gray-200" />
      
      {/* Grubość */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500">Grubość</label>
        <input
          type="range"
          min="1"
          max="20"
          value={currentWidth}
          onChange={(e) => handleWidthChange(Number(e.target.value))}
          className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          title={hasMultiple && !allSameWidth ? 'Różne grubości' : `${currentWidth}px`}
        />
        <span className="text-xs text-gray-700 font-medium w-6">{currentWidth}px</span>
      </div>
      
      {/* Wypełnienie - tylko dla kształtów */}
      {hasFillableShapes && (
        <>
          <div className="w-px h-6 bg-gray-200" />
          <button
            onClick={() => handleFillChange(!currentFill)}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              currentFill 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={currentFill ? 'Wypełniony' : 'Kontur'}
          >
            {currentFill ? '◼' : '◻'}
          </button>
        </>
      )}
      
      {/* Info o liczbie zaznaczonych */}
      {hasMultiple && (
        <span className="text-xs text-gray-400 ml-1">
          ({editableElements.length})
        </span>
      )}
    </div>
  );
}
