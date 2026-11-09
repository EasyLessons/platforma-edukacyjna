'use client';

/**
 * ============================================================================
 * PLIK: src/_new/features/board-engine/components/excalidraw-vertical-toolbar.tsx
 * ============================================================================
 *
 * Własny pionowy pasek narzędzi sterujący Excalidraw przez API (excalidrawAPI.setActiveTool).
 * Kolejność 1:1 jak na starym silniku:
 *   kursor, rączka, pisak, tekst, kształty (prostokąt/elipsa/romb/strzałka/linia w jednym
 *   rozwijanym przycisku), f(x), obraz, gumka | notatka, tabela, PDF, kalkulator,
 *   biblioteka | cofnij, ponów | kosz.
 *
 * Skróty klawiszowe Excalidraw działają i synchronizują podświetlenie na pasku przez api.onChange.
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  MousePointer2,
  Hand,
  Pen,
  Type,
  Square,
  Circle,
  Diamond,
  MoveUpRight,
  Minus,
  TrendingUp,
  Image as ImageIcon,
  Eraser,
  StickyNote,
  Table as TableIcon,
  FileText,
  Calculator,
  FolderHeart,
  Undo,
  Redo,
  Trash2,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { Tooltip } from '@/_new/shared/ui/tooltip';

export type ExcalidrawShapeType = 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'line';

interface ExcalidrawVerticalToolbarProps {
  api: ExcalidrawImperativeAPI | null;
  readOnly?: boolean;
  // Panele i elementy
  isFunctionPanelOpen?: boolean;
  onToggleFunctionPanel?: () => void;
  onInsertNote?: () => void;
  onInsertTable?: () => void;
  onInsertPdf?: () => void;
  isCalculatorOpen?: boolean;
  onToggleCalculator?: () => void;
  onToggleLibrary?: () => void;
  onClearCanvas?: () => void;
}

const SHAPE_CONFIG: Record<
  ExcalidrawShapeType,
  { label: string; icon: React.ComponentType<{ className?: string }>; shortcut: string }
> = {
  rectangle: { label: 'Prostokąt (R lub 2)', icon: Square, shortcut: 'R' },
  diamond: { label: 'Romb (D lub 3)', icon: Diamond, shortcut: 'D' },
  ellipse: { label: 'Elipsa (O lub 4)', icon: Circle, shortcut: 'O' },
  arrow: { label: 'Strzałka (A lub 5)', icon: MoveUpRight, shortcut: 'A' },
  line: { label: 'Linia (L lub 6)', icon: Minus, shortcut: 'L' },
};

const SHAPES_LIST: ExcalidrawShapeType[] = ['rectangle', 'ellipse', 'diamond', 'arrow', 'line'];

export function ExcalidrawVerticalToolbar({
  api,
  readOnly = false,
  isFunctionPanelOpen = false,
  onToggleFunctionPanel,
  onInsertNote,
  onInsertTable,
  onInsertPdf,
  isCalculatorOpen = false,
  onToggleCalculator,
  onToggleLibrary,
  onClearCanvas,
}: ExcalidrawVerticalToolbarProps) {
  const [activeTool, setActiveTool] = useState<string>('selection');
  const [selectedShape, setSelectedShape] = useState<ExcalidrawShapeType>('rectangle');
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(900);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Śledzenie wysokości okna dla responsywnego menu "Więcej"
  useEffect(() => {
    const updateHeight = () => setViewportHeight(window.innerHeight);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const isCompactHeight = viewportHeight < 760;

  // Synchronizacja aktywnego narzędzia z Excalidraw (w tym skróty klawiszowe R, P, E, H itd.)
  useEffect(() => {
    if (!api) return;

    const updateActiveTool = () => {
      try {
        const state = api.getAppState();
        const toolType = state.activeTool.type;
        setActiveTool(toolType);

        if (SHAPES_LIST.includes(toolType as ExcalidrawShapeType)) {
          setSelectedShape(toolType as ExcalidrawShapeType);
        }
      } catch {
        // api mogło być w trakcie inicjalizacji
      }
    };

    updateActiveTool();
    const unsubscribe = api.onChange(updateActiveTool);
    return unsubscribe;
  }, [api]);

  // Obsługa kliknięć poza menu kształtów / menu więcej
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(e.target as Node)) {
        setIsShapeMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectTool = useCallback(
    (type: string) => {
      if (!api) return;
      api.setActiveTool({ type: type as any });
      setActiveTool(type);
    },
    [api]
  );

  const selectShape = useCallback(
    (shape: ExcalidrawShapeType) => {
      setSelectedShape(shape);
      selectTool(shape);
      setIsShapeMenuOpen(false);
    },
    [selectTool]
  );

  const handleUndo = useCallback(() => {
    if (readOnly) return;
    // Wywołanie undo przez natywny przycisk lub dispatch zdarzenia Ctrl+Z
    const undoButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Cofnij"], .layer-ui__wrapper__footer-left button[aria-label*="Cofnij"]'
    );
    if (undoButton && !undoButton.disabled) {
      undoButton.click();
    } else {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
    }
  }, [readOnly]);

  const handleRedo = useCallback(() => {
    if (readOnly) return;
    const redoButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Przywróć"], .layer-ui__wrapper__footer-left button[aria-label*="Przywróć"]'
    );
    if (redoButton && !redoButton.disabled) {
      redoButton.click();
    } else {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true })
      );
    }
  }, [readOnly]);

  const ShapeIcon = SHAPE_CONFIG[selectedShape].icon;
  const isShapeActive = SHAPES_LIST.includes(activeTool as ExcalidrawShapeType);

  return (
    <aside
      aria-label="Pasek narzędzi tablicy"
      className="absolute left-4 top-1/2 -translate-y-1/2 z-40 pointer-events-auto"
      data-testid="excalidraw-vertical-toolbar"
    >
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 flex flex-col items-center gap-1 select-none">
        {/* 1. Kursor (Selection) */}
        <ToolbarButton
          icon={MousePointer2}
          title="Kursor (V lub 1)"
          active={activeTool === 'selection'}
          onClick={() => selectTool('selection')}
        />

        {/* 2. Rączka (Hand) */}
        <ToolbarButton
          icon={Hand}
          title="Przesuwanie płótna (H lub Spacja)"
          active={activeTool === 'hand'}
          onClick={() => selectTool('hand')}
        />

        {/* 3. Pisak (Freedraw) */}
        <ToolbarButton
          icon={Pen}
          title="Pisak (P lub 7)"
          active={activeTool === 'freedraw'}
          onClick={() => selectTool('freedraw')}
          disabled={readOnly}
        />

        {/* 4. Tekst (Text) */}
        <ToolbarButton
          icon={Type}
          title="Tekst (T lub 8)"
          active={activeTool === 'text'}
          onClick={() => selectTool('text')}
          disabled={readOnly}
        />

        {/* 5. Kształty – rozwijany przycisk */}
        <div className="relative" ref={shapeMenuRef}>
          <Tooltip content={`Kształt: ${SHAPE_CONFIG[selectedShape].label}`} position="right">
            <div className="relative group">
              <button
                type="button"
                data-testid="vertical-toolbar-shapes"
                onClick={() => {
                  if (isShapeActive) {
                    setIsShapeMenuOpen((prev) => !prev);
                  } else {
                    selectTool(selectedShape);
                  }
                }}
                disabled={readOnly}
                aria-label={`Kształt: ${SHAPE_CONFIG[selectedShape].label}`}
                className={`relative p-1.5 rounded-md transition-colors flex items-center justify-center ${
                  isShapeActive ? 'bg-blue-500/20 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                } ${readOnly ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <ShapeIcon className="w-5 h-5" />
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!readOnly) setIsShapeMenuOpen((prev) => !prev);
                  }}
                  className="absolute bottom-0 right-0 w-2 h-2 flex items-center justify-center text-[8px] opacity-60 group-hover:opacity-100"
                >
                  ▾
                </span>
              </button>
            </div>
          </Tooltip>

          {/* Popup wyboru kształtu */}
          {isShapeMenuOpen && !readOnly && (
            <div className="absolute left-12 top-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-1 flex flex-col gap-1 min-w-[150px] animate-in fade-in duration-100">
              {SHAPES_LIST.map((shape) => {
                const conf = SHAPE_CONFIG[shape];
                const Icon = conf.icon;
                const isSelected =
                  activeTool === shape || (isShapeActive && selectedShape === shape);
                return (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => selectShape(shape)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{conf.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. f(x) – wykres funkcji */}
        <ToolbarButton
          icon={TrendingUp}
          title="Wykres funkcji f(x)"
          active={isFunctionPanelOpen}
          onClick={() => onToggleFunctionPanel?.()}
          disabled={readOnly}
          testId="function-panel-toggle"
        />

        {/* 7. Obraz (Image) */}
        <ToolbarButton
          icon={ImageIcon}
          title="Wstaw obraz (9)"
          active={activeTool === 'image'}
          onClick={() => selectTool('image')}
          disabled={readOnly}
        />

        {/* 8. Gumka (Eraser) */}
        <ToolbarButton
          icon={Eraser}
          title="Gumka (E lub 0)"
          active={activeTool === 'eraser'}
          onClick={() => selectTool('eraser')}
          disabled={readOnly}
        />

        <Divider />

        {/* Grupa 2: Nasze elementy (w trybie kompaktowym część chowana do menu Więcej) */}
        {!isCompactHeight ? (
          <>
            {/* 9. Notatka */}
            <ToolbarButton
              icon={StickyNote}
              title="Wstaw notatkę"
              active={false}
              onClick={() => onInsertNote?.()}
              disabled={readOnly}
            />

            {/* 10. Tabela */}
            <ToolbarButton
              icon={TableIcon}
              title="Wstaw tabelę"
              active={false}
              onClick={() => onInsertTable?.()}
              disabled={readOnly}
            />

            {/* 11. PDF */}
            <ToolbarButton
              icon={FileText}
              title="Wstaw PDF"
              active={false}
              onClick={() => onInsertPdf?.()}
              disabled={readOnly}
            />

            {/* 12. Kalkulator */}
            <ToolbarButton
              icon={Calculator}
              title="Kalkulator"
              active={isCalculatorOpen}
              onClick={() => onToggleCalculator?.()}
              testId="panel-toggle-calculator"
            />

            {/* 13. Moje Szablony */}
            <ToolbarButton
              icon={FolderHeart}
              title="Moje Szablony"
              active={false}
              onClick={() => onToggleLibrary?.()}
            />
          </>
        ) : (
          /* Tryb kompaktowy: menu Więcej */
          <div className="relative" ref={moreMenuRef}>
            <ToolbarButton
              icon={MoreVertical}
              title="Więcej narzędzi"
              active={isMoreMenuOpen}
              onClick={() => setIsMoreMenuOpen((v) => !v)}
            />
            {isMoreMenuOpen && (
              <div className="absolute left-12 top-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-1.5 flex flex-col gap-1 min-w-[160px] animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onInsertNote?.();
                  }}
                  disabled={readOnly}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <StickyNote className="w-4 h-4 text-gray-500" />
                  <span>Notatka</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onInsertTable?.();
                  }}
                  disabled={readOnly}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <TableIcon className="w-4 h-4 text-gray-500" />
                  <span>Tabela</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onInsertPdf?.();
                  }}
                  disabled={readOnly}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span>Wstaw PDF</span>
                </button>
                <button
                  type="button"
                  data-testid="panel-toggle-calculator"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onToggleCalculator?.();
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Calculator className="w-4 h-4 text-gray-500" />
                  <span>Kalkulator</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onToggleLibrary?.();
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <FolderHeart className="w-4 h-4 text-gray-500" />
                  <span>Moje Szablony</span>
                </button>
              </div>
            )}
          </div>
        )}

        <Divider />

        {/* 14. Cofnij (Undo) */}
        <ToolbarButton
          icon={Undo}
          title="Cofnij (Ctrl+Z)"
          active={false}
          onClick={handleUndo}
          disabled={readOnly}
        />

        {/* 15. Ponów (Redo) */}
        <ToolbarButton
          icon={Redo}
          title="Ponów (Ctrl+Y)"
          active={false}
          onClick={handleRedo}
          disabled={readOnly}
        />

        <Divider />

        {/* 16. Kosz (Clear Canvas) */}
        <ToolbarButton
          icon={Trash2}
          title="Wyczyść tablicę"
          active={false}
          onClick={() => onClearCanvas?.()}
          disabled={readOnly}
        />
      </div>
    </aside>
  );
}

function ToolbarButton({
  icon: Icon,
  title,
  active = false,
  onClick,
  disabled = false,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <Tooltip content={title} position="right">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-testid={testId}
        aria-label={title}
        className={`relative p-1.5 rounded-md transition-colors flex items-center justify-center ${
          active ? 'bg-blue-500/20 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
        } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <Icon className="w-5 h-5" />
      </button>
    </Tooltip>
  );
}

const Divider = () => <div className="h-px w-6 bg-gray-200 my-1" />;
