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

import { useState, useRef, useEffect, useCallback } from 'react';
import { Point, ViewportTransform, DrawingPath } from '../whiteboard/types';
import { inverseTransformPoint, transformPoint, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';
import { clampLineWidth } from '../whiteboard/utils';

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const [, forceUpdate] = useState({});

  // Wheel events dla pan/zoom - używamy native event listener dla { passive: false }
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey) {
        const newViewport = zoomViewport(viewport, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight);
        onViewportChange(constrainViewport(newViewport));
      } else {
        const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
        onViewportChange(constrainViewport(newViewport));
      }
    };

    overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleNativeWheel);
  }, [viewport, canvasWidth, canvasHeight, onViewportChange]);

  // Pointer down - rozpocznij rysowanie (obsługuje mysz, tablet, touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Tylko lewy przycisk myszy (button === 0) lub pen/touch (button === 0 lub -1)
    // Ignoruj środkowy (button === 1) i prawy przycisk (button === 2)
    if (e.button !== 0) return;
    
    e.preventDefault();
    
    // Przechwytuj pointer events
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    pointsRef.current = [worldPoint];

    const newPath: DrawingPath = {
      id: Date.now().toString(),
      type: 'path',
      points: pointsRef.current,
      color,
      width: lineWidth,
    };

    setCurrentPath(newPath);
    setIsDrawing(true);
    // Wymuszaj natychmiastowy render pierwszego punktu
    forceUpdate({});
  };

  // Pointer move - kontynuuj rysowanie (obsługuje mysz, tablet, touch)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentPath) return;
    
    e.preventDefault();

    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    // Dodaj punkt bezpośrednio do ref (bez kopiowania całej tablicy)
    pointsRef.current.push(worldPoint);
    
    // Wymuszaj re-render dla płynnego podglądu
    forceUpdate({});
  };

  // Pointer up - zakończ rysowanie (obsługuje mysz, tablet, touch)
  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDrawing && currentPath && pointsRef.current.length >= 1) {
      // Utwórz finalną ścieżkę z kopiami punktów
      const finalPath: DrawingPath = {
        ...currentPath,
        points: [...pointsRef.current],
      };
      onPathCreate(finalPath);
    }

    setIsDrawing(false);
    setCurrentPath(null);
    pointsRef.current = [];
  };

  // Render preview path (rysowanie w trakcie)
  const renderPreviewPath = () => {
    if (!currentPath || pointsRef.current.length === 0) return null;

    // Transformuj punkty ze współrzędnych świata na ekran
    const pathData = pointsRef.current
      .map((p, i) => {
        const screenPoint = transformPoint(p, viewport, canvasWidth, canvasHeight);
        return i === 0 ? `M ${screenPoint.x} ${screenPoint.y}` : `L ${screenPoint.x} ${screenPoint.y}`;
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
          strokeWidth={clampLineWidth(currentPath.width, viewport.scale)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  };

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: 'crosshair' }}>
      {/* Overlay dla mouse events */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Preview path */}
      {renderPreviewPath()}
    </div>
  );
}