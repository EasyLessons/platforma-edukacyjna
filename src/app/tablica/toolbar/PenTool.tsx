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
import { useMultiTouchGestures } from '../whiteboard/useMultiTouchGestures';

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
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef<DrawingPath | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const [, forceUpdate] = useState({});

  // 🆕 Multi-touch gestures (2+ palce = pan/zoom)
  const gestures = useMultiTouchGestures({
    viewport,
    canvasWidth,
    canvasHeight,
    onViewportChange: onViewportChange || (() => {}),
  });

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
    // 🆕 Najpierw przekaż do gesture handler
    gestures.handlePointerDown(e);

    // 🆕 Jeśli gesty aktywne (2+ palce touch) → blokuj rysowanie
    if (gestures.isGestureActive()) return;

    // Tylko lewy przycisk myszy (button === 0) lub pen/touch (button === 0 lub -1)
    // Ignoruj środkowy (button === 1) i prawy przycisk (button === 2)
    if (e.button !== 0) return;
    
    // 🆕 WAŻNE dla iPad Pencil: ignoruj hover events (pressure === 0)
    // Tylko rzeczywisty kontakt z ekranem ma pressure > 0
    if (e.pointerType === 'pen' && e.pressure === 0) return;
    
    // 🆕 Dodatkowo sprawdź buttons - musi być wciśnięty
    if (e.buttons === 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
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

    currentPathRef.current = newPath;
    isDrawingRef.current = true;
    // Wymuszaj natychmiastowy render pierwszego punktu
    forceUpdate({});
  };

  // Pointer move - kontynuuj rysowanie (obsługuje mysz, tablet, touch)
  const handlePointerMove = (e: React.PointerEvent) => {
    // 🆕 Najpierw przekaż do gesture handler
    gestures.handlePointerMove(e);

    // 🆕 Jeśli gesty aktywne → nie rysuj
    if (gestures.isGestureActive()) return;

    // 🆕 WAŻNE dla iPad Pencil: ignoruj hover events (pressure === 0)
    // Hover blokuje szybkie rysowanie - tylko rzeczywisty dotyk!
    if (e.pointerType === 'pen' && e.pressure === 0) return;
    
    // 🆕 Sprawdź czy przycisk wciśnięty
    if (e.buttons === 0) return;

    if (!isDrawingRef.current || !currentPathRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();

    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    // Dodaj punkt bezpośrednio do ref (bez kopiowania całej tablicy)
    pointsRef.current.push(worldPoint);
    
    // Wymuszaj re-render dla płynnego podglądu
    forceUpdate({});
  };

  // Pointer up - zakończ rysowanie (obsługuje mysz, tablet, touch)
  const handlePointerUp = (e: React.PointerEvent) => {
    // 🆕 Przekaż do gesture handler
    gestures.handlePointerUp(e);

    if (!isDrawingRef.current) return;
    
    // Zwolnij pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (currentPathRef.current && pointsRef.current.length >= 1) {
      // Utwórz finalną ścieżkę z kopiami punktów
      const finalPath: DrawingPath = {
        ...currentPathRef.current,
        points: [...pointsRef.current],
      };
      onPathCreate(finalPath);
    }

    isDrawingRef.current = false;
    currentPathRef.current = null;
    pointsRef.current = [];
  };

  // Pointer cancel - anuluj rysowanie
  const handlePointerCancel = (e: React.PointerEvent) => {
    // 🆕 Przekaż do gesture handler
    gestures.handlePointerCancel(e);

    if (!isDrawingRef.current) return;
    
    // Zwolnij pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    isDrawingRef.current = false;
    currentPathRef.current = null;
    pointsRef.current = [];
  };

  // Render preview path (rysowanie w trakcie)
  const renderPreviewPath = () => {
    if (!currentPathRef.current || pointsRef.current.length === 0) return null;

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
          stroke={currentPathRef.current.color}
          strokeWidth={clampLineWidth(currentPathRef.current.width, viewport.scale)}
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
        onPointerCancel={handlePointerCancel}
      />

      {/* Preview path */}
      {renderPreviewPath()}
    </div>
  );
}