/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/Toolbar.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, memo)
 * - lucide-react (ikony narzędzi)
 * 
 * EKSPORTUJE:
 * - Tool (type) - typy narzędzi: select | pan | pen | text | shape | function
 * - ShapeType (type) - typy kształtów: rectangle | circle | triangle | line | arrow
 * - Toolbar (default, memoized) - komponent paska narzędzi
 * - ZoomControls (named, memoized) - kontrolki zoom/pan
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główny canvas tablicy)
 * 
 * PRZEZNACZENIE:
 * Pasek narzędzi (toolbar) i kontrolki zoom dla tablicy interaktywnej.
 * Obsługuje wybór narzędzi (zaznacz, rysuj, tekst, kształty, funkcje),
 * konfigurację właściwości (kolor, grubość, czcionka), historię (undo/redo),
 * oraz responsywność (desktop: poziomy pasek, mobile: modal z menu).
 * ============================================================================
 */

'use client';

import React, { useState, memo } from 'react';
import { 
  MousePointer2, Hand, PenTool, Type, Square, Circle, Triangle, 
  Minus, ArrowRight, Undo, Redo, ZoomIn, ZoomOut, 
  Trash2, Home, TrendingUp, ChevronDown, Menu, X
} from 'lucide-react';

export type Tool = 'select' | 'pan' | 'pen' | 'text' | 'shape' | 'function';
export type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow';

interface ToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  selectedShape: ShapeType;
  setSelectedShape: (shape: ShapeType) => void;
  color: string;
  setColor: (color: string) => void;
  lineWidth: number;
  setLineWidth: (width: number) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  fillShape: boolean;
  setFillShape: (fill: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onResetView: () => void;
  onGenerateFunction?: (expression: string) => void;
  canUndo: boolean;
  canRedo: boolean;
}

