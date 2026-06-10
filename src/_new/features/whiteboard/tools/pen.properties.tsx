/**
 * tools/pen.properties.tsx — Panel właściwości narzędzia Pióro/Zakreślacz.
 *
 * Renderowany w toolbarze (poza ToolHostProvider) → korzysta WYŁĄCZNIE z
 * useToolStore (color/lineWidth) + własnego stanu lokalnego (tryb + palety).
 * Treść 1:1 z dawnego panelu w toolbar-ui.tsx (callbacki onXChange → settery store).
 */

'use client';

import { useState, useRef } from 'react';
import { Pencil, Highlighter } from 'lucide-react';
import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';

export function PenProperties() {
  const color = useToolStore((s) => s.color);
  const lineWidth = useToolStore((s) => s.lineWidth);
  const setColor = useToolStore((s) => s.setColor);
  const setLineWidth = useToolStore((s) => s.setLineWidth);

  const [penMode, setPenMode] = useState<'pen' | 'highlighter'>('pen');
  const [penColors, setPenColors] = useState([
    '#1c222b', // Ciemnoszary - główne pisanie
    '#e12f2f', // Czerwony - ważne/błędy
    '#04ba80', // Ciemnozielony (green-600) - pomocnicze notatki
  ]);
  const [highlighterColors, setHighlighterColors] = useState(['#EF4444', '#22C55E', '#FFFF00']);

  const penBlackInputRef = useRef<HTMLInputElement>(null);
  const penCreamInputRef = useRef<HTMLInputElement>(null);
  const penPinkInputRef = useRef<HTMLInputElement>(null);
  const highlighterRedInputRef = useRef<HTMLInputElement>(null);
  const highlighterGreenInputRef = useRef<HTMLInputElement>(null);
  const highlighterYellowInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Wybór trybu: Pen / Highlighter */}
      <div className="flex flex-col gap-1">
        <button
          onClick={() => {
            setPenMode('pen');
            setLineWidth(4);
            setColor(penColors[0]);
          }}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            penMode === 'pen'
              ? 'bg-blue-500/20 text-blue-600'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Pędzel"
        >
          <Pencil className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setPenMode('highlighter');
            setLineWidth(70);
            setColor(highlighterColors[2]);
          }}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            penMode === 'highlighter'
              ? 'bg-blue-500/20 text-blue-600'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Zakreślacz"
        >
          <Highlighter className="w-5 h-5" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-6 h-px bg-gray-200 my-1" />

      {/* Paleta kolorów */}
      <div className="flex flex-col gap-1.5">
        {penMode === 'pen' ? (
          // Kolory dla pędzla: czarny, kremowy, czerwony pastelowy
          <>
            <div className="relative">
              <div
                onClick={() => {
                  if (color.toUpperCase() === penColors[0].toUpperCase()) {
                    penBlackInputRef.current?.click();
                  } else {
                    setColor(penColors[0]);
                  }
                }}
                className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                  color.toUpperCase() === penColors[0].toUpperCase()
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: penColors[0] }}
                title="Czarny"
              />
              <input
                ref={penBlackInputRef}
                type="color"
                value={penColors[0]}
                onChange={(e) => {
                  const next = e.target.value;
                  setPenColors([next, penColors[1], penColors[2]]);
                  setColor(next);
                }}
                className="absolute opacity-0 pointer-events-none"
              />
            </div>
            <div className="relative">
              <div
                onClick={() => {
                  if (color.toUpperCase() === penColors[1].toUpperCase()) {
                    penCreamInputRef.current?.click();
                  } else {
                    setColor(penColors[1]);
                  }
                }}
                className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                  color.toUpperCase() === penColors[1].toUpperCase()
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: penColors[1] }}
                title="Kremowy"
              />
              <input
                ref={penCreamInputRef}
                type="color"
                value={penColors[1]}
                onChange={(e) => {
                  const next = e.target.value;
                  setPenColors([penColors[0], next, penColors[2]]);
                  setColor(next);
                }}
                className="absolute opacity-0 pointer-events-none"
              />
            </div>
            <div className="relative">
              <div
                onClick={() => {
                  if (color.toUpperCase() === penColors[2].toUpperCase()) {
                    penPinkInputRef.current?.click();
                  } else {
                    setColor(penColors[2]);
                  }
                }}
                className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                  color.toUpperCase() === penColors[2].toUpperCase()
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: penColors[2] }}
                title="Czerwony pastelowy"
              />
              <input
                ref={penPinkInputRef}
                type="color"
                value={penColors[2]}
                onChange={(e) => {
                  const next = e.target.value;
                  setPenColors([penColors[0], penColors[1], next]);
                  setColor(next);
                }}
                className="absolute opacity-0 pointer-events-none"
              />
            </div>
          </>
        ) : (
          // Kolory dla zakreślacza: czerwony, zielony, żółty
          <>
            <div className="relative">
              <div
                onClick={() => {
                  if (color.toUpperCase() === highlighterColors[0].toUpperCase()) {
                    highlighterRedInputRef.current?.click();
                  } else {
                    setColor(highlighterColors[0]);
                  }
                }}
                className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                  color.toUpperCase() === highlighterColors[0].toUpperCase()
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: highlighterColors[0], opacity: 0.4 }}
                title="Czerwony zakreślacz"
              />
              <input
                ref={highlighterRedInputRef}
                type="color"
                value={highlighterColors[0]}
                onChange={(e) => {
                  const next = e.target.value;
                  setHighlighterColors([next, highlighterColors[1], highlighterColors[2]]);
                  setColor(next);
                }}
                className="absolute opacity-0 pointer-events-none"
              />
            </div>
            <div className="relative">
              <div
                onClick={() => {
                  if (color.toUpperCase() === highlighterColors[1].toUpperCase()) {
                    highlighterGreenInputRef.current?.click();
                  } else {
                    setColor(highlighterColors[1]);
                  }
                }}
                className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                  color.toUpperCase() === highlighterColors[1].toUpperCase()
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: highlighterColors[1], opacity: 0.4 }}
                title="Zielony zakreślacz"
              />
              <input
                ref={highlighterGreenInputRef}
                type="color"
                value={highlighterColors[1]}
                onChange={(e) => {
                  const next = e.target.value;
                  setHighlighterColors([highlighterColors[0], next, highlighterColors[2]]);
                  setColor(next);
                }}
                className="absolute opacity-0 pointer-events-none"
              />
            </div>
            <div className="relative">
              <div
                onClick={() => {
                  if (color.toUpperCase() === highlighterColors[2].toUpperCase()) {
                    highlighterYellowInputRef.current?.click();
                  } else {
                    setColor(highlighterColors[2]);
                  }
                }}
                className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                  color.toUpperCase() === highlighterColors[2].toUpperCase()
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: highlighterColors[2], opacity: 0.4 }}
                title="Żółty zakreślacz"
              />
              <input
                ref={highlighterYellowInputRef}
                type="color"
                value={highlighterColors[2]}
                onChange={(e) => {
                  const next = e.target.value;
                  setHighlighterColors([highlighterColors[0], highlighterColors[1], next]);
                  setColor(next);
                }}
                className="absolute opacity-0 pointer-events-none"
              />
            </div>
          </>
        )}
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
            min={penMode === 'pen' ? 1 : 20}
            max={penMode === 'pen' ? 21 : 200}
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
                width: `${Math.min(lineWidth / (penMode === 'highlighter' ? 7 : 1), 28)}px`,
                height: `${Math.min(lineWidth / (penMode === 'highlighter' ? 7 : 1), 28)}px`,
                backgroundColor: color,
                opacity: penMode === 'highlighter' ? 0.4 : 1,
              }}
            />
          </div>
          <span className="text-[10px] text-gray-600 font-semibold">{lineWidth}px</span>
        </div>
      </div>
    </>
  );
}
