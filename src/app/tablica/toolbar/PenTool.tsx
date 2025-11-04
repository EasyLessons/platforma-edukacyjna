/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/PenTool.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, useCallback)
 * - ../whiteboard/types (Point, ViewportTransform, DrawingPath)
 * - ../whiteboard/viewport (inverseTransformPoint, zoomViewport, panViewportWithWheel, constrainViewport)
 * 
 * EKSPORTUJE:
 * - PenTool (component) - narzędzie rysowania piórem
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (aktywne gdy tool === 'pen')
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - używa DrawingPath
 * - viewport.ts - używa funkcji transformacji i zoom/pan
 * - WhiteboardCanvas.tsx - dostarcza callback'i: onPathCreate, onViewportChange
 * 
 * ⚠️ WAŻNE - WHEEL EVENTS:
 * - Overlay ma touchAction: 'none' - blokuje domyślny zoom przeglądarki
 * - onWheel obsługuje zoom (Ctrl+scroll) i pan (scroll)
 * - Współdzieli viewport z WhiteboardCanvas przez onViewportChange
 * 
 * PRZEZNACZENIE:
 * Rysowanie ścieżek piórem - płynne linie rysowane myszką/touchem.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Point, ViewportTransform, DrawingPath } from '../whiteboard/types';
import { inverseTransformPoint, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';

interface PenToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  color: string;
  lineWidth: number;
  onPathCreate: (path: DrawingPath) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function PenTool({
  viewport,
  canvasWidth,
  canvasHeight,
  color,
  lineWidth,
  onPathCreate,
  onViewportChange,
}: PenToolProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);

  // 🆕 Handler dla wheel event - obsługuje zoom i pan
  const handleWheel = (e: React.WheelEvent) => {
    if (!onViewportChange) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (e.ctrlKey) {
      // Zoom
      const newViewport = zoomViewport(viewport, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight);
      onViewportChange(constrainViewport(newViewport));
    } else {
      // Pan
      const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
      onViewportChange(constrainViewport(newViewport));
    }
  };

  // Mouse down - rozpocznij rysowanie
  const handleMouseDown = (e: React.MouseEvent) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    const newPath: DrawingPath = {
      id: Date.now().toString(),
      type: 'path',
      points: [worldPoint],
      color,
      width: lineWidth,
    };

    setCurrentPath(newPath);
    setIsDrawing(true);
  };

  // Mouse move - kontynuuj rysowanie
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentPath) return;

    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    setCurrentPath({
      ...currentPath,
      points: [...currentPath.points, worldPoint],
    });
  };

  // Mouse up - zakończ rysowanie
  const handleMouseUp = () => {
    if (isDrawing && currentPath && currentPath.points.length > 1) {
      onPathCreate(currentPath);
    }

    setIsDrawing(false);
    setCurrentPath(null);
  };

  // Touch events - obsługa dotykowa
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as React.MouseEvent;
      handleMouseDown(mouseEvent);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as React.MouseEvent;
      handleMouseMove(mouseEvent);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseUp();
  };

  // Render preview path (rysowanie w trakcie)
  const renderPreviewPath = () => {
    if (!currentPath || currentPath.points.length === 0) return null;

    // Jeśli jest tylko jeden punkt, narysuj małe kółko
    if (currentPath.points.length === 1) {
      const p = currentPath.points[0];
      const screenX = (p.x - viewport.x) * viewport.scale + canvasWidth / 2;
      const screenY = (p.y - viewport.y) * viewport.scale + canvasHeight / 2;
      
      return (
        <svg
          className="absolute inset-0 pointer-events-none z-40"
          style={{ width: canvasWidth, height: canvasHeight }}
        >
          <circle
            cx={screenX}
            cy={screenY}
            r={currentPath.width * viewport.scale / 2}
            fill={currentPath.color}
          />
        </svg>
      );
    }

    // Transformuj punkty ze współrzędnych świata na ekran
    const pathData = currentPath.points
      .map((p, i) => {
        const screenX = (p.x - viewport.x) * viewport.scale + canvasWidth / 2;
        const screenY = (p.y - viewport.y) * viewport.scale + canvasHeight / 2;
        return i === 0 ? `M ${screenX} ${screenY}` : `L ${screenX} ${screenY}`;
      })
      .join(' ');

    return (
      <svg
        className="absolute inset-0 pointer-events-none z-40"
        style={{ width: canvasWidth, height: canvasHeight }}
      >
        <path
          d={pathData}
          stroke={currentPath.color}
          strokeWidth={currentPath.width * viewport.scale}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  };

  return (
    <div className="absolute inset-0" style={{ cursor: 'crosshair' }}>
      {/* Debug info */}
      {isDrawing && currentPath && (
        <div className="absolute top-4 left-4 bg-black/70 text-white text-xs p-2 rounded pointer-events-none z-50">
          Rysowanie: {currentPath.points.length} punktów
        </div>
      )}
      
      {/* Overlay dla mouse events */}
      <div
        className="absolute inset-0 pointer-events-auto"
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

      {/* Preview path */}
      {renderPreviewPath()}
    </div>
  );
}
