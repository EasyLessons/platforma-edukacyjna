/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/SelectionPropertiesPanel.tsx
 * ============================================================================
 *
 * Panel właściwości dla zaznaczonych elementów (shape, path, markdown)
 * Wyświetla się gdy zaznaczone są elementy inne niż tekst
 *
 * 🆕 ZMIANY:
 * - Dodano obsługę contentScale dla notatek Markdown
 * - Presety: XS (0.6), S (0.8), M (1), L (1.25), XL (1.5), 2XL (2)
 *
 * UŻYWANE PRZEZ:
 * - SelectTool.tsx (gdy zaznaczony kształt, ścieżka lub markdown)
 * ============================================================================
 */

'use client';

import { useRef, useState } from 'react';
import { X as XIcon, Copy, Files } from 'lucide-react';
import { DrawingElement, DrawingPath, Shape, MarkdownNote, ImageElement } from '@/_new/features/whiteboard/types';

interface SelectionPropertiesPanelProps {
  elements: DrawingElement[];
  selectedIds: Set<string>;
  position: { x: number; y: number };
  onElementUpdate: (id: string, updates: Partial<DrawingElement>) => void;
  onDeleteSelected?: () => void;
  onCopySelected?: () => void;
  onDuplicateSelected?: () => void;
}

// Szybkie presety skali — reszta przez wpisanie wartości
const CONTENT_SCALE_PRESETS = [
  { label: '50%',  value: 0.5 },
  { label: '100%', value: 1   },
  { label: '200%', value: 2   },
  { label: '500%', value: 5   },
];

