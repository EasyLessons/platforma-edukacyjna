/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/TextMiniToolbar.tsx
 * ============================================================================
 * 
 * EKSPORTUJE:
 * - TextMiniToolbar (component) - wspólny mini toolbar dla formatowania tekstu
 * 
 * UŻYWANE PRZEZ:
 * - TextTool.tsx (podczas tworzenia/edycji tekstu)
 * - SelectTool.tsx (gdy zaznaczony tekst)
 * 
 * PRZEZNACZENIE:
 * Reużywalny toolbar z opcjami formatowania tekstu:
 * - Rozmiar czcionki (8-120px)
 * - Kolor
 * - Bold/Italic
 * - Wyrównanie (left/center/right)
 * ============================================================================
 */

'use client';

import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface TextStyle {
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
}

interface TextMiniToolbarProps {
  style: TextStyle;
  onChange: (updates: Partial<TextStyle>) => void;
  position?: { x: number; y: number }; // Opcjonalna pozycja (dla SelectTool)
  className?: string;
}

export function TextMiniToolbar({ 
  style, 
  onChange, 
  position,
  className = ''
}: TextMiniToolbarProps) {
  const baseClasses = "bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-1 p-1 z-50";
  const positionClasses = position ? "absolute -translate-y-14" : "";
  
  return (
    <div
      className={`${baseClasses} ${positionClasses} ${className}`}
      style={position ? {
        left: position.x,
        top: position.y,
      } : undefined}
    >
      {/* Font size */}
      <input
        type="number"
        value={style.fontSize}
        onChange={(e) => {
          // Pozwól na wpisywanie dowolnej wartości (nawet poza zakresem)
          const newSize = Number(e.target.value);
          if (!isNaN(newSize)) {
            onChange({ fontSize: newSize });
          }
        }}
        onBlur={(e) => {
          // Waliduj TYLKO przy opuszczeniu pola
          const currentSize = Number(e.target.value);
          if (currentSize < 8) {
            onChange({ fontSize: 8 });
          } else if (currentSize > 120) {
            onChange({ fontSize: 120 });
          }
        }}
        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-black"
        min="8"
        max="120"
      />

      {/* Color */}
      <input
        type="color"
        value={style.color}
        onChange={(e) => onChange({ color: e.target.value })}
        className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
      />

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Bold */}
      <button
        onClick={() =>
          onChange({
            fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold',
          })
        }
        className={`p-1.5 rounded transition-colors ${
          style.fontWeight === 'bold'
            ? 'bg-blue-500 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Pogrubienie"
      >
        <Bold className="w-4 h-4" />
      </button>

      {/* Italic */}
      <button
        onClick={() =>
          onChange({
            fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic',
          })
        }
        className={`p-1.5 rounded transition-colors ${
          style.fontStyle === 'italic'
            ? 'bg-blue-500 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Kursywa"
      >
        <Italic className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Align Left */}
      <button
        onClick={() => onChange({ textAlign: 'left' })}
        className={`p-1.5 rounded transition-colors ${
          style.textAlign === 'left'
            ? 'bg-blue-500 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Do lewej"
      >
        <AlignLeft className="w-4 h-4" />
      </button>

      {/* Align Center */}
      <button
        onClick={() => onChange({ textAlign: 'center' })}
        className={`p-1.5 rounded transition-colors ${
          style.textAlign === 'center'
            ? 'bg-blue-500 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Wyśrodkuj"
      >
        <AlignCenter className="w-4 h-4" />
      </button>

      {/* Align Right */}
      <button
        onClick={() => onChange({ textAlign: 'right' })}
        className={`p-1.5 rounded transition-colors ${
          style.textAlign === 'right'
            ? 'bg-blue-500 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Do prawej"
      >
        <AlignRight className="w-4 h-4" />
      </button>
    </div>
  );
}
