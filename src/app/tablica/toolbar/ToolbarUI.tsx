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

import React from 'react';
import {
  MousePointer2, Hand, PenTool, Type, Square, Circle, Triangle,
  Minus, ArrowRight, Undo, Redo, Trash2, TrendingUp, Menu, X, Image as ImageIcon,
  Upload, Clipboard as ClipboardIcon
} from 'lucide-react';
import { Tool, ShapeType } from './Toolbar';

interface ToolbarUIProps {
  // Tool state
  tool: Tool;
  selectedShape: ShapeType;
  
  // Properties state
  color: string;
  lineWidth: number;
  fontSize: number;
  fillShape: boolean;
  
  // History state
  canUndo: boolean;
  canRedo: boolean;
  
  // Handlers
  onToolChange: (tool: Tool) => void;
  onShapeChange: (shape: ShapeType) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onFontSizeChange: (size: number) => void;
  onFillShapeChange: (fill: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  
  // Mobile state
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  
  // 🖼️ ImageTool handlers
  onImagePaste?: () => void;
  onImageUpload?: () => void;
}

const ToolButton = ({
  icon: Icon,
  active,
  onClick,
  title,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      relative p-2.5 rounded-lg transition-colors group
      ${active ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'}
      ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <Icon className="w-6 h-6" />
    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
      {title}
    </span>
  </button>
);

const Divider = () => <div className="w-px h-7 bg-gray-200 mx-1.5" />;

export function ToolbarUI({
  tool,
  selectedShape,
  color,
  lineWidth,
  fontSize,
  fillShape,
  canUndo,
  canRedo,
  onToolChange,
  onShapeChange,
  onColorChange,
  onLineWidthChange,
  onFontSizeChange,
  onFillShapeChange,
  onUndo,
  onRedo,
  onClear,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  onImagePaste,
  onImageUpload,
}: ToolbarUIProps) {
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
      default:
        return Square;
    }
  };

  // 🆕 Narzędzia z własnymi panelami nie wyświetlają properties
  // - select, pan: brak properties
  // - text: ma własny mini toolbar przy zaznaczeniu
  // - function: ma własny panel input
  const hasProperties = tool === 'pen' || tool === 'shape' || tool === 'image';

  return (
    <>
      {/* MOBILE: Hamburger Menu Button */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
          title="Menu narzędzi"
        >
          <Menu className="w-7 h-7 text-gray-700" />
        </button>
      </div>

      {/* DESKTOP: GŁÓWNY TOOLBAR */}
      <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="flex items-center gap-1.5 p-2">{/* Main Tools */}
          {/* Main Tools */}
          <ToolButton
            icon={MousePointer2}
            active={tool === 'select'}
            onClick={() => onToolChange('select')}
            title="Zaznacz (V)"
          />
          <ToolButton
            icon={Hand}
            active={tool === 'pan'}
            onClick={() => onToolChange('pan')}
            title="Przesuwaj (H)"
          />
          <ToolButton
            icon={PenTool}
            active={tool === 'pen'}
            onClick={() => onToolChange('pen')}
            title="Rysuj (P)"
          />
          <ToolButton
            icon={Type}
            active={tool === 'text'}
            onClick={() => onToolChange('text')}
            title="Tekst (T)"
          />
          <ToolButton
            icon={getShapeIcon()}
            active={tool === 'shape'}
            onClick={() => onToolChange('shape')}
            title="Kształty (S)"
          />
          <ToolButton
            icon={TrendingUp}
            active={tool === 'function'}
            onClick={() => onToolChange('function')}
            title="Funkcja (F)"
          />
          <ToolButton
            icon={ImageIcon}
            active={tool === 'image'}
            onClick={() => onToolChange('image')}
            title="Obraz (I)"
          />

          <Divider />

          {/* History */}
          <ToolButton icon={Undo} active={false} onClick={onUndo} title="Cofnij (Ctrl+Z)" disabled={!canUndo} />
          <ToolButton icon={Redo} active={false} onClick={onRedo} title="Ponów (Ctrl+Y)" disabled={!canRedo} />

          <Divider />

          {/* Clear */}
          <ToolButton icon={Trash2} active={false} onClick={onClear} title="Wyczyść wszystko" />
        </div>
      </div>

      {/* MOBILE: Full Screen Modal */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-[90vw] max-w-md max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
              <h3 className="text-sm font-semibold text-gray-800">Narzędzia</h3>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-gray-100 rounded transition-colors">
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Tools Grid */}
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    onToolChange('select');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <MousePointer2 className="w-5 h-5" />
                  <span className="text-xs font-medium">Zaznacz</span>
                </button>

                <button
                  onClick={() => {
                    onToolChange('pan');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'pan' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Hand className="w-5 h-5" />
                  <span className="text-xs font-medium">Przesuwaj</span>
                </button>

                <button
                  onClick={() => {
                    onToolChange('pen');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <PenTool className="w-5 h-5" />
                  <span className="text-xs font-medium">Rysuj</span>
                </button>

                <button
                  onClick={() => {
                    onToolChange('text');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'text' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Type className="w-5 h-5" />
                  <span className="text-xs font-medium">Tekst</span>
                </button>

                <button
                  onClick={() => {
                    onToolChange('shape');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'shape' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Square className="w-5 h-5" />
                  <span className="text-xs font-medium">Kształty</span>
                </button>

                <button
                  onClick={() => {
                    onToolChange('function');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'function' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-xs font-medium">Funkcja</span>
                </button>

                <button
                  onClick={() => {
                    onToolChange('image');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'image' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-xs font-medium">Obraz</span>
                </button>
              </div>

              {/* Shape Selection */}
              {tool === 'shape' && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Wybierz kształt:</p>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => onShapeChange('rectangle')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'rectangle' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Square className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onShapeChange('circle')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'circle' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Circle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onShapeChange('triangle')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'triangle' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Triangle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onShapeChange('line')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'line' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onShapeChange('arrow')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'arrow' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 border-t border-gray-200 space-y-2">
                <button
                  onClick={() => {
                    onUndo();
                    setIsMobileMenuOpen(false);
                  }}
                  disabled={!canUndo}
                  className="w-full p-2 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                >
                  <Undo className="w-4 h-4" />
                  <span className="text-sm font-medium">Cofnij</span>
                </button>

                <button
                  onClick={() => {
                    onRedo();
                    setIsMobileMenuOpen(false);
                  }}
                  disabled={!canRedo}
                  className="w-full p-2 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                >
                  <Redo className="w-4 h-4" />
                  <span className="text-sm font-medium">Ponów</span>
                </button>

                <button
                  onClick={() => {
                    onClear();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-2 justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Wyczyść wszystko</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROPERTIES PANEL - tylko desktop i tylko gdy hasProperties */}
      {hasProperties && (
        <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-200 p-3 max-w-xl">
          <div className="flex flex-wrap items-center gap-4">
            {/* PEN */}
            {tool === 'pen' && (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-600">Kolor:</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => onColorChange(e.target.value)}
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-3 min-w-[180px]">
                  <label className="text-sm font-medium text-gray-600">Grubość:</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={lineWidth}
                    onChange={(e) => onLineWidthChange(Number(e.target.value))}
                    className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-sm text-gray-700 font-semibold w-10 text-right">{lineWidth}px</span>
                </div>
              </>
            )}

            {/* SHAPE */}
            {tool === 'shape' && (
              <>
                {/* Wybór kształtu */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-600">Kształt:</label>
                  <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1.5">
                    <button
                      onClick={() => onShapeChange('rectangle')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'rectangle' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Prostokąt"
                    >
                      <Square className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onShapeChange('circle')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'circle' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Koło"
                    >
                      <Circle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onShapeChange('triangle')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'triangle' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Trójkąt"
                    >
                      <Triangle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onShapeChange('line')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'line' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Linia"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onShapeChange('arrow')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'arrow' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Strzałka"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-600">Kolor:</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => onColorChange(e.target.value)}
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3 min-w-[180px]">
                  <label className="text-sm font-medium text-gray-600">Grubość:</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={lineWidth}
                    onChange={(e) => onLineWidthChange(Number(e.target.value))}
                    className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-sm text-gray-700 font-semibold w-10 text-right">{lineWidth}px</span>
                </div>
                {selectedShape !== 'line' && selectedShape !== 'arrow' && (
                  <button
                    onClick={() => onFillShapeChange(!fillShape)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      fillShape ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {fillShape ? 'Wypełniony' : 'Kontur'}
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
                <button
                  onClick={onImagePaste}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  title="Wklej obraz ze schowka (Ctrl+V)"
                >
                  <ClipboardIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Wklej</span>
                </button>

                <button
                  onClick={onImageUpload}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  title="Wybierz plik z dysku"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">Upload</span>
                </button>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ImageIcon className="w-5 h-5" />
                  <span>Ctrl+V lub przeciągnij obraz</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
