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

export type Tool = 'select' | 'pan' | 'pen' | 'text' | 'shape' | 'function' | 'image' | 'eraser';
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
  canUndo: boolean;
  canRedo: boolean;
  // 🖼️ ImageTool handlers
  onImagePaste?: () => void;
  onImageUpload?: () => void;
}

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
  canUndo,
  canRedo,
  onImagePaste,
  onImageUpload,
}: ToolbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 🔴 USUNIĘTE - handleGenerateFunction i functionExpression nie są już potrzebne
  // FunctionTool sam tworzy funkcje i ma własny input

  return (
    <div className="absolute top-20 left-4 z-50 pointer-events-auto flex flex-col items-start gap-2">
      <ToolbarUI
        tool={tool}
        selectedShape={selectedShape}
        color={color}
        lineWidth={lineWidth}
        fontSize={fontSize}
        fillShape={fillShape}
        canUndo={canUndo}
        canRedo={canRedo}
        onToolChange={setTool}
        onShapeChange={setSelectedShape}
        onColorChange={setColor}
        onLineWidthChange={setLineWidth}
        onFontSizeChange={setFontSize}
        onFillShapeChange={setFillShape}
        onUndo={onUndo}
        onRedo={onRedo}
        onClear={onClear}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onImagePaste={onImagePaste}
        onImageUpload={onImageUpload}
      />
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