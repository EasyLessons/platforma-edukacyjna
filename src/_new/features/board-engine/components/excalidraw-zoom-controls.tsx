'use client';

/**
 * ============================================================================
 * PLIK: src/_new/features/board-engine/components/excalidraw-zoom-controls.tsx
 * ============================================================================
 *
 * Kontrolki zoom i resetu widoku w lewym dolnym rogu tablicy Excalidraw.
 * Dom (powrót do widoku), zoom −, procent, zoom +.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { Home, ZoomIn, ZoomOut } from 'lucide-react';
import { Tooltip } from '@/_new/shared/ui/tooltip';
import {
  useWhiteboardUiMetrics,
  safeInset,
} from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';

interface ExcalidrawZoomControlsProps {
  api: ExcalidrawImperativeAPI | null;
}

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;

export function ExcalidrawZoomControls({ api }: ExcalidrawZoomControlsProps) {
  const [zoom, setZoom] = useState<number>(1);
  const metrics = useWhiteboardUiMetrics();
  const compact = metrics.isPhoneLayout;

  // Śledzenie zmian zoomu z Excalidraw (np. pinch-to-zoom, kółko myszy)
  useEffect(() => {
    if (!api) return;

    const updateZoom = () => {
      try {
        const appState = api.getAppState();
        if (appState?.zoom?.value) {
          setZoom(appState.zoom.value);
        }
      } catch {
        // ignore
      }
    };

    updateZoom();
    const unsubscribeScroll = api.onScrollChange((_x, _y, newZoom) => {
      if (newZoom?.value) setZoom(newZoom.value);
    });

    const unsubscribeChange = api.onChange((_el, appState) => {
      if (appState?.zoom?.value && Math.abs(appState.zoom.value - zoom) > 0.005) {
        setZoom(appState.zoom.value);
      }
    });

    return () => {
      unsubscribeScroll?.();
      unsubscribeChange?.();
    };
  }, [api, zoom]);

  const handleResetView = useCallback(() => {
    if (!api) return;
    const elements = api.getSceneElements();
    if (elements.length > 0) {
      api.scrollToContent(elements, { fitToViewport: true });
    } else {
      api.updateScene({
        appState: {
          scrollX: 0,
          scrollY: 0,
          zoom: { value: 1 as any },
        },
      });
      setZoom(1);
    }
  }, [api]);

  const handleZoomIn = useCallback(() => {
    if (!api) return;
    const nextZoom = Math.min(MAX_ZOOM, Math.round((zoom + ZOOM_STEP) * 10) / 10);
    api.updateScene({
      appState: {
        zoom: { value: nextZoom as any },
      },
    });
    setZoom(nextZoom);
  }, [api, zoom]);

  const handleZoomOut = useCallback(() => {
    if (!api) return;
    const nextZoom = Math.max(MIN_ZOOM, Math.round((zoom - ZOOM_STEP) * 10) / 10);
    api.updateScene({
      appState: {
        zoom: { value: nextZoom as any },
      },
    });
    setZoom(nextZoom);
  }, [api, zoom]);

  return (
    <div
      className="absolute bg-white rounded-xl shadow-lg border border-gray-200 z-40 pointer-events-auto select-none"
      style={{
        bottom: safeInset(16, 'bottom'),
        left: safeInset(16, 'left'),
      }}
      data-testid="excalidraw-zoom-controls"
    >
      <div className="flex items-center gap-1 p-1.5">
        <Tooltip content="Powrót na środek tablicy" position="top">
          <button
            type="button"
            onClick={handleResetView}
            aria-label="Powrót na środek tablicy"
            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border-r border-gray-200"
          >
            <Home className="w-4 h-4" />
          </button>
        </Tooltip>

        {!compact && (
          <Tooltip content="Zmniejsz (Ctrl+-)" position="top">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Pomniejsz"
              className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </Tooltip>
        )}

        <span className="text-xs font-medium text-gray-700 min-w-[45px] text-center px-1">
          {Math.round(zoom * 100)}%
        </span>

        {!compact && (
          <Tooltip content="Powiększ (Ctrl++)" position="top">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Powiększ"
              className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