export function SelectionPropertiesPanel({
  elements,
  selectedIds,
  position,
  onElementUpdate,
  onDeleteSelected,
  onCopySelected,
  onDuplicateSelected,
}: SelectionPropertiesPanelProps) {
  // Ref dla input koloru
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Lokalny stan wpisywanej wartości skali tekstu (string podczas edycji)
  const [scaleInput, setScaleInput] = useState<string>('');
  const [isEditingScale, setIsEditingScale] = useState(false);

  // Ref dla color pickera tła markdown
  const bgColorInputRef = useRef<HTMLInputElement>(null);

  // Pobierz zaznaczone elementy
  const selectedElements = elements.filter((el) => selectedIds.has(el.id));

  // Filtruj kształty i ścieżki (nie tekst i nie obrazy)
  const editableElements = selectedElements.filter(
    (el) => el.type === 'shape' || el.type === 'path'
  ) as (Shape | DrawingPath)[];

  // 🆕 Filtruj notatki markdown
  const markdownElements = selectedElements.filter(
    (el) => el.type === 'markdown'
  ) as MarkdownNote[];

  // 🆕 Filtruj obrazki
  const imageElements = selectedElements.filter(
    (el) => el.type === 'image'
  ) as ImageElement[];

  // Jeśli nie ma żadnych elementów do edycji - nie pokazuj panelu
  if (editableElements.length === 0 && markdownElements.length === 0 && imageElements.length === 0) return null;

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIKA DLA SHAPE/PATH
  // ══════════════════════════════════════════════════════════════════════════

  const hasEditableElements = editableElements.length > 0;
  const firstElement = editableElements[0];
  const hasMultiple = editableElements.length > 1;

  // Sprawdź czy wszystkie mają ten sam kolor
  const allSameColor =
    hasEditableElements && editableElements.every((el) => el.color === firstElement.color);
  const currentColor = allSameColor ? firstElement.color : '#000000';

  // Sprawdź grubość (strokeWidth dla shape, width dla path)
  const getStrokeWidth = (el: Shape | DrawingPath): number => {
    if (el.type === 'shape') return el.strokeWidth;
    if (el.type === 'path') return el.width;
    return 3;
  };

  const allSameWidth =
    hasEditableElements &&
    editableElements.every((el) => getStrokeWidth(el) === getStrokeWidth(firstElement));
  const currentWidth = allSameWidth ? getStrokeWidth(firstElement) : 3;

  // Sprawdź czy są kształty z fill
  const shapesWithFill = editableElements.filter(
    (el) => el.type === 'shape' && el.shapeType !== 'line' && el.shapeType !== 'arrow'
  ) as Shape[];
  const hasFillableShapes = shapesWithFill.length > 0;
  const allSameFill = shapesWithFill.every((s) => s.fill === shapesWithFill[0]?.fill);
  const currentFill = hasFillableShapes && allSameFill ? shapesWithFill[0].fill : false;

  // ══════════════════════════════════════════════════════════════════════════
  // 🆕 LOGIKA DLA MARKDOWN (contentScale)
  // ══════════════════════════════════════════════════════════════════════════

  const hasMarkdownElements = markdownElements.length > 0;
  const firstMarkdown = markdownElements[0];

  // ══════════════════════════════════════════════════════════════════════════
  // 🆕 LOGIKA DLA IMAGES
  // ══════════════════════════════════════════════════════════════════════════

  const hasImageElements = imageElements.length > 0;

  // Sprawdź czy wszystkie markdown mają tę samą skalę
  const allSameContentScale =
    hasMarkdownElements &&
    markdownElements.every((el) => (el.contentScale ?? 1) === (firstMarkdown?.contentScale ?? 1));
  const currentContentScale = allSameContentScale ? (firstMarkdown?.contentScale ?? 1) : 1;

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERY
  // ══════════════════════════════════════════════════════════════════════════

  const handleColorChange = (newColor: string) => {
    editableElements.forEach((el) => {
      onElementUpdate(el.id, { color: newColor });
    });
  };

  const handleWidthChange = (newWidth: number) => {
    editableElements.forEach((el) => {
      if (el.type === 'shape') {
        onElementUpdate(el.id, { strokeWidth: newWidth });
      } else if (el.type === 'path') {
        onElementUpdate(el.id, { width: newWidth });
      }
    });
  };

  const handleFillChange = (newFill: boolean) => {
    shapesWithFill.forEach((shape) => {
      onElementUpdate(shape.id, { fill: newFill });
    });
  };

  // 🆕 Handler dla contentScale
  const handleContentScaleChange = (newScale: number) => {
    markdownElements.forEach((el) => {
      onElementUpdate(el.id, { contentScale: newScale });
    });
  };

  // 🆕 Handler dla backgroundColor notatki
  const handleBgColorChange = (newColor: string) => {
    markdownElements.forEach((el) => {
      onElementUpdate(el.id, { backgroundColor: newColor });
    });
  };

  const currentBgColor =
    markdownElements.length > 0 ? (markdownElements[0].backgroundColor ?? '#ffffff') : '#ffffff';

  return (
    <div
      className="absolute bg-white rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.08)] border border-gray-200 flex items-center gap-2 p-2 z-50 pointer-events-auto"
      style={{
        left: position.x,
        top: position.y - 80,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ═══════════════════════════════════════════════════════════════════════
          🖼️ PANEL DLA OBRAZKÓW
          ═══════════════════════════════════════════════════════════════════════ */}
      {hasImageElements && (
        <>
          {/* Copy */}
          {onCopySelected && (
            <div className="relative group ">
              <button
                onClick={onCopySelected}
                className="p-1.5 rounded-md cursor-pointer text-gray-700 hover:bg-gray-100"
              >
                <Copy className="w-5 h-5" />
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                Kopiuj (Ctrl+C)
              </span>
            </div>
          )}

          {/* Duplicate */}
          {onDuplicateSelected && (
            <div className="relative group">
              <button
                onClick={onDuplicateSelected}
                className="p-1.5 rounded-md cursor-pointer text-gray-700 hover:bg-gray-100"
              >
                <Files className="w-5 h-5" />
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                Duplikuj (Ctrl+D)
              </span>
            </div>
          )}

          <div className="w-px h-6 bg-gray-200" />

          {/* Rozwiąż z AI - UPROSZCZONE bez animacji */}
          <div className="relative group">
            <button
              onClick={() => console.log('🤖 AI - funkcja w przygotowaniu')}
              className="relative rounded-lg cursor-pointer px-4 py-2 bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white"
              style={{
                border: '1px solid rgba(139, 92, 246, 0.4)'
              }}
            >
              <span className="text-xs font-semibold text-violet-200">
                Rozwiąż z AI
              </span>
            </button>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
              Rozwiąż zadanie z pomocą AI
            </span>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Usuń */}
          {onDeleteSelected && (
            <div className="relative group">
              <button
                onClick={onDeleteSelected}
                className="p-1.5 rounded-md cursor-pointer text-gray-700 hover:bg-red-50 hover:text-red-600"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                Usuń (Del)
              </span>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          KONTROLKI DLA SHAPE/PATH
          ═══════════════════════════════════════════════════════════════════════ */}
      {hasEditableElements && (
        <>
          {/* Grubość - slider poziomy */}
          <div className="relative group flex items-center">
            <input
              type="range"
              min="1"
              max="20"
              value={currentWidth}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-5 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
              Grubość: {currentWidth}px
            </span>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Kolor */}
          <div className="relative group">
            <div
              onClick={() => colorInputRef.current?.click()}
              className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400 cursor-pointer"
              style={{ backgroundColor: currentColor }}
            />
            <input
              ref={colorInputRef}
              type="color"
              value={currentColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="absolute opacity-0 pointer-events-none"
            />
           
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
              {hasMultiple && !allSameColor ? 'Różne kolory' : 'Kolor'}
            </span>
          </div>

          {/* Wypełnienie - tylko dla kształtów */}
          {hasFillableShapes && (
            <>
              <div className="w-px h-6 bg-gray-200" />
              <div className="relative group">
                <button
                  onClick={() => handleFillChange(!currentFill)}
                  className={`w-8 h-8 rounded-md cursor-pointer ${
                    currentFill
                      ? 'bg-blue-500/20 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-lg">{currentFill ? '◼' : '◻'}</span>
                </button>
                
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                  {currentFill ? 'Wypełniony' : 'Kontur'}
            </span>
              </div>
            </>
          )}

          <div className="w-px h-6 bg-gray-200" />

          {/* Przycisk usuń */}
          {onDeleteSelected && (
            <div className="relative group">
              <button
                onClick={onDeleteSelected}
                className="p-1.5 rounded-md cursor-pointer text-gray-700 hover:bg-red-50 hover:text-red-600"
              >
                <XIcon className="w-5 h-5" />
              </button>
              
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                Usuń zaznaczone (Del)            
              </span>
              
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          🆕 SEPARATOR JEŚLI SĄ OBA TYPY
          ═══════════════════════════════════════════════════════════════════════ */}
      {hasEditableElements && hasMarkdownElements && <div className="w-px h-6 bg-gray-300 mx-1" />}

      {/* ═══════════════════════════════════════════════════════════════════════
          🆕 KONTROLKI DLA MARKDOWN (contentScale)
          ═══════════════════════════════════════════════════════════════════════ */}
      {hasMarkdownElements && (
        <div className="flex items-center gap-1.5">
          {/* Kolor tła notatki */}
          <div className="relative group">
            <div
              onClick={() => bgColorInputRef.current?.click()}
              className="w-7 h-7 rounded-md border-2 border-gray-300 hover:border-gray-400 cursor-pointer shadow-sm"
              style={{ backgroundColor: currentBgColor }}
              title="Kolor tła notatki"
            />
            <input
              ref={bgColorInputRef}
              type="color"
              value={currentBgColor}
              onChange={(e) => handleBgColorChange(e.target.value)}
              className="absolute opacity-0 pointer-events-none"
            />
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
              Kolor tła
            </span>
          </div>

          <div className="w-px h-5 bg-gray-200" />

          <label className="text-xs text-gray-500">Tekst:</label>

          {/* Szybkie presety */}
          <div className="flex rounded-md overflow-hidden border border-gray-200">
            {CONTENT_SCALE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleContentScaleChange(preset.value)}
                title={`Skala ${Math.round(preset.value * 100)}%`}
                className={`px-2 py-1 text-xs font-medium transition-colors ${
                  Math.abs(currentContentScale - preset.value) < 0.01
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-200" />

          {/* Stepper z dowolną wartością */}
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            {/* Przycisk minus — krok −25% */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const next = Math.max(0.1, Math.round((currentContentScale - 1) * 100) / 100);
                handleContentScaleChange(next);
              }}
              className="px-1.5 py-1 text-sm font-bold text-gray-600 hover:bg-gray-100 select-none"
              title="Zmniejsz o 100%"
            >
              −
            </button>

            {/* Input liczbowy — wpisz dowolną wartość i zatwierdź Enter / Tab / blur */}
            <input
              type="text"
              inputMode="numeric"
              value={
                isEditingScale
                  ? scaleInput
                  : String(Math.round(currentContentScale * 100))
              }
              onFocus={() => {
                setScaleInput(String(Math.round(currentContentScale * 100)));
                setIsEditingScale(true);
              }}
              onChange={(e) => {
                // Pozwól wpisywać tylko cyfry
                if (/^\d*$/.test(e.target.value)) setScaleInput(e.target.value);
              }}
              onBlur={() => {
                const val = parseInt(scaleInput, 10);
                if (!isNaN(val) && val >= 10 && val <= 10000) {
                  handleContentScaleChange(val / 100);
                }
                setIsEditingScale(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  const val = parseInt(scaleInput, 10);
                  if (!isNaN(val) && val >= 10 && val <= 10000) {
                    handleContentScaleChange(val / 100);
                  }
                  setIsEditingScale(false);
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === 'Escape') {
                  setIsEditingScale(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-14 text-center text-xs py-1 border-none outline-none bg-white font-mono text-black"
              title="Wpisz rozmiar w % (np. 500, 1000) i naciśnij Enter"
            />
            <span className="text-xs text-gray-500 pr-1 select-none">%</span>

            {/* Przycisk plus — krok +25% */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const next = Math.min(100, Math.round((currentContentScale + 1) * 100) / 100);
                handleContentScaleChange(next);
              }}
              className="px-1.5 py-1 text-sm font-bold text-gray-600 hover:bg-gray-100 select-none"
              title="Zwiększ o 100%"
            >
              +
            </button>
          </div>

          {/* Info o liczbie zaznaczonych markdown */}
          {markdownElements.length > 1 && (
            <span className="text-xs text-gray-400">({markdownElements.length})</span>
          )}
        </div>
      )}
    </div>
  );
}

