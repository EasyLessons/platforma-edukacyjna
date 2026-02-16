/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/ToolbarUI.tsx
 * ============================================================================
 *
 * IMPORTUJE Z:
 * - react
 * - lucide-react (ikony)
 * - ./Toolbar (Tool, ShapeType)
 *
 * EKSPORTUJE:
 * - ToolbarUI (component) - UI toolbara z narzędziami i ustawieniami
 *
 * UŻYWANE PRZEZ:
 * - Toolbar.tsx (kontener logiki)
 *
 * ⚠️ ZALEŻNOŚCI:
 * - Toolbar.tsx - musi dostarczyć Tool i ShapeType
 * - Zmiana Tool/ShapeType wymaga synchronizacji z Toolbar.tsx
 *
 * PRZEZNACZENIE:
 * Prezentacja UI toolbara - przyciski narzędzi, kolory, grubość linii,
 * rozmiar czcionki, undo/redo, clear. Responsywny (mobile + desktop).
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MousePointer2,
  Hand,
  Pencil,
  Type,
  Square,
  Circle,
  Triangle,
  Minus,
  ArrowRight,
  Undo,
  Redo,
  Trash2,
  TrendingUp,
  Menu,
  X,
  Image as ImageIcon,
  Upload,
  Clipboard as ClipboardIcon,
  Eraser,
  X as XIcon,
  Download,
  FolderOpen,
  Hexagon,
  StickyNote,
  Table,
  Calculator,
  MessageCircle,
  FileText,
  MoreVertical,
  Highlighter,
} from 'lucide-react';
import { Tool, ShapeType } from './Toolbar';

interface ToolbarUIProps {
  // Tool state
  tool: Tool;
  selectedShape: ShapeType;
  polygonSides: number;

  // Properties state
  color: string;
  lineWidth: number;
  fontSize: number;
  fillShape: boolean;

  // 🆕 Kalkulator state
  isCalculatorOpen?: boolean;
  onCalculatorToggle?: () => void;

  // History state
  canUndo: boolean;
  canRedo: boolean;

  // Selection state
  hasSelection?: boolean;

  // 🔒 Read-only mode
  isReadOnly?: boolean;

