/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/Toolbar.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, memo)
 * - ./ToolbarUI (komponent UI toolbara)
 * - ./ZoomControls (opcjonalnie - obecnie NIE używane w tym komponencie)
 * 
 * EKSPORTUJE:
 * - Tool (type) - 'select' | 'pan' | 'pen' | 'text' | 'shape' | 'function'
 * - ShapeType (type) - 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow'
 * - Toolbar (component, default) - główny kontener toolbara
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główny komponent)
 * 
 * UŻYWA:
 * - ToolbarUI.tsx (renderowanie UI)
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - Zmiana Tool lub ShapeType wpływa na WhiteboardCanvas, SelectTool, ToolbarUI
 * - ToolbarUI.tsx musi mieć zgodne propsy
 * 
 * PRZEZNACZENIE:
 * Kontener zarządzający stanem toolbara (narzędzia, funkcje matematyczne).
 * Deleguje renderowanie do ToolbarUI, zarządza popup funkcji matematycznych.
 * ============================================================================
 */

'use client';

import React, { useState, memo } from 'react';
import { ToolbarUI } from './ToolbarUI';
import { ZoomControls } from './ZoomControls';

export type Tool = 'select' | 'pan' | 'pen' | 'text' | 'shape' | 'function' | 'image' | 'eraser' | 'markdown' | 'table' | 'calculator';
export type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow' | 'polygon';



interface ToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  selectedShape: ShapeType;
  setSelectedShape: (shape: ShapeType) => void;
  polygonSides: number;
  setPolygonSides: (sides: number) => void;
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
  canUndo: boolean;
  canRedo: boolean;
  // 🆕 Selection
  hasSelection?: boolean;
  onDeleteSelected?: () => void;
  // 📦 Export/Import handlers
  onExport?: () => void;
  onImport?: () => void;
  // 🖼️ ImageTool handlers
  onImagePaste?: () => void;
  onImageUpload?: () => void;
  // 🧮 Calculator toggle
  isCalculatorOpen?: boolean;
  onCalculatorToggle?: () => void;
  // 🤖 Chatbot toggle
  isChatbotOpen?: boolean;
  onChatbotToggle?: () => void;
}

function Toolbar({
  tool,
  setTool,
  selectedShape,
  setSelectedShape,
  polygonSides,
  setPolygonSides,
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
  canUndo,
  canRedo,
  hasSelection,
  onDeleteSelected,
  onExport,
  onImport,
  onImagePaste,
  onImageUpload,
  isCalculatorOpen,
  onCalculatorToggle,
  isChatbotOpen,
  onChatbotToggle,
}: ToolbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 🔴 USUNIĘTE - handleGenerateFunction i functionExpression nie są już potrzebne
  // FunctionTool sam tworzy funkcje i ma własny input

  return (
    <div className="absolute top-28 left-4 z-50 pointer-events-none flex flex-row items-start gap-2">
      <ToolbarUI
        tool={tool}
        selectedShape={selectedShape}
        polygonSides={polygonSides}
        color={color}
        lineWidth={lineWidth}
        fontSize={fontSize}
        fillShape={fillShape}
        canUndo={canUndo}
        canRedo={canRedo}
        hasSelection={hasSelection}
        onToolChange={setTool}
        onShapeChange={setSelectedShape}
        onPolygonSidesChange={setPolygonSides}
        onColorChange={setColor}
        onLineWidthChange={setLineWidth}
        onFontSizeChange={setFontSize}
        onFillShapeChange={setFillShape}
        onUndo={onUndo}
        onRedo={onRedo}
        onClear={onClear}
        onDeleteSelected={onDeleteSelected}
        onExport={onExport}
        onImport={onImport}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onImagePaste={onImagePaste}
        onImageUpload={onImageUpload}
        isCalculatorOpen={isCalculatorOpen}
        onCalculatorToggle={onCalculatorToggle}
        isChatbotOpen={isChatbotOpen}
        onChatbotToggle={onChatbotToggle}
      />
    </div>
  );
}

const arePropsEqual = (prevProps: ToolbarProps, nextProps: ToolbarProps) => {
  return (
    prevProps.tool === nextProps.tool &&
    prevProps.selectedShape === nextProps.selectedShape &&
    prevProps.polygonSides === nextProps.polygonSides &&
    prevProps.color === nextProps.color &&
    prevProps.lineWidth === nextProps.lineWidth &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.fillShape === nextProps.fillShape &&
    prevProps.canUndo === nextProps.canUndo &&
    prevProps.canRedo === nextProps.canRedo &&
    prevProps.hasSelection === nextProps.hasSelection &&
    prevProps.isCalculatorOpen === nextProps.isCalculatorOpen &&
    prevProps.isChatbotOpen === nextProps.isChatbotOpen
  );
};

const MemoizedToolbar = memo(Toolbar, arePropsEqual);
MemoizedToolbar.displayName = 'Toolbar';
export default MemoizedToolbar;