/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/ZoomControls.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (memo)
 * - lucide-react (ikony: Home, ZoomIn, ZoomOut)
 * 
 * EKSPORTUJE:
 * - ZoomControls (component) - UI kontroli zoom (lewy dolny róg)
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główny komponent)
 * 
 * PRZEZNACZENIE:
 * Przyciski zoom in/out i reset widoku (Home).
 * Wyświetla aktualną skalę w %.
 * ============================================================================
 */

'use client';

import React, { memo } from 'react';
import { Home, ZoomIn, ZoomOut } from 'lucide-react';

const ZoomControlsComponent = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
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