  // Handlers
  onToolChange: (tool: Tool) => void;
  onShapeChange: (shape: ShapeType) => void;
  onPolygonSidesChange: (sides: number) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onFontSizeChange: (size: number) => void;
  onFillShapeChange: (fill: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDeleteSelected?: () => void;

  // Export/Import handlers
  onExport?: () => void;
  onImport?: () => void;

  // 🖼️ ImageTool handlers
  onImagePaste?: () => void;
  onImageUpload?: () => void;
  // 📄 PDFTool handlers
  onPDFUpload?: () => void;
}

const ToolButton = ({
  icon: Icon,
  active,
  onClick,
  title,
  disabled = false,
  filled = false,
  fillOpacity,
}: {
  icon: React.ComponentType<{ className?: string; fill?: string; fillOpacity?: number }>;
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  filled?: boolean;
  fillOpacity?: number;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      relative p-1.5 rounded-md transition-colors group
      ${active 
        ? 'bg-blue-500/20 text-blue-600' 
        : 'text-gray-700 hover:bg-gray-100'
      }
      ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <Icon 
      className="w-5 h-5" 
      {...(() => {
        if (filled) {
          return { fill: 'currentColor', fillOpacity };
        }
        if (active) {
          return { 
            fill: 'rgb(37 99 235 / 0.1)',
            stroke: 'currentColor' 
          };
        }
        return {};
      })()} 
    />
    <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
      {title}
    </span>
  </button>
);

const Divider = () => <div className="h-px w-6 bg-gray-200 my-1" />;

export function ToolbarUI({
  tool,
  selectedShape,
  polygonSides,
  color,
  lineWidth,
  fontSize,
  fillShape,
  canUndo,
  canRedo,
  hasSelection,
  onToolChange,
  onShapeChange,
  onPolygonSidesChange,
  onColorChange,
  onLineWidthChange,
  onFontSizeChange,
  onFillShapeChange,
  onUndo,
  onRedo,
  onClear,
  onDeleteSelected,
  onExport,
  onImport,
  onImagePaste,
  onImageUpload,
  onPDFUpload,
  isCalculatorOpen,
  onCalculatorToggle,
  isReadOnly = false,
}: ToolbarUIProps) {
  // 🆕 Wykrywanie wysokości ekranu
  const [viewportHeight, setViewportHeight] = useState(0);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  
  // 🆕 Tryb pędzla: 'pen' | 'highlighter'
  const [penMode, setPenMode] = useState<'pen' | 'highlighter'>('pen');
  const [penColors, setPenColors] = useState([
  '#1c222b',  // Ciemnoszary - główne pisanie
  '#e12f2f',  // Czerwony - ważne/błędy
  '#04ba80'   // Ciemnozielony (green-600) - pomocnicze notatki
]);
  const [highlighterColors, setHighlighterColors] = useState(['#EF4444', '#22C55E', '#FFFF00']);
  
  // 🆕 Refs dla color picker inputs
  const penBlackInputRef = useRef<HTMLInputElement>(null);
  const penCreamInputRef = useRef<HTMLInputElement>(null);
  const penPinkInputRef = useRef<HTMLInputElement>(null);
  const highlighterRedInputRef = useRef<HTMLInputElement>(null);
  const highlighterGreenInputRef = useRef<HTMLInputElement>(null);
  const highlighterYellowInputRef = useRef<HTMLInputElement>(null);

  // Debug isReadOnly
  useEffect(() => {
    console.log('🛠️ ToolbarUI - isReadOnly:', isReadOnly, '| tool:', tool);
  }, [isReadOnly, tool]);

  useEffect(() => {
    const updateHeight = () => setViewportHeight(window.innerHeight);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Określenie layoutu na podstawie wysokości
  // Full: >= 815px - wszystko widoczne
  // Medium: < 815px - ukryj markdown, table, import, export do menu "więcej"
  // Mobile: < 768px (md breakpoint) - pełny modal
  const isMediumHeight = viewportHeight < 815 && viewportHeight >= 768;
  const isMobile = viewportHeight < 768;

  const getShapeIcon = () => {
    switch (selectedShape) {
      case 'circle':
        return Circle;
      case 'triangle':
        return Triangle;
      case 'line':
        return Minus;
      case 'arrow':
        return ArrowRight;
      case 'polygon':
        return Hexagon;
      default:
        return Square;
    }
  };

  // 🆕 Narzędzia z własnymi panelami nie wyświetlają properties
  // - select, pan: brak properties
  // - text: ma własny mini toolbar przy zaznaczeniu
  // - function: ma własny panel input
  // - eraser: brak właściwości do edycji
  const hasProperties = tool === 'pen' || tool === 'shape' || tool === 'image';

  return (
    <>
      {/* GŁÓWNY TOOLBAR - PIONOWY (desktop + mobile) */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 pointer-events-auto">
        <div className="flex flex-col items-center gap-1.5 p-2">
          {/* Main Tools */}
          {!isReadOnly && (
            <ToolButton
              icon={MousePointer2}
              active={tool === 'select'}
              onClick={() => onToolChange('select')}
              title="Zaznacz (V)"
              filled={true}
              fillOpacity={1}
            />
          )}
          <ToolButton
            icon={Hand}
            active={tool === 'pan'}
            onClick={() => onToolChange('pan')}
            title="Przesuwaj (H)"
          />
          <ToolButton
            icon={Pencil}
            active={tool === 'pen'}
            onClick={() => onToolChange('pen')}
            title="Rysuj (P)"
            disabled={isReadOnly}
            filled={true}
            fillOpacity={0.3}
          />
          <ToolButton
            icon={Type}
            active={tool === 'text'}
            onClick={() => onToolChange('text')}
            title="Tekst (T)"
            disabled={isReadOnly}
          />
          <ToolButton
            icon={getShapeIcon()}
            active={tool === 'shape'}
            onClick={() => onToolChange('shape')}
            title="Kształty (S)"
            disabled={isReadOnly}
          />
          <ToolButton
            icon={TrendingUp}
            active={tool === 'function'}
            onClick={() => onToolChange('function')}
            title="Funkcja (F)"
            disabled={isReadOnly}
          />
          <ToolButton
            icon={ImageIcon}
            active={tool === 'image'}
            onClick={() => onToolChange('image')}
            title="Obraz (I)"
            disabled={isReadOnly}
          />
          {/* PDF tool tymczasowo wyłączony  */}
          {/* <ToolButton
            icon={FileText}
            active={tool === 'pdf'}
            onClick={() => onToolChange('pdf')}
            title="PDF (Shift+P)"
          /> */}
          <ToolButton
            icon={Eraser}
            active={tool === 'eraser'}
            onClick={() => onToolChange('eraser')}
            title="Gumka (E)"
            disabled={isReadOnly}
          />

          <Divider />

          {/* Nowe narzędzia - UKRYTE w medium height */}
          {!isMediumHeight && !isMobile && (
            <>
              <ToolButton
                icon={StickyNote}
                active={tool === 'markdown'}
                onClick={() => onToolChange('markdown')}
                title="Notatka Markdown (M)"
                disabled={isReadOnly}
              />
              <ToolButton
                icon={Table}
                active={tool === 'table'}
                onClick={() => onToolChange('table')}
                title="Tabelka"
                disabled={isReadOnly}
              />
            </>
          )}

          <ToolButton
            icon={Calculator}
            active={isCalculatorOpen ?? false}
            onClick={() => onCalculatorToggle?.()}
            title="Kalkulator (zawsze dostępny)"
          />

          <Divider />

          {/* History */}
          <ToolButton
            icon={Undo}
            active={false}
            onClick={onUndo}
            title="Cofnij (Ctrl+Z)"
            disabled={!canUndo || isReadOnly}
          />
          <ToolButton
            icon={Redo}
            active={false}
            onClick={onRedo}
            title="Ponów (Ctrl+Y)"
            disabled={!canRedo || isReadOnly}
          />

          {/* Export/Import - UKRYTE w medium height */}
          {!isMediumHeight && !isMobile && (
            <>
              <Divider />
              {onExport && (
                <ToolButton
                  icon={Download}
                  active={false}
                  onClick={onExport}
                  title="Eksportuj tablicę"
                  disabled={isReadOnly}
                />
              )}
              {onImport && (
                <ToolButton
                  icon={FolderOpen}
                  active={false}
                  onClick={onImport}
                  title="Importuj tablicę"
                  disabled={isReadOnly}
                />
              )}
            </>
          )}

          {/* 🆕 Przycisk "Więcej" - WIDOCZNY w medium height i mobile */}
          {(isMediumHeight || isMobile) && (
            <>
              <Divider />
              <ToolButton
                icon={MoreVertical}
                active={isMoreMenuOpen}
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="Więcej narzędzi"
                disabled={isReadOnly}
              />
            </>
          )}

          <Divider />

          {/* Delete Selected - widoczne gdy coś zaznaczone */}
          {hasSelection && onDeleteSelected && (
            <ToolButton
              icon={XIcon}
              active={false}
              onClick={onDeleteSelected}
              title="Usuń zaznaczone (Del)"
              disabled={isReadOnly}
            />
          )}

          {/* Clear */}
          <ToolButton
            icon={Trash2}
            active={false}
            onClick={onClear}
            title="Wyczyść wszystko"
            disabled={isReadOnly}
          />
        </div>
      </div>

      {/* 🆕 MEDIUM HEIGHT + MOBILE: "Więcej" Menu */}
      {(isMediumHeight || isMobile) && isMoreMenuOpen && (
        <div className="fixed left-20 top-1/2 -translate-y-1/2 bg-white rounded-xl shadow-lg border border-gray-200 pointer-events-auto z-50">
          <div className="flex flex-col items-center gap-1.5 p-2">
            <div className="text-xs font-semibold text-gray-600 px-2 py-1">Więcej</div>
            <Divider />

            <ToolButton
              icon={StickyNote}
              active={tool === 'markdown'}
              onClick={() => {
                onToolChange('markdown');
                setIsMoreMenuOpen(false);
              }}
              title="Notatka Markdown (M)"
              disabled={isReadOnly}
            />
            <ToolButton
              icon={Table}
              active={tool === 'table'}
              onClick={() => {
                onToolChange('table');
                setIsMoreMenuOpen(false);
              }}
              title="Tabelka"
              disabled={isReadOnly}
            />

            <Divider />

            {onExport && (
              <ToolButton
                icon={Download}
                active={false}
                onClick={() => {
                  onExport();
                  setIsMoreMenuOpen(false);
                }}
                title="Eksportuj tablicę"
                disabled={isReadOnly}
              />
            )}
            {onImport && (
              <ToolButton
                icon={FolderOpen}
                active={false}
                onClick={() => {
                  onImport();
                  setIsMoreMenuOpen(false);
                }}
                title="Importuj tablicę"
                disabled={isReadOnly}
              />
            )}
          </div>
        </div>
      )}

      {/* PROPERTIES PANEL - tylko desktop i tylko gdy hasProperties - osobny blok obok toolbara */}
      {hasProperties && (
        <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-200 p-2 pointer-events-auto">
          <div className="flex flex-col items-center gap-2">
            {/* PEN */}
            {tool === 'pen' && (
              <>
                {/* Wybór trybu: Pen / Highlighter */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setPenMode('pen');
                      onLineWidthChange(4);
                      onColorChange(penColors[0]);
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
                      onLineWidthChange(70);
                      onColorChange(highlighterColors[2]);
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
                              onColorChange(penColors[0]);
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
                            onColorChange(next);
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
                              onColorChange(penColors[1]);
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
                            onColorChange(next);
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
                              onColorChange(penColors[2]);
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
                            onColorChange(next);
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
                              onColorChange(highlighterColors[0]);
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
                            onColorChange(next);
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
                              onColorChange(highlighterColors[1]);
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
                            onColorChange(next);
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
                              onColorChange(highlighterColors[2]);
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
                            onColorChange(next);
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
                        onChange={(e) => onLineWidthChange(Number(e.target.value))}
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
                    <span className="text-[10px] text-gray-600 font-semibold">
                      {lineWidth}px
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* SHAPE */}
            {tool === 'shape' && (
              <>
                {/* Wybór kształtu - pionowo */}
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => onShapeChange('rectangle')}
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
                    onClick={() => onShapeChange('circle')}
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
                    onClick={() => onShapeChange('triangle')}
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
                    onClick={() => onShapeChange('polygon')}
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
                    onClick={() => onShapeChange('line')}
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
                    onClick={() => onShapeChange('arrow')}
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
                          onPolygonSidesChange(Math.max(3, Math.min(20, Number(e.target.value))))
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
                      input.onchange = (e) => onColorChange((e.target as HTMLInputElement).value);
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
                      onChange={(e) => onLineWidthChange(Number(e.target.value))}
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
                    <span className="text-[10px] text-gray-600 font-semibold">
                      {lineWidth}px
                    </span>
                  </div>
                </div>

                {/* Separator */}
                <div className="w-6 h-px bg-gray-200 my-1" />

                {selectedShape !== 'line' && selectedShape !== 'arrow' && (
                  <button
                    onClick={() => onFillShapeChange(!fillShape)}
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
            )}

            {/* TEXT */}
            {/* 🔴 TEXT - properties panel usunięty, TextTool ma własny mini toolbar */}

            {/* 🔴 FUNCTION - usunięte z toolbara, FunctionTool ma własny panel */}

            {/* 🖼️ IMAGE */}
            {tool === 'image' && (
              <>
                {/* Wklej obraz ze schowka */}
                <button
                  onClick={onImagePaste}
                  className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-gray-100"
                  title="Wklej obraz ze schowka (Ctrl+V)"
                >
                  <ClipboardIcon className="w-5 h-5" />
                </button>

                {/* Separator */}
                <div className="w-6 h-px bg-gray-200 my-1" />

                {/* Upload obraz */}
                <button
                  onClick={onImageUpload}
                  className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-gray-100"
                  title="Wybierz plik obrazu z dysku"
                >
                  <Upload className="w-5 h-5" />
                </button>

                {/* Separator */}
                <div className="w-6 h-px bg-gray-200 my-1" />

                {/* Upload PDF */}
                <button
                  onClick={onPDFUpload}
                  className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-gray-100"
                  title="Wybierz plik PDF z dysku"
                >
                  <FileText className="w-5 h-5" />
                </button>
              </>
            )}

            {/* 📄 PDF - usunięte, przyciski przeniesione do Image tool */}
          </div>
        </div>
      )}
    </>
  );
}
