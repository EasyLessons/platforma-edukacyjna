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
import { Tooltip } from '@/_new/shared/ui/tooltip';
import {
  useWhiteboardUiMetrics,
  safeInset,
} from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';

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
  const metrics = useWhiteboardUiMetrics();
  // Na telefonie zoom robi sie szczypnieciem - zostaje tylko powrot na srodek
  // i podglad skali, zeby kontrolka nie zajmowala dolnego rogu ekranu.
  const compact = metrics.isPhoneLayout;

  return (
    <div
      className="absolute bg-white rounded-lg shadow-lg border border-gray-200 z-50 pointer-events-auto"
      style={{ bottom: safeInset(16, 'bottom'), left: safeInset(16, 'left') }}
    >
      <div className="flex items-center gap-1 p-1.5">
        <Tooltip content="Powrót na środek tablicy" position="top">
          <button
            onClick={onResetView}
            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors border-r border-gray-200"
          >
            <Home className="w-4 h-4" />
          </button>
        </Tooltip>

        {!compact && (
          <Tooltip content="Zmniejsz" position="top">
            <button
              onClick={onZoomOut}
              className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </Tooltip>
        )}

        <span className="text-xs font-medium text-gray-700 min-w-[45px] text-center px-1">
          {Math.round(zoom * 100)}%
        </span>

        {!compact && (
          <Tooltip content="Powiększ" position="top">
            <button
              onClick={onZoomIn}
              className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
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
