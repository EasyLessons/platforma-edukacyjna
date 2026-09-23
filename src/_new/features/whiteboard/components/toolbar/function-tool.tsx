/**
 * ============================================================================
 * PLIK: components/toolbar/function-tool.tsx
 * ============================================================================
 *
 * IMPORTUJE Z:
 * - react (useState, useCallback, useRef, useEffect)
 * - ../whiteboard/types (ViewportTransform, FunctionPlot)
 * - navigation/viewport-math (zoomViewport, panViewportWithWheel, constrainViewport)
 * - ./function-tool/function-plot (validateExpression, sampleFunctionPoints)
 * - ./function-tool/plot-geometry (projectPointsToScreen, buildSvgPath)
 * - ./function-tool/function-help-modal (FunctionHelpModal)
 *
 * EKSPORTUJE:
 * - FunctionTool (component) - narzędzie rysowania funkcji matematycznych
 *
 * UŻYWANE PRZEZ:
 * - tools/function.tool.tsx (aktywne gdy tool === 'function')
 *
 * ⚠️ WAŻNE - WHEEL EVENTS:
 * - Overlay ma touchAction: 'none' - blokuje domyślny zoom przeglądarki
 * - onWheel obsługuje zoom (Ctrl+scroll) i pan (scroll)
 * - Współdzieli viewport z WhiteboardCanvas przez onViewportChange
 *
 * PRZEZNACZENIE:
 * Rysowanie wykresów funkcji matematycznych z live preview i edycją parametrów.
 * Czysta logika (walidacja, próbkowanie, geometria) leży w `./function-tool/`.
 * ============================================================================
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ViewportTransform, FunctionPlot } from '@/_new/features/whiteboard/types';
import {
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
} from '@/_new/features/whiteboard/navigation/viewport-math';
import { validateExpression, sampleFunctionPoints } from './function-tool/function-plot';
import { projectPointsToScreen, buildSvgPath } from './function-tool/plot-geometry';
import { FunctionHelpModal } from './function-tool/function-help-modal';

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
  isGestureActive?: boolean;
}

const VERTICAL_SLIDER_CLASS =
  'hover:cursor-pointer absolute h-28 w-2 appearance-none bg-transparent cursor-default accent-blue-500';
const VERTICAL_SLIDER_STYLE = {
  writingMode: 'bt-lr' as any,
  WebkitAppearance: 'slider-vertical',
} as const;

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
  isGestureActive: _isGestureActive,
}: FunctionToolProps) {
  const [expression, setExpression] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [xRange, setXRange] = useState(10);
  const [yRange, setYRange] = useState(10);
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed'>('solid');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input po zamontowaniu
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handler dla wheel event - obsługuje zoom i pan
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!onViewportChange) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey) {
        // Zoom
        const rect = overlayRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
        const newViewport = zoomViewport(
          viewport,
          e.deltaY,
          e.clientX - rect.left,
          e.clientY - rect.top,
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

  const handleExpressionChange = (value: string) => {
    setExpression(value);
    setError(null);
  };

  // Generuj funkcję
  const handleGenerate = useCallback(() => {
    const validationError = validateExpression(expression);
    setError(validationError);
    if (validationError) return;

    const newFunction: FunctionPlot = {
      id: Date.now().toString(),
      type: 'function',
      expression: expression.trim(),
      color,
      strokeWidth: lineWidth,
      xRange,
      yRange,
      strokeDasharray: lineStyle === 'dashed' ? '5 5' : undefined,
    };

    onFunctionCreate(newFunction);
    setExpression(''); // Reset po dodaniu
    setError(null);
  }, [expression, color, lineWidth, xRange, yRange, onFunctionCreate]);

  // Renderuj live preview funkcji
  const renderPreview = () => {
    if (!expression.trim()) return null;

    try {
      const points = sampleFunctionPoints({ expression, xRange, yRange });
      const screenPoints = projectPointsToScreen(points, viewport, canvasWidth, canvasHeight);
      const pathData = buildSvgPath(screenPoints);
      if (!pathData) return null;

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
            strokeDasharray={lineStyle === 'dashed' ? '5 5' : undefined}
            fill="none"
            opacity={0.5}
          />
        </svg>
      );
    } catch {
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

      {/* Input Panel - kompaktowy styl jak w PenTool, wyżej przy toolbarze */}
      <div className="absolute top-84 left-20 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 pointer-events-auto">
        {/* Input wyrażenia */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Funkcja matematyczna
          </label>
          <input
            ref={inputRef}
            type="text"
            value={expression}
            onChange={(e) => handleExpressionChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleGenerate();
              }
            }}
            placeholder="np. sin(x), x^2"
            className={`w-full text-black px-3 py-2 border rounded-md font-mono text-sm focus:outline-none transition-colors ${
              error
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-300 focus:border-blue-500'
            }`}
          />
          {error && <p className="text-xs text-red-600 mt-1.5">⚠️ {error}</p>}
        </div>

        {/* Separator */}
        <div className="w-full h-px bg-gray-200 my-3" />

        {/* Grid układ: 3 slidery + kontrolki po prawej */}
        <div className="grid grid-cols-[auto_auto_auto_1fr] gap-4 items-start mb-3">
          {/* Slider X */}
          <div className="flex flex-col items-center">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              X: ±{xRange}
            </label>
            <div className="relative h-28 w-8 flex items-center justify-center">
              <div className="absolute w-2 h-full bg-blue-100 rounded-full" />
              <input
                type="range"
                min="10"
                max="100"
                value={xRange}
                onChange={(e) => setXRange(Number(e.target.value))}
                className={VERTICAL_SLIDER_CLASS}
                style={VERTICAL_SLIDER_STYLE}
              />
            </div>
          </div>

          {/* Slider Y */}
          <div className="flex flex-col items-center">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Y: ±{yRange}
            </label>
            <div className="relative h-28 w-8 flex items-center justify-center">
              <div className="absolute w-2 h-full bg-blue-100 rounded-full" />
              <input
                type="range"
                min="10"
                max="100"
                value={yRange}
                onChange={(e) => setYRange(Number(e.target.value))}
                className={VERTICAL_SLIDER_CLASS}
                style={VERTICAL_SLIDER_STYLE}
              />
            </div>
          </div>

          {/* Slider grubości z preview */}
          <div className="flex flex-col items-center">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {lineWidth}px
            </label>
            <div className="relative h-28 w-8 flex items-center justify-center">
              <div className="absolute w-2 h-full bg-blue-100 rounded-full" />
              <input
                type="range"
                min="1"
                max="8"
                value={lineWidth}
                onChange={(e) => onLineWidthChange(Number(e.target.value))}
                className={VERTICAL_SLIDER_CLASS}
                style={VERTICAL_SLIDER_STYLE}
              />
            </div>
            <div className="w-7 h-7 border border-gray-300 rounded-full flex items-center justify-center mt-2">
              <div
                className="rounded-full"
                style={{
                  width: `${Math.min(lineWidth * 2.5, 22)}px`,
                  height: `${Math.min(lineWidth * 2.5, 22)}px`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>

          {/* Kontrolki po prawej - w centrum */}
          <div className="flex flex-col items-center justify-center gap-3 pl-2">
            {/* Kolor - kółko z hidden input */}
            <div className="relative">
              <div
                onClick={() => colorInputRef.current?.click()}
                className="mt-9 w-9 h-9 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-all cursor-pointer shadow-sm"
                style={{ backgroundColor: color }}
                title="Wybierz kolor"
              />
              <input
                ref={colorInputRef}
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
                className="absolute opacity-0 pointer-events-none"
              />
            </div>

            {/* Separator pionowy (opcjonalny wizualny element) */}
            <div className="w-full h-px bg-gray-200" />

            {/* Styl linii - buttony */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setLineStyle('solid')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  lineStyle === 'solid'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Linia ciągła"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
              <button
                onClick={() => setLineStyle('dashed')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  lineStyle === 'dashed'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Linia przerywana"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <line
                    x1="2"
                    y1="10"
                    x2="18"
                    y2="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="w-full h-px bg-gray-200 my-3" />

        {/* Przyciski - kompaktowe */}
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={!expression.trim()}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium cursor-pointer shadow-sm"
          >
            Dodaj funkcję
          </button>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="w-10 h-10 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors flex items-center justify-center font-bold text-base cursor-pointer"
            title="Pomoc"
          >
            ?
          </button>
        </div>
      </div>

      {/* Live Preview */}
      {expression.trim() && !error && renderPreview()}

      {/* Modal pomocy */}
      {isHelpOpen && (
        <FunctionHelpModal
          expression={expression}
          error={error}
          xRange={xRange}
          yRange={yRange}
          color={color}
          lineWidth={lineWidth}
          onExpressionChange={handleExpressionChange}
          onXRangeChange={setXRange}
          onYRangeChange={setYRange}
          onColorChange={onColorChange}
          onLineWidthChange={onLineWidthChange}
          onGenerate={handleGenerate}
          onClose={() => setIsHelpOpen(false)}
        />
      )}
    </div>
  );
}
