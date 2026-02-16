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

import { useRef } from 'react';
import { X as XIcon, Copy, Files, Sparkles } from 'lucide-react';
import { DrawingElement, DrawingPath, Shape, MarkdownNote, ImageElement } from '../whiteboard/types';

interface SelectionPropertiesPanelProps {
  elements: DrawingElement[];
  selectedIds: Set<string>;
  position: { x: number; y: number };
  onElementUpdate: (id: string, updates: Partial<DrawingElement>) => void;
  onDeleteSelected?: () => void;
  onCopySelected?: () => void;
  onDuplicateSelected?: () => void;
}

// 🆕 Presety skali zawartości dla markdown
const CONTENT_SCALE_PRESETS = [
  { label: 'XS', value: 0.6 },
  { label: 'S', value: 0.8 },
  { label: 'M', value: 1 },
  { label: 'L', value: 1.25 },
  { label: 'XL', value: 1.5 },
  { label: '2XL', value: 2 },
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
                className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-gray-100"
              >
                <Copy className="w-5 h-5" />
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Kopiuj (Ctrl+C)
              </span>
            </div>
          )}

          {/* Duplicate */}
          {onDuplicateSelected && (
            <div className="relative group">
              <button
                onClick={onDuplicateSelected}
                className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-gray-100"
              >
                <Files className="w-5 h-5" />
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Duplikuj (Ctrl+D)
              </span>
            </div>
          )}

          <div className="w-px h-6 bg-gray-200" />

          {/* Rozwiąż z AI - z gradientem i animacją */}
          <div className="relative group">
            <button
  onClick={() => console.log('🤖 AI - funkcja w przygotowaniu')}
  className="mt-2 relative rounded-lg cursor-pointer transition-all duration-300 hover:scale-105"
  style={{
    padding: '1px',
    background: 'linear-gradient(90deg, rgba(96, 165, 250, 0.6), rgba(168, 85, 247, 0.6), rgba(96, 165, 250, 0.6))',
    backgroundSize: '200% 100%',
    animation: 'gradientMove 3s linear infinite',
    boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)'
  }}
>
  {/* Tło przycisku - ciemne z gradientem */}
  <div 
    className="relative bg-gradient-to-br from-slate-900 via-slate-950 to-black rounded-[7px] px-4 py-2 overflow-hidden"
  >
    
    {/* Shimmer effect */}
    <div 
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent pointer-events-none"
      style={{
        backgroundSize: '200% 100%',
        animation: 'shimmerMove 2s linear infinite'
      }}
    />
    
    {/* Gradient overlay - jasny góra, ciemny dół */}
    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
    
    {/* Zawartość przycisku */}
    <div className="relative flex items-center gap-2">
      {/* SVG Ikona */}
      <svg 
        viewBox="0 0 512 512" 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-4 h-4 drop-shadow-[0_0_6px_rgba(147,112,219,0.1)] animate-pulse-slow"
      >
        <path 
          fill="url(#aiGradient)" 
          d="M256 25.063c-61.584 61.583-76.97 107.77-76.97 138.562 0 30.792 46.18 46.188 76.97 46.188 30.792 0 76.97-15.396 76.97-46.188S317.583 86.647 256 25.062zM132.72 204.125c-9.21-.108-20.947 1.46-36.72 5.688 11.27 42.062 24.604 49.77 37.938 57.468C147.27 274.98 168.3 269.335 176 256c7.698-13.333 2.053-34.365-11.28-42.063-8.334-4.81-16.654-9.632-32-9.812zm246.56 0c-15.346.18-23.666 5-32 9.813-13.332 7.697-18.978 28.73-11.28 42.062 7.698 13.333 28.73 18.98 42.063 11.28 13.333-7.697 26.667-15.405 37.937-57.467-15.774-4.227-27.51-5.796-36.72-5.688zM256 240.595c-34.01 0-61.594 27.58-61.594 61.593 0 34.01 27.583 61.593 61.594 61.593 34.01 0 61.594-27.58 61.594-61.592S290.01 240.594 256 240.594zm-144.03 60.218c-5.005.098-9.887 1.353-14.47 4C70.833 320.21 38.542 356.625 16 440.75c84.125 22.54 131.833 12.77 158.5-2.625 26.667-15.396 16.896-63.083 1.5-89.75-12.75-22.084-39.923-48.04-64.03-47.563zm286.686 0c-23.76.5-50.147 25.895-62.656 47.562-15.396 26.667-25.167 74.354 1.5 89.75s74.375 25.166 158.5 2.625c-22.54-84.126-54.833-120.54-81.5-135.938-5-2.886-10.36-4.115-15.844-4zM256 394.563c-15.396 0-30.78 15.385-30.78 30.78 0 15.397-.012 30.803 30.78 61.594 30.792-30.792 30.78-46.198 30.78-61.593 0-15.396-15.384-30.78-30.78-30.78z"
        />
        <defs>
          <linearGradient id="aiGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e5dfff" />
            <stop offset="50%" stopColor="#c3b2f7" />
            <stop offset="100%" stopColor="#b292fd" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Tekst z gradientem */}
      <span className="text-transparent bg-clip-text bg-gradient-to-b from-violet-100/70 via-purple-100 to-violet-400 font-semibold text-sm">
        Rozwiąż z <strong>AI</strong>
      </span>
    </div>
  </div>
  
  {/* Dodajemy style animacji inline */}
  <style dangerouslySetInnerHTML={{__html: `
    @keyframes gradientMove {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    @keyframes shimmerMove {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `}} />
</button>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Rozwiąż zadanie z pomocą AI
            </span>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Usuń */}
          {onDeleteSelected && (
            <div className="relative group">
              <button
                onClick={onDeleteSelected}
                className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-red-50 hover:text-red-600"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
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
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-5 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Grubość: {currentWidth}px
            </span>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Kolor */}
          <div className="relative group">
            <div
              onClick={() => colorInputRef.current?.click()}
              className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-all cursor-pointer"
              style={{ backgroundColor: currentColor }}
            />
            <input
              ref={colorInputRef}
              type="color"
              value={currentColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="absolute opacity-0 pointer-events-none"
            />
           
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
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
                  className={`w-8 h-8 rounded-md transition-all cursor-pointer ${
                    currentFill
                      ? 'bg-blue-500/20 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-lg">{currentFill ? '◼' : '◻'}</span>
                </button>
                
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
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
                className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-red-50 hover:text-red-600"
              >
                <XIcon className="w-5 h-5" />
              </button>
              
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
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
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 mr-1">Tekst:</label>
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            {CONTENT_SCALE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleContentScaleChange(preset.value)}
                className={`px-2 py-1 text-xs font-medium transition-all ${
                  Math.abs(currentContentScale - preset.value) < 0.01
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
                title={`Skala ${Math.round(preset.value * 100)}%`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Pokaż aktualną skalę w % */}
          <span className="text-xs text-gray-500 ml-1">
            {Math.round(currentContentScale * 100)}%
          </span>

          {/* Info o liczbie zaznaczonych markdown */}
          {markdownElements.length > 1 && (
            <span className="text-xs text-gray-400 ml-1">({markdownElements.length})</span>
          )}
        </div>
      )}
    </div>
  );
}
