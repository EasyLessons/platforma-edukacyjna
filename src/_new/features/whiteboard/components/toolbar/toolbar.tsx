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
import {
  useWhiteboardUiMetrics,
  safeInset,
} from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';

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
  const metrics = useWhiteboardUiMetrics();

  // Telefon: pasek nie jest centrowany w pionie (w poziomie wychodzil poza ekran,
  // w pionie zajmowal ~70% wysokosci). Startuje pod gornymi kontrolkami, konczy
  // nad kontrolka zoomu i przewija sie, gdy narzedzia sie nie mieszcza.
  // W pionie gorny rzad to przycisk panelu + wyszukiwarka pod nim.
  const phoneTop = metrics.isPhonePortrait ? 142 : 82;
  const PHONE_BOTTOM_RESERVED = 66; // zoom (40) + odstepy
  const phoneMaxHeight = `calc(100dvh - ${phoneTop + PHONE_BOTTOM_RESERVED}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`;

  return (
    <div
      className={
        metrics.isPhoneLayout
          ? 'absolute z-50 pointer-events-none flex flex-row items-start gap-2'
          : 'absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none flex flex-row items-start gap-2'
      }
      style={
        metrics.isPhoneLayout
          ? {
              top: safeInset(phoneTop, 'top'),
              left: safeInset(leftOffset + 16, 'left'),
              transition: 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }
          : {
              left: `${leftOffset + 16}px`,
              transition: 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }
      }
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
        maxHeight={metrics.isPhoneLayout ? phoneMaxHeight : undefined}
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
