'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DrawingElement, Point, ViewportTransform, ArrowElement } from '../whiteboard/types';
import {
  transformPoint,
  inverseTransformPoint,
} from '../whiteboard/viewport';

interface AnchorPoint {
  elementId: string;
  side: 'top' | 'right' | 'bottom' | 'left' | 'center';
  x: number;
  y: number;
}

interface ArrowToolProps {
  elements: DrawingElement[];
  selectedIds: Set<string>;
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  color: string;
  lineWidth: number;
  onArrowCreate: (arrow: ArrowElement) => void;
  onViewportChange: (newViewport: ViewportTransform) => void;
}

export default function ArrowTool({
  elements,
  selectedIds,
  viewport,
  canvasWidth,
  canvasHeight,
  color,
  lineWidth,
  onArrowCreate,
  onViewportChange,
}: ArrowToolProps) {
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [startAttachment, setStartAttachment] = useState<AnchorPoint | null>(null);
  const [endAttachment, setEndAttachment] = useState<AnchorPoint | null>(null);
  const [nearbyAnchors, setNearbyAnchors] = useState<AnchorPoint[]>([]);
  const [hoveredAnchor, setHoveredAnchor] = useState<AnchorPoint | null>(null);

  // Oblicz anchor points dla elementu
  const getAnchorPointsForElement = useCallback((el: DrawingElement): AnchorPoint[] => {
    const anchors: AnchorPoint[] = [];

    if (el.type === 'shape') {
      const minX = Math.min(el.startX, el.endX);
      const maxX = Math.max(el.startX, el.endX);
      const minY = Math.min(el.startY, el.endY);
      const maxY = Math.max(el.startY, el.endY);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      anchors.push(
        { elementId: el.id, side: 'top', x: centerX, y: minY - 8 },
        { elementId: el.id, side: 'right', x: maxX + 8, y: centerY },
        { elementId: el.id, side: 'bottom', x: centerX, y: maxY + 8 },
        { elementId: el.id, side: 'left', x: minX - 8, y: centerY },
        { elementId: el.id, side: 'center', x: centerX, y: centerY }
      );
    } else if (el.type === 'text' || el.type === 'image' || el.type === 'markdown' || el.type === 'table') {
      const width = el.width || 0;
      const height = el.height || 0;
      const centerX = el.x + width / 2;
      const centerY = el.y + height / 2;

      // Dla obróconych elementów oblicz rotowane anchor points
      if ((el.type === 'text' || el.type === 'image') && el.rotation && el.rotation !== 0) {
        const cos = Math.cos(el.rotation);
        const sin = Math.sin(el.rotation);
        
        const rotatePoint = (px: number, py: number) => {
          const dx = px - centerX;
          const dy = py - centerY;
          return {
            x: centerX + dx * cos - dy * sin,
            y: centerY + dx * sin + dy * cos,
          };
        };

        const top = rotatePoint(centerX, el.y - 8);
        const right = rotatePoint(el.x + width + 8, centerY);
        const bottom = rotatePoint(centerX, el.y + height + 8);
        const left = rotatePoint(el.x - 8, centerY);

        anchors.push(
          { elementId: el.id, side: 'top', x: top.x, y: top.y },
          { elementId: el.id, side: 'right', x: right.x, y: right.y },
          { elementId: el.id, side: 'bottom', x: bottom.x, y: bottom.y },
          { elementId: el.id, side: 'left', x: left.x, y: left.y },
          { elementId: el.id, side: 'center', x: centerX, y: centerY }
        );
      } else {
        anchors.push(
          { elementId: el.id, side: 'top', x: centerX, y: el.y - 8 },
          { elementId: el.id, side: 'right', x: el.x + width + 8, y: centerY },
          { elementId: el.id, side: 'bottom', x: centerX, y: el.y + height + 8 },
          { elementId: el.id, side: 'left', x: el.x - 8, y: centerY },
          { elementId: el.id, side: 'center', x: centerX, y: centerY }
        );
      }
    }

    return anchors;
  }, []);

  // Znajdź anchor points w promieniu od punktu
  const findNearbyAnchors = useCallback(
    (worldPoint: Point, radius: number = 300): AnchorPoint[] => {
      const nearby: AnchorPoint[] = [];

      elements.forEach((el) => {
        const anchors = getAnchorPointsForElement(el);
        anchors.forEach((anchor) => {
          const dist = Math.sqrt(
            Math.pow(anchor.x - worldPoint.x, 2) + Math.pow(anchor.y - worldPoint.y, 2)
          );
          if (dist <= radius) {
            nearby.push(anchor);
          }
        });
      });

      return nearby;
    },
    [elements, getAnchorPointsForElement]
  );

  // Znajdź najbliższy anchor point
  const findClosestAnchor = useCallback((worldPoint: Point, anchors: AnchorPoint[]): AnchorPoint | null => {
    if (anchors.length === 0) return null;

    let closest = anchors[0];
    let minDist = Math.sqrt(
      Math.pow(closest.x - worldPoint.x, 2) + Math.pow(closest.y - worldPoint.y, 2)
    );

    anchors.forEach((anchor) => {
      const dist = Math.sqrt(
        Math.pow(anchor.x - worldPoint.x, 2) + Math.pow(anchor.y - worldPoint.y, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        closest = anchor;
      }
    });

    // Snap tylko jeśli blisko (20px)
    return minDist < 20 ? closest : null;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    // Znajdź nearby anchors
    const nearby = findNearbyAnchors(worldPoint);
    setNearbyAnchors(nearby);

    // Sprawdź czy kliknęliśmy na anchor
    const clickedAnchor = findClosestAnchor(worldPoint, nearby);

    if (clickedAnchor) {
      setStartPoint({ x: clickedAnchor.x, y: clickedAnchor.y });
      setStartAttachment(clickedAnchor);
    } else {
      setStartPoint(worldPoint);
      setStartAttachment(null);
    }

    setCurrentPoint(worldPoint);
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    if (isDrawing && startPoint) {
      setCurrentPoint(worldPoint);

      // Znajdź nearby anchors
      const nearby = findNearbyAnchors(worldPoint);
      setNearbyAnchors(nearby);

      // Sprawdź czy jesteśmy blisko anchora
      const closestAnchor = findClosestAnchor(worldPoint, nearby);
      setEndAttachment(closestAnchor);
      setHoveredAnchor(closestAnchor);
    } else {
      // Nawet bez rysowania pokazuj nearby anchors
      const nearby = findNearbyAnchors(worldPoint);
      setNearbyAnchors(nearby);
      
      const closestAnchor = findClosestAnchor(worldPoint, nearby);
      setHoveredAnchor(closestAnchor);
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && startPoint && currentPoint) {
      // Utwórz strzałkę
      const arrow: ArrowElement = {
        id: `arrow-${Date.now()}`,
        type: 'arrow',
        startX: startAttachment ? startAttachment.x : startPoint.x,
        startY: startAttachment ? startAttachment.y : startPoint.y,
        endX: endAttachment ? endAttachment.x : currentPoint.x,
        endY: endAttachment ? endAttachment.y : currentPoint.y,
        startAttachment: startAttachment
          ? { elementId: startAttachment.elementId, side: startAttachment.side }
          : undefined,
        endAttachment: endAttachment
          ? { elementId: endAttachment.elementId, side: endAttachment.side }
          : undefined,
        color: color,
        strokeWidth: lineWidth,
        arrowType: 'smooth',
        arrowHead: 'end',
      };

      onArrowCreate(arrow);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
    setStartAttachment(null);
    setEndAttachment(null);
    setNearbyAnchors([]);
    setHoveredAnchor(null);
  };

  // Renderuj anchor points
  const renderAnchorPoints = () => {
    return nearbyAnchors.map((anchor, idx) => {
      const screenPoint = transformPoint(
        { x: anchor.x, y: anchor.y },
        viewport,
        canvasWidth,
        canvasHeight
      );

      const isHovered = hoveredAnchor?.elementId === anchor.elementId && hoveredAnchor?.side === anchor.side;

      return (
        <div
          key={`anchor-${anchor.elementId}-${anchor.side}-${idx}`}
          className={`absolute bg-blue-500 border-2 border-white rounded-full pointer-events-none z-40 transition-transform ${
            isHovered ? 'scale-125' : 'scale-100'
          }`}
          style={{
            left: screenPoint.x - 4,
            top: screenPoint.y - 4,
            width: 8,
            height: 8,
          }}
        />
      );
    });
  };

  // Renderuj podgląd strzałki
  const renderPreviewArrow = () => {
    if (!isDrawing || !startPoint || !currentPoint) return null;

    const start = transformPoint(startPoint, viewport, canvasWidth, canvasHeight);
    const end = transformPoint(
      endAttachment ? { x: endAttachment.x, y: endAttachment.y } : currentPoint,
      viewport,
      canvasWidth,
      canvasHeight
    );

    // Oblicz kąt dla grotu
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);

    const arrowHeadSize = 10;
    const arrowPoint1X = end.x - arrowHeadSize * Math.cos(angle - Math.PI / 6);
    const arrowPoint1Y = end.y - arrowHeadSize * Math.sin(angle - Math.PI / 6);
    const arrowPoint2X = end.x - arrowHeadSize * Math.cos(angle + Math.PI / 6);
    const arrowPoint2Y = end.y - arrowHeadSize * Math.sin(angle + Math.PI / 6);

    return (
      <svg
        className="absolute inset-0 pointer-events-none z-30"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Linia strzałki */}
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={color}
          strokeWidth={lineWidth}
        />
        {/* Grot strzałki */}
        <polygon
          points={`${end.x},${end.y} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
          fill={color}
        />
      </svg>
    );
  };

  return (
    <div
      className="absolute inset-0 cursor-crosshair"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {renderAnchorPoints()}
      {renderPreviewArrow()}
    </div>
  );
}
