/**
 * ============================================================================
 * PLIK: components/toolbar/Toolbar.tsx
 * ============================================================================
 *
 * Kontener pozycjonujący toolbar (absolute, lewa krawędź z offsetem sidebara).
 * Deleguje renderowanie do ToolbarUI. Stan narzędzi (activeTool) i ich
 * właściwości żyją w zustand (tool-store) — Toolbar przekazuje już TYLKO akcje
 * oraz flagi historii/selekcji/kalkulatora.
 * ============================================================================
 */

'use client';

import { memo } from 'react';
import { ToolbarUI } from './toolbar-ui';

// Re-eksport dla starych importów typu z './toolbar/Toolbar'
export type { Tool, ShapeType } from '@/_new/features/whiteboard/types';

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // 🆕 Selection
  hasSelection?: boolean;
  onDeleteSelected?: () => void;
  // 📦 Export/Import handlers
  onExport?: () => void;
  onImport?: () => void;
  // 🧮 Calculator toggle
  isCalculatorOpen?: boolean;
  onCalculatorToggle?: () => void;
  // 🔒 Read-only mode
  isReadOnly?: boolean;
  /** Offset od lewej krawędzi (px) — przesuwa toolbar gdy sidebar jest otwarty */
  leftOffset?: number;
  onToggleAssetsLibrary?: () => void;
}

function Toolbar({
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  hasSelection,
  onDeleteSelected,
  onExport,
  onImport,
  isCalculatorOpen,
  onCalculatorToggle,
  isReadOnly = false,
  leftOffset = 0,
  onToggleAssetsLibrary,
}: ToolbarProps) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none flex flex-row items-start gap-2"
      style={{
        left: `${leftOffset + 16}px`,
        transition: 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}
    >
      <ToolbarUI
        canUndo={canUndo}
        canRedo={canRedo}
        hasSelection={hasSelection}
        onUndo={onUndo}
        onRedo={onRedo}
        onClear={onClear}
        onDeleteSelected={onDeleteSelected}
        onExport={onExport}
        onImport={onImport}
        isCalculatorOpen={isCalculatorOpen}
        onCalculatorToggle={onCalculatorToggle}
        isReadOnly={isReadOnly}
        onToggleAssetsLibrary={onToggleAssetsLibrary}
      />
    </div>
  );
}

const arePropsEqual = (prevProps: ToolbarProps, nextProps: ToolbarProps) => {
  return (
    prevProps.canUndo === nextProps.canUndo &&
    prevProps.canRedo === nextProps.canRedo &&
    prevProps.hasSelection === nextProps.hasSelection &&
    prevProps.isCalculatorOpen === nextProps.isCalculatorOpen &&
    prevProps.isReadOnly === nextProps.isReadOnly &&
    prevProps.leftOffset === nextProps.leftOffset
  );
};

const MemoizedToolbar = memo(Toolbar, arePropsEqual);
MemoizedToolbar.displayName = 'Toolbar';
export default MemoizedToolbar;
