/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/EraserTool.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, useRef, useEffect, useCallback)
 * - ../whiteboard/types (Point, ViewportTransform, DrawingElement)
 * - ../whiteboard/viewport (inverseTransformPoint, zoomViewport, panViewportWithWheel, constrainViewport)
 * 
 * EKSPORTUJE:
 * - EraserTool (component) - narzędzie gumki (usuwa elementy pod kursorem)
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główny komponent)
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - wszystkie typy elementów
 * - viewport.ts - transformacje współrzędnych, pan/zoom
 * 
 * PRZEZNACZENIE:
 * Gumka do usuwania całych elementów - kliknięcie usuwa element pod kursorem.
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Point, ViewportTransform, DrawingElement } from '../whiteboard/types';
import { inverseTransformPoint, transformPoint, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';
import { useMultiTouchGestures } from '../whiteboard/useMultiTouchGestures';

interface EraserToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  elements: DrawingElement[];
  onElementDelete: (id: string) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function EraserTool({
  viewport,
  canvasWidth,
  canvasHeight,
  elements,
  onElementDelete,
  onViewportChange,
}: EraserToolProps) {
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const deletedDuringDrag = useRef<Set<string>>(new Set());

  const gestures = useMultiTouchGestures({
    viewport,
    canvasWidth,
    canvasHeight,
    onViewportChange: onViewportChange || (() => {}),
  });

  // Wheel events dla pan/zoom
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

  // Sprawdza czy punkt jest w elemencie
  const isPointInElement = useCallback((worldPoint: Point, element: DrawingElement): boolean => {
    if (element.type === 'shape') {
      const minX = Math.min(element.startX, element.endX);
      const maxX = Math.max(element.startX, element.endX);
      const minY = Math.min(element.startY, element.endY);
      const maxY = Math.max(element.startY, element.endY);

      return (
        worldPoint.x >= minX &&
        worldPoint.x <= maxX &&
        worldPoint.y >= minY &&
        worldPoint.y <= maxY
      );
    } else if (element.type === 'text') {
      const width = element.width || 3;
      const height = element.height || 1;
      return (
        worldPoint.x >= element.x &&
        worldPoint.x <= element.x + width &&
        worldPoint.y >= element.y &&
        worldPoint.y <= element.y + height
      );
    } else if (element.type === 'image') {
      return (
        worldPoint.x >= element.x &&
        worldPoint.x <= element.x + element.width &&
        worldPoint.y >= element.y &&
        worldPoint.y <= element.y + element.height
      );
    } else if (element.type === 'path') {
      // Dla path sprawdzamy czy punkt jest blisko któregokolwiek segmentu
      const threshold = 0.3; // tolerancja w jednostkach świata
      
      for (let i = 0; i < element.points.length - 1; i++) {
        const p1 = element.points[i];
        const p2 = element.points[i + 1];
        
        // Odległość punktu od odcinka
        const dist = pointToSegmentDistance(worldPoint, p1, p2);
        if (dist < threshold) return true;
      }
      return false;
    } else if (element.type === 'function') {
      // Dla funkcji używamy bounding box (przybliżenie)
      const minX = -element.xRange;
      const maxX = element.xRange;
      const minY = -element.yRange;
      const maxY = element.yRange;
      
      return (
        worldPoint.x >= minX &&
        worldPoint.x <= maxX &&
        worldPoint.y >= minY &&
        worldPoint.y <= maxY
      );
    }

    return false;
  }, []);

  // Pomocnicza funkcja: odległość punktu od odcinka
  const pointToSegmentDistance = (point: Point, segStart: Point, segEnd: Point): number => {
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      // Segment to punkt
      const distX = point.x - segStart.x;
      const distY = point.y - segStart.y;
      return Math.sqrt(distX * distX + distY * distY);
    }
    
    // Projekcja punktu na odcinek
    const t = Math.max(0, Math.min(1, 
      ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSquared
    ));
    
    const projX = segStart.x + t * dx;
    const projY = segStart.y + t * dy;
    
    const distX = point.x - projX;
    const distY = point.y - projY;
    return Math.sqrt(distX * distX + distY * distY);
  };

  // Znajduje element pod kursorem (od góry - ostatni rysowany)
  const findElementAtPoint = useCallback((worldPoint: Point) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (isPointInElement(worldPoint, el)) {
        return el;
      }
    }
    return null;
  }, [elements, isPointInElement]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    gestures.handlePointerDown(e);
    if (gestures.isGestureActive()) return;

    setIsDragging(true);
    deletedDuringDrag.current.clear();
    
    // Usuń element pod kursorem natychmiast przy kliknięciu
    if (hoveredElementId) {
      deletedDuringDrag.current.add(hoveredElementId);
      onElementDelete(hoveredElementId);
      setHoveredElementId(null);
    }
  }, [hoveredElementId, onElementDelete, gestures]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    gestures.handlePointerUp(e);
    
    setIsDragging(false);
    deletedDuringDrag.current.clear();
  }, [gestures]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    gestures.handlePointerMove(e);
    if (gestures.isGestureActive()) return;

    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);
    setCursorPosition(screenPoint); // ✅ Zapisz screen position dla kursora

    // Znajdź element pod kursorem
    const element = findElementAtPoint(worldPoint);
    setHoveredElementId(element?.id || null);

    // Jeśli drag aktywny i najechaliśmy na nowy element → usuń go
    if (isDragging && element && !deletedDuringDrag.current.has(element.id)) {
      deletedDuringDrag.current.add(element.id);
      onElementDelete(element.id);
      setHoveredElementId(null);
    }
  }, [viewport, canvasWidth, canvasHeight, isDragging, elements, onElementDelete, gestures]);

  // Renderuj highlight dla hovered element
  const renderHighlight = () => {
    if (!hoveredElementId) return null;

    const element = elements.find(el => el.id === hoveredElementId);
    if (!element) return null;

    let box: { x: number; y: number; width: number; height: number } | null = null;

    if (element.type === 'shape') {
      const minX = Math.min(element.startX, element.endX);
      const maxX = Math.max(element.startX, element.endX);
      const minY = Math.min(element.startY, element.endY);
      const maxY = Math.max(element.startY, element.endY);
      box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } else if (element.type === 'text') {
      box = {
        x: element.x,
        y: element.y,
        width: element.width || 3,
        height: element.height || 1,
      };
    } else if (element.type === 'image') {
      box = {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      };
    } else if (element.type === 'path') {
      const xs = element.points.map((p: Point) => p.x);
      const ys = element.points.map((p: Point) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } else if (element.type === 'function') {
      box = {
        x: -element.xRange,
        y: -element.yRange,
        width: element.xRange * 2,
        height: element.yRange * 2,
      };
    }

    if (!box) return null;

    const topLeft = transformPoint({ x: box.x, y: box.y }, viewport, canvasWidth, canvasHeight);
    const bottomRight = transformPoint(
      { x: box.x + box.width, y: box.y + box.height },
      viewport,
      canvasWidth,
      canvasHeight
    );

    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;

    return (
      <div
        className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none animate-pulse"
        style={{
          left: topLeft.x,
          top: topLeft.y,
          width: width,
          height: height,
        }}
      />
    );
  };

  const cursorSizePx = 24;

  return (
    <>
      {/* Invisible overlay for wheel events */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{ touchAction: 'none' }}
      />

      {/* Interactive overlay */}
      <div
        className="absolute inset-0 z-30 pointer-events-auto"
        style={{ 
          cursor: 'none', // Ukryj domyślny kursor - mamy własny
          touchAction: 'none' 
        }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Highlight hovered element */}
      {renderHighlight()}

      {/* Custom eraser cursor */}
      {cursorPosition && (
        <div
          className="absolute pointer-events-none z-40"
          style={{
            left: cursorPosition.x - cursorSizePx / 2,
            top: cursorPosition.y - cursorSizePx / 2,
            width: cursorSizePx,
            height: cursorSizePx,
          }}
        >
          <div className="w-full h-full rounded-full border-2 border-red-500 bg-white/50 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-red-500" />
          </div>
        </div>
      )}
    </>
  );
}

