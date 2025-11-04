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

import { useState, useCallback } from 'react';
import { Point, ViewportTransform } from '../whiteboard/types';
import { panViewportWithMouse, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';

interface PanToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange: (viewport: ViewportTransform) => void;
}

export function PanTool({
  viewport,
  canvasWidth,
  canvasHeight,
  onViewportChange,
}: PanToolProps) {
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Point | null>(null);

  // 🆕 Handler dla wheel event - obsługuje zoom i pan
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.ctrlKey) {
      // Zoom
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
      // Pan
      const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
      onViewportChange(constrainViewport(newViewport));
    }
  }, [viewport, canvasWidth, canvasHeight, onViewportChange]);

  // Mouse down - rozpocznij panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Akceptuj LMB lub środkowy przycisk
    if (e.button === 0 || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, []);

  // Mouse move - kontynuuj panning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !lastMousePos) return;

    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;

    const newViewport = panViewportWithMouse(viewport, dx, dy);
    onViewportChange(constrainViewport(newViewport));

    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, [isPanning, lastMousePos, viewport, onViewportChange]);

  // Mouse up - zakończ panning
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setLastMousePos(null);
  }, []);

  // Touch events - obsługa dotykowa
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      setIsPanning(true);
      setLastMousePos({ x: touch.clientX, y: touch.clientY });
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPanning || !lastMousePos || e.touches.length !== 1) return;

    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - lastMousePos.x;
    const dy = touch.clientY - lastMousePos.y;

    const newViewport = panViewportWithMouse(viewport, dx, dy);
    onViewportChange(constrainViewport(newViewport));

    setLastMousePos({ x: touch.clientX, y: touch.clientY });
  }, [isPanning, lastMousePos, viewport, onViewportChange]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsPanning(false);
    setLastMousePos(null);
  }, []);

  return (
    <div
      className="absolute inset-0 z-20"
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      {/* Debug info */}
      {isPanning && (
        <div className="absolute top-4 left-4 bg-black/70 text-white text-xs p-2 rounded pointer-events-none z-50">
          Przesuwanie viewport...
        </div>
      )}

      {/* Overlay dla mouse events */}
      <div
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      />
    </div>
  );
}
