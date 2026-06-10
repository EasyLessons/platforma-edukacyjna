/**
 * tools/shape.properties.tsx — Panel właściwości narzędzia Kształty.
 *
 * Renderowany w toolbarze (poza ToolHostProvider) → korzysta WYŁĄCZNIE z
 * useToolStore. Treść 1:1 z dawnego panelu w toolbar-ui.tsx
 * (callbacki onXChange → settery store).
 */

'use client';

import { Square, Circle, Triangle, Hexagon, Minus, ArrowRight } from 'lucide-react';
import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';

export function ShapeProperties() {
  const color = useToolStore((s) => s.color);
  const lineWidth = useToolStore((s) => s.lineWidth);
  const fillShape = useToolStore((s) => s.fillShape);
  const selectedShape = useToolStore((s) => s.selectedShape);
  const polygonSides = useToolStore((s) => s.polygonSides);
  const setColor = useToolStore((s) => s.setColor);
  const setLineWidth = useToolStore((s) => s.setLineWidth);
  const setFillShape = useToolStore((s) => s.setFillShape);
  const setSelectedShape = useToolStore((s) => s.setSelectedShape);
  const setPolygonSides = useToolStore((s) => s.setPolygonSides);

  return (
    <>
      {/* Wybór kształtu - pionowo */}
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => setSelectedShape('rectangle')}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            selectedShape === 'rectangle'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Prostokąt"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSelectedShape('circle')}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            selectedShape === 'circle'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Koło"
        >
          <Circle className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSelectedShape('triangle')}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            selectedShape === 'triangle'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Trójkąt"
        >
          <Triangle className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSelectedShape('polygon')}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            selectedShape === 'polygon'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title={`Wielokąt (${polygonSides} boków)`}
        >
          <Hexagon className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSelectedShape('line')}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            selectedShape === 'line'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Linia"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSelectedShape('arrow')}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            selectedShape === 'arrow'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Strzałka"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-6 h-px bg-gray-200 my-1" />

      {/* Input na liczbę boków wielokąta */}
      {selectedShape === 'polygon' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Boki
            </label>
            <input
              type="number"
              min="3"
              max="20"
              value={polygonSides}
              onChange={(e) =>
                setPolygonSides(Math.max(3, Math.min(20, Number(e.target.value))))
              }
              className="w-14 px-2 py-1 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {/* Separator */}
          <div className="w-6 h-px bg-gray-200 my-1" />
        </>
      )}

      {/* Color picker */}
      <div className="relative">
        <div
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'color';
            input.value = color;
            input.onchange = (e) => setColor((e.target as HTMLInputElement).value);
            input.click();
          }}
          className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-all cursor-pointer"
          style={{ backgroundColor: color }}
          title="Kolor"
        />
      </div>

      {/* Separator */}
      <div className="w-6 h-px bg-blue-200 my-1" />

      {/* Pionowy slider grubości */}
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="relative h-32 w-8 flex items-center justify-center">
          {/* Tło slider */}
          <div className="absolute w-2 h-full bg-blue-100 rounded-full" />

          {/* Slider input */}
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="hover:cursor-pointer
                      absolute h-32 w-2 appearance-none bg-transparent cursor-default accent-blue-500
                      [&::-webkit-slider-thumb]:opacity-100
                      [&::-webkit-slider-thumb:active]:opacity-100
                      [&::-moz-range-thumb]:opacity-100
                      [&::-moz-range-thumb:active]:opacity-100
                      hover:opacity-100"
            style={{
              writingMode: 'bt-lr' as any,
              WebkitAppearance: 'slider-vertical',
            }}
          />
        </div>

        {/* Preview aktualnej grubości */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center">
            <div
              className="rounded-full"
              style={{
                width: `${Math.min(lineWidth, 28)}px`,
                height: `${Math.min(lineWidth, 28)}px`,
                backgroundColor: color,
              }}
            />
          </div>
          <span className="text-[10px] text-gray-600 font-semibold">{lineWidth}px</span>
        </div>
      </div>

      {/* Separator */}
      <div className="w-6 h-px bg-gray-200 my-1" />

      {selectedShape !== 'line' && selectedShape !== 'arrow' && (
        <button
          onClick={() => setFillShape(!fillShape)}
          className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            fillShape
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
          }`}
        >
          {fillShape ? '◼' : '◻'}
        </button>
      )}
    </>
  );
}
