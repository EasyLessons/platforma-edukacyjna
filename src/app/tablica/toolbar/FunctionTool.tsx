/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/FunctionTool.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, useCallback, useRef, useEffect)
 * - ../whiteboard/types (ViewportTransform, FunctionPlot)
 * - ../whiteboard/viewport (transformPoint, zoomViewport, panViewportWithWheel, constrainViewport)
 * - ../whiteboard/utils (evaluateExpression)
 * 
 * EKSPORTUJE:
 * - FunctionTool (component) - narzędzie rysowania funkcji matematycznych
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (aktywne gdy tool === 'function')
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - używa FunctionPlot
 * - viewport.ts - używa funkcji transformacji i zoom/pan
 * - utils.ts - używa evaluateExpression do parsowania wyrażeń
 * - WhiteboardCanvas.tsx - dostarcza callback'i: onFunctionCreate, onViewportChange
 * 
 * ⚠️ WAŻNE - WHEEL EVENTS:
 * - Overlay ma touchAction: 'none' - blokuje domyślny zoom przeglądarki
 * - onWheel obsługuje zoom (Ctrl+scroll) i pan (scroll)
 * - Współdzieli viewport z WhiteboardCanvas przez onViewportChange
 * 
 * PRZEZNACZENIE:
 * Rysowanie wykresów funkcji matematycznych z live preview i edycją parametrów.
 * ============================================================================
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ViewportTransform, FunctionPlot } from '../whiteboard/types';
import { transformPoint, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';
import { evaluateExpression } from '../whiteboard/utils';

interface FunctionToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  color: string;
  lineWidth: number;
  onFunctionCreate: (func: FunctionPlot) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function FunctionTool({
  viewport,
  canvasWidth,
  canvasHeight,
  color,
  lineWidth,
  onFunctionCreate,
  onViewportChange,
}: FunctionToolProps) {
  const [expression, setExpression] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [xRange, setXRange] = useState(50);
  const [yRange, setYRange] = useState(50);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input po zamontowaniu
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 🆕 Handler dla wheel event - obsługuje zoom i pan
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!onViewportChange) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (e.ctrlKey) {
      // Zoom
      const newViewport = zoomViewport(viewport, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight);
      onViewportChange(constrainViewport(newViewport));
    } else {
      // Pan
      const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
      onViewportChange(constrainViewport(newViewport));
    }
  }, [viewport, canvasWidth, canvasHeight, onViewportChange]);

  // Walidacja wyrażenia matematycznego
  const validateExpression = useCallback((expr: string): boolean => {
    if (!expr.trim()) {
      setError('Wprowadź wyrażenie matematyczne');
      return false;
    }

    try {
      // Test na kilku punktach
      for (let x = -10; x <= 10; x += 1) {
        const y = evaluateExpression(expr, x);
        if (!isFinite(y)) {
          setError('Wyrażenie zwraca nieprawidłowe wartości');
          return false;
        }
      }
      setError(null);
      return true;
    } catch (e) {
      setError('Nieprawidłowe wyrażenie matematyczne');
      return false;
    }
  }, []);

  // Generuj funkcję
  const handleGenerate = useCallback(() => {
    if (!validateExpression(expression)) return;

    const newFunction: FunctionPlot = {
      id: Date.now().toString(),
      type: 'function',
      expression: expression.trim(),
      color,
      strokeWidth: lineWidth,
      xRange,
      yRange,
    };

    onFunctionCreate(newFunction);
    setExpression(''); // Reset po dodaniu
    setError(null);
  }, [expression, color, lineWidth, xRange, yRange, onFunctionCreate, validateExpression]);

  // Renderuj live preview funkcji
  const renderPreview = () => {
    if (!expression.trim()) return null;

    try {
      const points: { x: number; y: number }[] = [];
      const step = 0.1;

      for (let worldX = -xRange; worldX <= xRange; worldX += step) {
        try {
          const worldY = evaluateExpression(expression, worldX);
          if (!isFinite(worldY) || Math.abs(worldY) > yRange) continue;
          
          const screenPos = transformPoint(
            { x: worldX, y: -worldY },
            viewport,
            canvasWidth,
            canvasHeight
          );
          points.push(screenPos);
        } catch (e) {
          // Ignoruj punkty z błędami (np. log(-1))
        }
      }

      if (points.length < 2) return null;

      const pathData = points
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(' ');

      return (
        <svg
          className="absolute inset-0 pointer-events-none z-40"
          style={{ width: canvasWidth, height: canvasHeight }}
        >
          <path
            d={pathData}
            stroke={color}
            strokeWidth={lineWidth * viewport.scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.5}
          />
        </svg>
      );
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: 'crosshair' }}>
      {/* Overlay dla wheel events */}
      <div
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onWheel={handleWheel}
      />

      {/* Input Panel - Pod toolbarem (jak properties innych narzędzi) */}
      <div className="absolute top-36 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 pointer-events-auto max-w-md">
        <h3 className="text-sm font-bold text-gray-800 mb-2">Funkcja matematyczna</h3>

        {/* Input wyrażenia */}
        <div className="mb-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Wyrażenie f(x):
          </label>
          <input
            ref={inputRef}
            type="text"
            value={expression}
            onChange={(e) => {
              setExpression(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleGenerate();
              }
            }}
            placeholder="np. sin(x), x^2, 2*x + 1"
            className={`w-full px-2 py-1.5 border rounded-lg font-mono text-sm focus:outline-none transition-colors ${
              error
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-300 focus:border-blue-500'
            }`}
          />
          {error && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              ⚠️ {error}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Dostępne: sin, cos, tan, sqrt, abs, log, ^, pi, e
          </p>
        </div>

        {/* Zakresy */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Zakres X: ±{xRange}
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={xRange}
              onChange={(e) => setXRange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Zakres Y: ±{yRange}
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={yRange}
              onChange={(e) => setYRange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* Kolor i grubość */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kolor:</label>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border border-gray-300"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-700 font-mono">{color}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Grubość: {lineWidth}px
            </label>
            <div className="h-8 flex items-center">
              <div
                className="h-1 rounded-full bg-gray-800"
                style={{ height: `${lineWidth}px`, width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Przyciski */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={handleGenerate}
            disabled={!expression.trim()}
            className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Dodaj funkcję
          </button>
          <button
            onClick={() => {
              setExpression('');
              setError(null);
            }}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Wyczyść
          </button>
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-500 text-center">
          Enter = Dodaj | Scroll/Pinch = Zoom/Pan
        </p>
      </div>

      {/* Live Preview */}
      {expression.trim() && !error && renderPreview()}
    </div>
  );
}
