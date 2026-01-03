/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/ShapeTool.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState)
 * - ../whiteboard/types (Point, ViewportTransform, Shape, ShapeType)
 * - ../whiteboard/viewport (inverseTransformPoint, transformPoint, zoomViewport, panViewportWithWheel, constrainViewport)
 * - ../toolbar/Toolbar (ShapeType)
 * 
 * EKSPORTUJE:
 * - ShapeTool (component) - narzędzie rysowania kształtów
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (aktywne gdy tool === 'shape')
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - używa Shape
 * - viewport.ts - używa funkcji transformacji i zoom/pan
 * - WhiteboardCanvas.tsx - dostarcza callback'i: onShapeCreate, onViewportChange
 * 
 * ⚠️ WAŻNE - WHEEL EVENTS:
 * - Overlay ma touchAction: 'none' - blokuje domyślny zoom przeglądarki
 * - onWheel obsługuje zoom (Ctrl+scroll) i pan (scroll)
 * - Współdzieli viewport z WhiteboardCanvas przez onViewportChange
 * 
 * PRZEZNACZENIE:
 * Rysowanie kształtów geometrycznych (prostokąt, koło, trójkąt, linia, strzałka).
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Point, ViewportTransform, Shape } from '../whiteboard/types';
import { inverseTransformPoint, transformPoint, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';
import { ShapeType } from '../toolbar/Toolbar';
import { useMultiTouchGestures } from '../whiteboard/useMultiTouchGestures';

interface ShapeToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  selectedShape: ShapeType;
  polygonSides?: number;
  color: string;
  lineWidth: number;
  fillShape: boolean;
  onShapeCreate: (shape: Shape) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function ShapeTool({
  viewport,
  canvasWidth,
  canvasHeight,
  selectedShape,
  polygonSides = 5,
  color,
  lineWidth,
  fillShape,
  onShapeCreate,
  onViewportChange,
}: ShapeToolProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);

  const gestures = useMultiTouchGestures({
    viewport,
    canvasWidth,
    canvasHeight,
    onViewportChange: onViewportChange || (() => {}),
  });

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

  // Pointer down - rozpocznij rysowanie kształtu
  const handlePointerDown = (e: React.PointerEvent) => {
    gestures.handlePointerDown(e);
    if (gestures.isGestureActive()) return;

    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    const newShape: Shape = {
      id: Date.now().toString(),
      type: 'shape',
      shapeType: selectedShape,
      startX: worldPoint.x,
      startY: worldPoint.y,
      endX: worldPoint.x,
      endY: worldPoint.y,
      color,
      strokeWidth: lineWidth,
      fill: fillShape,
      sides: selectedShape === 'polygon' ? polygonSides : undefined,
    };

    setCurrentShape(newShape);
    setIsDrawing(true);
  };

  // Pointer move - kontynuuj rysowanie kształtu
  const handlePointerMove = (e: React.PointerEvent) => {
    gestures.handlePointerMove(e);
    if (gestures.isGestureActive()) return;

    if (!isDrawing || !currentShape) return;

    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    setCurrentShape({
      ...currentShape,
      endX: worldPoint.x,
      endY: worldPoint.y,
    });
  };

  // Pointer up - zakończ rysowanie kształtu
  const handlePointerUp = (e: React.PointerEvent) => {
    gestures.handlePointerUp(e);

    if (isDrawing && currentShape) {
      onShapeCreate(currentShape);
    }

    setIsDrawing(false);
    setCurrentShape(null);
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

  // Render preview shape (rysowanie w trakcie)
  const renderPreviewShape = () => {
    if (!currentShape) return null;

    const start = transformPoint(
      { x: currentShape.startX, y: currentShape.startY },
      viewport,
      canvasWidth,
      canvasHeight
    );
    const end = transformPoint(
      { x: currentShape.endX, y: currentShape.endY },
      viewport,
      canvasWidth,
      canvasHeight
    );

    const width = end.x - start.x;
    const height = end.y - start.y;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const radiusX = Math.abs(width / 2);
    const radiusY = Math.abs(height / 2);

    let shapeElement: React.ReactElement | null = null;

    switch (currentShape.shapeType) {
      case 'rectangle':
        shapeElement = (
          <rect
            x={Math.min(start.x, end.x)}
            y={Math.min(start.y, end.y)}
            width={Math.abs(width)}
            height={Math.abs(height)}
            stroke={currentShape.color}
            strokeWidth={currentShape.strokeWidth}
            fill={currentShape.fill ? currentShape.color : 'none'}
          />
        );
        break;

      case 'circle':
        shapeElement = (
          <ellipse
            cx={centerX}
            cy={centerY}
            rx={radiusX}
            ry={radiusY}
            stroke={currentShape.color}
            strokeWidth={currentShape.strokeWidth}
            fill={currentShape.fill ? currentShape.color : 'none'}
          />
        );
        break;

      case 'triangle':
        const p1 = { x: centerX, y: Math.min(start.y, end.y) };
        const p2 = { x: start.x, y: Math.max(start.y, end.y) };
        const p3 = { x: end.x, y: Math.max(start.y, end.y) };
        shapeElement = (
          <polygon
            points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
            stroke={currentShape.color}
            strokeWidth={currentShape.strokeWidth}
            fill={currentShape.fill ? currentShape.color : 'none'}
          />
        );
        break;

      case 'line':
        shapeElement = (
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={currentShape.color}
            strokeWidth={currentShape.strokeWidth}
            strokeLinecap="round"
          />
        );
        break;

      case 'arrow': {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const arrowLength = 15;
        const tip = end;
        const left = {
          x: tip.x - arrowLength * Math.cos(angle - Math.PI / 6),
          y: tip.y - arrowLength * Math.sin(angle - Math.PI / 6),
        };
        const right = {
          x: tip.x - arrowLength * Math.cos(angle + Math.PI / 6),
          y: tip.y - arrowLength * Math.sin(angle + Math.PI / 6),
        };
        
        shapeElement = (
          <>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={currentShape.color}
              strokeWidth={currentShape.strokeWidth}
              strokeLinecap="round"
            />
            <polygon
              points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
              fill={currentShape.color}
            />
          </>
        );
        break;
      }

      case 'polygon': {
        // Generuj wierzchołki wielokąta
        const sides = currentShape.sides || 6;
        const polygonRadiusX = Math.abs(end.x - start.x) / 2;
        const polygonRadiusY = Math.abs(end.y - start.y) / 2;
        const polygonCenterX = (start.x + end.x) / 2;
        const polygonCenterY = (start.y + end.y) / 2;
        
        const polygonPoints: string[] = [];
        for (let i = 0; i < sides; i++) {
          const polygonAngle = (i * 2 * Math.PI) / sides - Math.PI / 2;
          const px = polygonCenterX + polygonRadiusX * Math.cos(polygonAngle);
          const py = polygonCenterY + polygonRadiusY * Math.sin(polygonAngle);
          polygonPoints.push(`${px},${py}`);
        }
        
        shapeElement = (
          <polygon
            points={polygonPoints.join(' ')}
            stroke={currentShape.color}
            strokeWidth={currentShape.strokeWidth}
            fill={currentShape.fill ? currentShape.color : 'none'}
          />
        );
        break;
      }
    }

    return (
      <svg
        className="absolute inset-0 pointer-events-none z-40"
        style={{ width: canvasWidth, height: canvasHeight }}
      >
        {shapeElement}
      </svg>
    );
  };

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: 'crosshair' }}>
      {/* Overlay dla pointer events */}
      <div
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onWheel={handleWheel}
      />

      {/* Preview shape */}
      {renderPreviewShape()}
    </div>
  );
}