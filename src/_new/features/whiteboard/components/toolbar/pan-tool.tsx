/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/PanTool.tsx
 * ============================================================================
 *
 * IMPORTUJE Z:
 * - react (useState, useCallback)
 * - ../whiteboard/types (Point, ViewportTransform)
 * - ../whiteboard/viewport (panViewportWithMouse, zoomViewport, panViewportWithWheel, constrainViewport)
 *
 * EKSPORTUJE:
 * - PanTool (component) - narzędzie przesuwania viewport
 *
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (aktywne gdy tool === 'pan')
 *
 * ⚠️ ZALEŻNOŚCI:
 * - viewport.ts - używa funkcji transformacji i zoom/pan
 * - WhiteboardCanvas.tsx - dostarcza callback: onViewportChange
 *
 * ⚠️ WAŻNE - WHEEL EVENTS:
 * - Overlay ma touchAction: 'none' - blokuje domyślny zoom przeglądarki
 * - onWheel obsługuje zoom (Ctrl+scroll) i pan (scroll)
 * - Drag to pan (LMB lub środkowy przycisk myszy)
 *
 * PRZEZNACZENIE:
 * Przesuwanie viewport przez przeciąganie myszką lub scroll/pinch.
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Point, ViewportTransform } from '@/_new/features/whiteboard/types';
import {
  panViewportWithMouse,
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
} from '@/_new/features/whiteboard/navigation/viewport-math';
import { useMultiTouchGestures } from '@/_new/features/whiteboard/hooks/use-multi-touch-gestures';

interface PanToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange: (viewport: ViewportTransform) => void;
  /** Wywoływane gdy użytkownik zaczyna ciągnąć canvas — ukryj overlaye */
  onPanStart?: () => void;
  /** Wywoływane gdy użytkownik puści canvas — pokaż overlaye */
  onPanEnd?: () => void;
}

export function PanTool({ viewport, canvasWidth, canvasHeight, onViewportChange, onPanStart, onPanEnd }: PanToolProps) {
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Point | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const gestures = useMultiTouchGestures({
    viewport,
    canvasWidth,
    canvasHeight,
    onViewportChange,
  });

  // 🍎 FIX: Apple Pencil bug z iOS 14+ Scribble
  // Dodanie preventDefault na touchmove naprawia problem z brakującymi eventami Apple Pencil
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };

    overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => overlay.removeEventListener('touchmove', handleTouchMove);
  }, []);

  // 🆕 Native wheel listener — musi być non-passive żeby preventDefault działał
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey) {
        const newViewport = zoomViewport(
          viewport,
          e.deltaY,
          e.clientX,
          e.clientY,
          canvasWidth,
          canvasHeight
        );
        onViewportChange(constrainViewport(newViewport));
      } else {
        const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
        onViewportChange(constrainViewport(newViewport));
      }
    };

    overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleNativeWheel);
  }, [viewport, canvasWidth, canvasHeight, onViewportChange]);

  // Pointer down - rozpocznij panning
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      gestures.handlePointerDown(e);
      if (e.button === 0 || e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        onPanStart?.();
      }
    },
    [gestures, onPanStart]
  );

  // Pointer move - kontynuuj panning
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      gestures.handlePointerMove(e);
      if (gestures.isGestureActive()) return; // Gesty mają priorytet

      if (!isPanning || !lastMousePos) return;

      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;

      const newViewport = panViewportWithMouse(viewport, dx, dy);
      onViewportChange(constrainViewport(newViewport));

      setLastMousePos({ x: e.clientX, y: e.clientY });
    },
    [isPanning, lastMousePos, viewport, onViewportChange, gestures]
  );

  // Pointer up - zakończ panning
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      gestures.handlePointerUp(e);
      if (isPanning) {
        onPanEnd?.();
      }
      setIsPanning(false);
      setLastMousePos(null);
    },
    [gestures, isPanning, onPanEnd]
  );

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: isPanning ? 'grabbing' : 'grab' }}>
      {/* Debug info */}
      {isPanning && (
        <div className="absolute top-4 left-4 bg-black/70 text-white text-xs p-2 rounded pointer-events-none z-50">
          Przesuwanie viewport...
        </div>
      )}

      {/* Overlay dla pointer events */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}

