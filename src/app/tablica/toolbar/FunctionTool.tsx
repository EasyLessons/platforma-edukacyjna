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
import {
  transformPoint,
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
} from '../whiteboard/viewport';
import { evaluateExpression } from '../whiteboard/utils';

interface FunctionToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  color: string;
  lineWidth: number;
  onFunctionCreate: (func: FunctionPlot) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function FunctionTool({
  viewport,
  canvasWidth,
  canvasHeight,
  color,
  lineWidth,
  onFunctionCreate,
  onColorChange,
  onLineWidthChange,
  onViewportChange,
}: FunctionToolProps) {
  const [expression, setExpression] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [xRange, setXRange] = useState(10);
  const [yRange, setYRange] = useState(10);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input po zamontowaniu
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 🆕 Handler dla wheel event - obsługuje zoom i pan
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!onViewportChange) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey) {
        // Zoom
        const newViewport = zoomViewport(
          viewport,
          e.deltaY,
          e.clientX,
          e.clientY,
          canvasWidth,
          canvasHeight
        );
        onViewportChange(constrainViewport(newViewport));
      } else {
        // Pan
        const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
        onViewportChange(constrainViewport(newViewport));
      }
    },
    [viewport, canvasWidth, canvasHeight, onViewportChange]
  );

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
      <div className="absolute top-20 left-24 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 pointer-events-auto max-w-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Funkcja matematyczna</h3>

        {/* Input wyrażenia */}
        <div className="mb-4">
          <label className="block text-base font-medium text-gray-600 mb-2">Wyrażenie f(x):</label>
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
            className={`w-full text-black px-4 py-3 border rounded-lg font-mono text-lg focus:outline-none transition-colors ${
              error
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-300 focus:border-blue-500'
            }`}
          />
          {error && (
            <p className="text-base text-red-600 mt-2 flex items-center gap-1">⚠️ {error}</p>
          )}
          <p className="text-base text-gray-500 mt-2">
            Dostępne: sin, cos, tan, sqrt, abs, log, ^, pi, e
          </p>
        </div>

        {/* Zakresy */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-base font-medium text-gray-600 mb-2">
              Zakres X: ±{xRange}
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={xRange}
              onChange={(e) => setXRange(Number(e.target.value))}
              className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-600 mb-2">
              Zakres Y: ±{yRange}
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={yRange}
              onChange={(e) => setYRange(Number(e.target.value))}
              className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* Kolor i grubość - edytowalne jak w Pen/Shape */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <label className="text-base font-medium text-gray-600">Kolor:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-14 h-14 rounded-lg border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 min-w-[200px]">
            <label className="text-base font-medium text-gray-600">Grubość:</label>
            <input
              type="range"
              min="1"
              max="8"
              value={lineWidth}
              onChange={(e) => onLineWidthChange(Number(e.target.value))}
              className="flex-1 h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-base text-gray-700 font-semibold w-12 text-right">
              {lineWidth}px
            </span>
          </div>

          {/* Przycisk pomocy */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors flex items-center justify-center font-bold text-xl"
            title="Pomoc - dostępne funkcje matematyczne"
          >
            ?
          </button>
        </div>

        {/* Przyciski */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={handleGenerate}
            disabled={!expression.trim()}
            className="flex-1 px-5 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
          >
            Dodaj funkcję
          </button>
          <button
            onClick={() => {
              setExpression('');
              setError(null);
            }}
            className="px-5 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-lg font-medium"
          >
            Wyczyść
          </button>
        </div>

        {/* Hint */}
        <p className="text-base text-gray-500 text-center">
          Enter = Dodaj | Scroll/Pinch = Zoom/Pan
        </p>
      </div>

      {/* Live Preview */}
      {expression.trim() && !error && renderPreview()}

      {/* Modal pomocy */}
      {isHelpOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[1000]"
          onClick={() => setIsHelpOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-5xl w-full mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-blue-500 text-white px-8 py-5 rounded-t-lg flex items-center justify-between shadow-lg">
              <h2 className="text-2xl font-bold">📐 Narzędzie Function - Przewodnik</h2>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="w-10 h-10 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors flex items-center justify-center font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-8">
              {/* Opis */}
              <div>
                <h3 className="text-2xl font-semibold text-black mb-3">Co to narzędzie robi?</h3>
                <p className="text-black text-base leading-relaxed">
                  Narzędzie <strong>Function</strong> pozwala rysować wykresy funkcji matematycznych
                  na tablicy. Wpisz wyrażenie matematyczne (np.{' '}
                  <code className="bg-gray-100 px-2 py-0.5 rounded text-black">sin(x)</code>),
                  dostosuj zakres i kolory, a funkcja zostanie narysowana na wykresie kartezjańskim.
                </p>
              </div>

              {/* Formularz do testowania */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
                <h3 className="text-2xl font-semibold text-black mb-4">🧪 Wypróbuj funkcję</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Wyrażenie matematyczne:
                    </label>
                    <input
                      type="text"
                      value={expression}
                      onChange={(e) => {
                        setExpression(e.target.value);
                        setError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && expression.trim()) {
                          handleGenerate();
                          setIsHelpOpen(false);
                        }
                      }}
                      placeholder="np. sin(x), x^2, sqrt(x)"
                      className="w-full px-4 py-3 text-base text-black border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    {error && <p className="text-red-600 text-sm mt-2 font-medium">⚠️ {error}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Zakres X: ±{xRange}
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={xRange}
                        onChange={(e) => setXRange(Number(e.target.value))}
                        className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Zakres Y: ±{yRange}
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={yRange}
                        onChange={(e) => setYRange(Number(e.target.value))}
                        className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-black">Kolor:</label>
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => onColorChange(e.target.value)}
                        className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <label className="text-sm font-semibold text-black">Grubość:</label>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={lineWidth}
                        onChange={(e) => onLineWidthChange(Number(e.target.value))}
                        className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <span className="text-sm text-black font-bold w-10 text-right">
                        {lineWidth}px
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      handleGenerate();
                      setIsHelpOpen(false);
                    }}
                    disabled={!expression.trim()}
                    className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold"
                  >
                    ➕ Dodaj funkcję do tablicy
                  </button>
                </div>
              </div>

              {/* Operatory */}
              <div>
                <h3 className="text-2xl font-semibold text-black mb-3">🔢 Operatory</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-blue-600 text-lg">+</code>
                    <span className="text-black ml-3 text-base">Dodawanie</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-blue-600 text-lg">-</code>
                    <span className="text-black ml-3 text-base">Odejmowanie</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-blue-600 text-lg">*</code>
                    <span className="text-black ml-3 text-base">Mnożenie</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-blue-600 text-lg">/</code>
                    <span className="text-black ml-3 text-base">Dzielenie</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-blue-600 text-lg">^</code>
                    <span className="text-black ml-3 text-base">Potęgowanie</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-blue-600 text-lg">%</code>
                    <span className="text-black ml-3 text-base">Reszta z dzielenia</span>
                  </div>
                </div>
              </div>

              {/* Funkcje matematyczne */}
              <div>
                <h3 className="text-3xl font-semibold text-black mb-4">📊 Funkcje matematyczne</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-blue-700 text-2xl">sqrt(x)</code>
                    <span className="text-black text-xl ml-3">Pierwiastek kwadratowy</span>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-blue-700 text-2xl">cbrt(x)</code>
                    <span className="text-black text-xl ml-3">Pierwiastek sześcienny</span>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-green-700 text-2xl">sin(x)</code>
                    <span className="text-black text-xl ml-3">Sinus</span>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-green-700 text-2xl">cos(x)</code>
                    <span className="text-black text-xl ml-3">Cosinus</span>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-green-700 text-2xl">tan(x)</code>
                    <span className="text-black text-xl ml-3">Tangens</span>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-green-700 text-2xl">asin(x)</code>
                    <span className="text-black text-xl ml-3">Arcus sinus</span>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-purple-700 text-2xl">log(x)</code>
                    <span className="text-black text-xl ml-3">Logarytm naturalny (ln)</span>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-purple-700 text-2xl">log10(x)</code>
                    <span className="text-black text-xl ml-3">Logarytm dziesiętny</span>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-orange-700 text-2xl">abs(x)</code>
                    <span className="text-black text-xl ml-3">Wartość bezwzględna</span>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-orange-700 text-2xl">exp(x)</code>
                    <span className="text-black text-xl ml-3">e^x</span>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-orange-700 text-2xl">ceil(x)</code>
                    <span className="text-black text-xl ml-3">Zaokrąglenie w górę</span>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <code className="font-mono font-bold text-orange-700 text-2xl">floor(x)</code>
                    <span className="text-black text-xl ml-3">Zaokrąglenie w dół</span>
                  </div>
                </div>
              </div>

              {/* Stałe */}
              <div>
                <h3 className="text-3xl font-semibold text-black mb-4">🔣 Stałe matematyczne</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-yellow-50 p-5 rounded-lg">
                    <code className="font-mono font-bold text-yellow-700 text-2xl">pi</code>
                    <span className="text-black ml-4 text-xl">π ≈ 3.14159...</span>
                  </div>
                  <div className="bg-yellow-50 p-5 rounded-lg">
                    <code className="font-mono font-bold text-yellow-700 text-2xl">e</code>
                    <span className="text-black ml-4 text-xl">e ≈ 2.71828...</span>
                  </div>
                </div>
              </div>

              {/* Przykłady */}
              <div>
                <h3 className="text-3xl font-semibold text-black mb-4">✨ Przykłady wyrażeń</h3>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-5 rounded-lg">
                    <code className="font-mono font-bold text-blue-800 text-2xl">sin(x)</code>
                    <span className="text-black ml-4 text-xl">- fala sinusoidalna</span>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-5 rounded-lg">
                    <code className="font-mono font-bold text-green-800 text-2xl">x^2</code>
                    <span className="text-black ml-4 text-xl">- parabola</span>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-5 rounded-lg">
                    <code className="font-mono font-bold text-purple-800 text-2xl">sqrt(x)</code>
                    <span className="text-black ml-4 text-xl">- pierwiastek kwadratowy</span>
                  </div>
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-5 rounded-lg">
                    <code className="font-mono font-bold text-orange-800 text-2xl">
                      2*sin(x) + cos(x)
                    </code>
                    <span className="text-black ml-4 text-xl">
                      - kombinacja funkcji trygonometrycznych
                    </span>
                  </div>
                  <div className="bg-gradient-to-r from-red-50 to-red-100 p-5 rounded-lg">
                    <code className="font-mono font-bold text-red-800 text-2xl">1/x</code>
                    <span className="text-black ml-4 text-xl">- hiperbola</span>
                  </div>
                  <div className="bg-gradient-to-r from-pink-50 to-pink-100 p-5 rounded-lg">
                    <code className="font-mono font-bold text-pink-800 text-2xl">abs(x)</code>
                    <span className="text-black ml-4 text-xl">
                      - wartość bezwzględna (kształt V)
                    </span>
                  </div>
                  <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-5 rounded-lg">
                    <code className="font-mono font-bold text-indigo-800 text-2xl">log(x)</code>
                    <span className="text-black ml-4 text-xl">- logarytm naturalny</span>
                  </div>
                </div>
              </div>

              {/* Wskazówki - zielone tło matematyczne */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-8 rounded-xl shadow-lg">
                <h3 className="text-3xl font-semibold mb-4 flex items-center gap-2">
                  <span>💡</span>
                  <span>Wskazówki</span>
                </h3>
                <ul className="space-y-3 text-xl">
                  <li className="flex items-start gap-2">
                    <span className="text-white font-bold">•</span>
                    <span>
                      Możesz łączyć funkcje:{' '}
                      <code className="bg-white bg-opacity-20 px-2 py-1 rounded text-white font-mono">
                        sin(x^2)
                      </code>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white font-bold">•</span>
                    <span>
                      Automatyczne mnożenie działa:{' '}
                      <code className="bg-white bg-opacity-20 px-2 py-1 rounded text-white font-mono">
                        2x
                      </code>{' '}
                      ={' '}
                      <code className="bg-white bg-opacity-20 px-2 py-1 rounded text-white font-mono">
                        2*x
                      </code>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white font-bold">•</span>
                    <span>Użyj suwaków do dostosowania zakresu widocznego wykresu</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white font-bold">•</span>
                    <span>Live preview pokazuje jak będzie wyglądał wykres przed dodaniem</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white font-bold">•</span>
                    <span>Scroll + Ctrl - zoom in/out, Scroll - przesuwanie w pionie</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