const ZoomControlsComponent = ({ 
  zoom, 
  onZoomIn, 
  onZoomOut,
  onResetView
}: { 
  zoom: number; 
  onZoomIn: () => void; 
  onZoomOut: () => void;
  onResetView: () => void;
}) => {
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 z-10 pointer-events-auto">
      <div className="flex items-center gap-1 p-1.5">
        <button
          onClick={onResetView}
          className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors border-r border-gray-200"
          title="Wróć do początku (Home)"
        >
          <Home className="w-4 h-4" />
        </button>
        
        <button
          onClick={onZoomOut}
          className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title="Oddal"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        
        <span className="text-xs font-medium text-gray-700 min-w-[45px] text-center px-1">
          {Math.round(zoom * 100)}%
        </span>
        
        <button
          onClick={onZoomIn}
          className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title="Przybliż"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const areZoomPropsEqual = (
  prevProps: { zoom: number; onZoomIn: () => void; onZoomOut: () => void; onResetView: () => void },
  nextProps: { zoom: number; onZoomIn: () => void; onZoomOut: () => void; onResetView: () => void }
) => {
  return prevProps.zoom === nextProps.zoom;
};

export const ZoomControls = memo(ZoomControlsComponent, areZoomPropsEqual);
ZoomControls.displayName = 'ZoomControls';

function Toolbar({
  tool,
  setTool,
  selectedShape,
  setSelectedShape,
  color,
  setColor,
  lineWidth,
  setLineWidth,
  fontSize,
  setFontSize,
  fillShape,
  setFillShape,
  onUndo,
  onRedo,
  onClear,
  onResetView,
  onGenerateFunction,
  canUndo,
  canRedo,
}: ToolbarProps) {
  const [functionExpression, setFunctionExpression] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState(false);

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
        relative p-1.5 rounded transition-colors group
        ${active 
          ? 'bg-blue-500 text-white' 
          : 'text-gray-700 hover:bg-gray-100'
        }
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Icon className="w-4 h-4" />
      <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {title}
      </span>
    </button>
  );

  const Divider = () => (
    <div className="w-px h-5 bg-gray-200 mx-1" />
  );

  const getShapeIcon = () => {
    switch(selectedShape) {
      case 'circle': return Circle;
      case 'triangle': return Triangle;
      case 'line': return Minus;
      case 'arrow': return ArrowRight;
      default: return Square;
    }
  };

  const hasProperties = tool !== 'select' && tool !== 'pan';

  return (
    <div className="absolute top-20 left-4 right-4 z-10 pointer-events-auto flex flex-col items-start gap-2">
      {/* MOBILE: Hamburger Menu Button */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 hover:bg-gray-50 transition-colors"
          title="Menu narzędzi"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
      </div>
      
      {/* DESKTOP: GŁÓWNY TOOLBAR */}
      <div className="hidden md:block bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="flex items-center gap-1 p-1">
          {/* Main Tools */}
          <ToolButton
            icon={MousePointer2}
            active={tool === 'select'}
            onClick={() => setTool('select')}
            title="Zaznacz (V)"
          />
          <ToolButton
            icon={Hand}
            active={tool === 'pan'}
            onClick={() => setTool('pan')}
            title="Przesuwaj (H)"
          />
          <ToolButton
            icon={PenTool}
            active={tool === 'pen'}
            onClick={() => setTool('pen')}
            title="Rysuj (P)"
          />
          <ToolButton
            icon={Type}
            active={tool === 'text'}
            onClick={() => setTool('text')}
            title="Tekst (T)"
          />
          
          {/* Shape dropdown */}
          <div className="relative">
            <button
              onClick={() => setTool('shape')}
              className={`
                relative p-1.5 rounded transition-colors group flex items-center gap-1
                ${tool === 'shape' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
              title="Kształty (S)"
            >
              {React.createElement(getShapeIcon(), { className: "w-4 h-4" })}
              <ChevronDown className="w-3 h-3" />
              <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Kształty (S)
              </span>
            </button>
            
            {tool === 'shape' && (
              <div className="absolute top-full mt-1 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex gap-1 z-50">
                <button
                  onClick={() => setSelectedShape('rectangle')}
                  className={`p-1.5 rounded transition-all ${
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
                  className={`p-1.5 rounded transition-all ${
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
                  className={`p-1.5 rounded transition-all ${
                    selectedShape === 'triangle' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Trójkąt"
                >
                  <Triangle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedShape('line')}
                  className={`p-1.5 rounded transition-all ${
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
                  className={`p-1.5 rounded transition-all ${
                    selectedShape === 'arrow' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Strzałka"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          <ToolButton
            icon={TrendingUp}
            active={tool === 'function'}
            onClick={() => setTool('function')}
            title="Funkcja (F)"
          />
          
          <Divider />
          
          {/* History */}
          <ToolButton
            icon={Undo}
            active={false}
            onClick={onUndo}
            title="Cofnij (Ctrl+Z)"
            disabled={!canUndo}
          />
          <ToolButton
            icon={Redo}
            active={false}
            onClick={onRedo}
            title="Ponów (Ctrl+Y)"
            disabled={!canRedo}
          />
          
          <Divider />
          
          {/* Clear */}
          <ToolButton
            icon={Trash2}
            active={false}
            onClick={onClear}
            title="Wyczyść wszystko"
          />
        </div>
      </div>

      {/* MOBILE: Full Screen Modal */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-[90vw] max-w-md max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
              <h3 className="text-sm font-semibold text-gray-800">Narzędzia</h3>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Tools Grid */}
            <div className="p-3 space-y-3">
              {/* Main Tools */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setTool('select');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'select' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <MousePointer2 className="w-5 h-5" />
                  <span className="text-xs font-medium">Zaznacz</span>
                </button>

                <button
                  onClick={() => {
                    setTool('pan');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'pan' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Hand className="w-5 h-5" />
                  <span className="text-xs font-medium">Przesuwaj</span>
                </button>

                <button
                  onClick={() => {
                    setTool('pen');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'pen' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <PenTool className="w-5 h-5" />
                  <span className="text-xs font-medium">Rysuj</span>
                </button>

                <button
                  onClick={() => {
                    setTool('text');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'text' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Type className="w-5 h-5" />
                  <span className="text-xs font-medium">Tekst</span>
                </button>

                <button
                  onClick={() => {
                    setTool('shape');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'shape' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Square className="w-5 h-5" />
                  <span className="text-xs font-medium">Kształty</span>
                </button>

                <button
                  onClick={() => {
                    setTool('function');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                    tool === 'function' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-xs font-medium">Funkcja</span>
                </button>
              </div>

              {/* Shape Selection (only if shape tool is selected) */}
              {tool === 'shape' && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Wybierz kształt:</p>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => setSelectedShape('rectangle')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'rectangle' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Prostokąt"
                    >
                      <Square className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setSelectedShape('circle')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'circle' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Koło"
                    >
                      <Circle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setSelectedShape('triangle')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'triangle' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Trójkąt"
                    >
                      <Triangle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setSelectedShape('line')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'line' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Linia"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setSelectedShape('arrow')}
                      className={`p-2 rounded transition-all ${
                        selectedShape === 'arrow' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Strzałka"
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
        <div className="hidden md:block bg-white rounded-lg shadow-lg border border-gray-200 p-2 max-w-xl">
          <div className="flex flex-wrap items-center gap-3">
            {/* PEN */}
            {tool === 'pen' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">Kolor:</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
                  />
                </div>
                
                <div className="flex items-center gap-2 min-w-[140px]">
                  <label className="text-xs font-medium text-gray-600">Grubość:</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs text-gray-700 font-semibold w-8 text-right">{lineWidth}px</span>
                </div>
              </>
            )}

            {/* SHAPE */}
            {tool === 'shape' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">Kolor:</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2 min-w-[140px]">
                  <label className="text-xs font-medium text-gray-600">Grubość:</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs text-gray-700 font-semibold w-8 text-right">{lineWidth}px</span>
                </div>
                {selectedShape !== 'line' && selectedShape !== 'arrow' && (
                  <button
                    onClick={() => setFillShape(!fillShape)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      fillShape 
                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {fillShape ? 'Wypełniony' : 'Kontur'}
                  </button>
                )}
              </>
            )}

            {/* TEXT */}
            {tool === 'text' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">Kolor:</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
                  />
                </div>
                
                <div className="flex items-center gap-2 min-w-[140px]">
                  <label className="text-xs font-medium text-gray-600">Rozmiar:</label>
                  <input
                    type="range"
                    min="12"
                    max="120"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs text-gray-700 font-semibold w-10 text-right">{fontSize}px</span>
                </div>
              </>
            )}

            {/* FUNCTION */}
            {tool === 'function' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">Kolor:</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
                  />
                </div>
                
                <div className="flex items-center gap-2 min-w-[120px]">
                  <label className="text-xs font-medium text-gray-600">Grubość:</label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs text-gray-700 font-semibold w-8 text-right">{lineWidth}px</span>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs font-medium text-gray-600">f(x) =</label>
                  <input
                    type="text"
                    value={functionExpression}
                    onChange={(e) => setFunctionExpression(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && functionExpression.trim()) {
                        onGenerateFunction?.(functionExpression);
                        setFunctionExpression('');
                      }
                    }}
                    placeholder="np. sin(x)"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none font-mono transition-all"
                    style={{ maxWidth: '200px', minWidth: '120px' }}
                  />
                  <button
                    onClick={() => {
                      if (functionExpression.trim()) {
                        onGenerateFunction?.(functionExpression);
                        setFunctionExpression('');
                      }
                    }}
                    disabled={!functionExpression.trim()}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    Rysuj
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const arePropsEqual = (prevProps: ToolbarProps, nextProps: ToolbarProps) => {
  return (
    prevProps.tool === nextProps.tool &&
    prevProps.selectedShape === nextProps.selectedShape &&
    prevProps.color === nextProps.color &&
    prevProps.lineWidth === nextProps.lineWidth &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.fillShape === nextProps.fillShape &&
    prevProps.canUndo === nextProps.canUndo &&
    prevProps.canRedo === nextProps.canRedo
  );
};

const MemoizedToolbar = memo(Toolbar, arePropsEqual);
MemoizedToolbar.displayName = 'Toolbar';
export default MemoizedToolbar;