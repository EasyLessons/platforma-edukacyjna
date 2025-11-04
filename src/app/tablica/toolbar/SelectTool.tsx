'use client';

import { useState, useCallback } from 'react';
import { Point, ViewportTransform, DrawingElement } from '../whiteboard/types';
import { transformPoint, inverseTransformPoint } from '../whiteboard/viewport';

interface SelectToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  elements: DrawingElement[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onElementUpdate: (id: string, updates: Partial<DrawingElement>) => void;
  onElementsUpdate: (updates: Map<string, Partial<DrawingElement>>) => void;
  onOperationFinish?: () => void; // Callback po zakończeniu drag/resize
  onTextEdit?: (id: string) => void; // 🆕 Callback do edycji tekstu (double-click)
}

type ResizeHandle =
  | 'nw' // north-west (top-left)
  | 'n' // north (top)
  | 'ne' // north-east (top-right)
  | 'e' // east (right)
  | 'se' // south-east (bottom-right)
  | 's' // south (bottom)
  | 'sw' // south-west (bottom-left)
  | 'w' // west (left)
  | null;

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SelectTool({
  viewport,
  canvasWidth,
  canvasHeight,
  elements,
  selectedIds,
  onSelectionChange,
  onElementUpdate,
  onElementsUpdate,
  onOperationFinish,
  onTextEdit, // 🆕
}: SelectToolProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Point | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [draggedElementsOriginal, setDraggedElementsOriginal] = useState<
    Map<string, DrawingElement>
  >(new Map());

  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [resizeOriginalBox, setResizeOriginalBox] = useState<BoundingBox | null>(null);
  const [resizeOriginalElements, setResizeOriginalElements] = useState<
    Map<string, DrawingElement>
  >(new Map());

  // Calculate bounding box for selected elements
  const getSelectionBoundingBox = useCallback((): BoundingBox | null => {
    if (selectedIds.size === 0) return null;

    const selectedElements = elements.filter((el) => selectedIds.has(el.id));
    if (selectedElements.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedElements.forEach((el) => {
      if (el.type === 'path') {
        el.points.forEach((p) => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      } else if (el.type === 'shape') {
        minX = Math.min(minX, el.startX, el.endX);
        minY = Math.min(minY, el.startY, el.endY);
        maxX = Math.max(maxX, el.startX, el.endX);
        maxY = Math.max(maxY, el.startY, el.endY);
      } else if (el.type === 'text') {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + (el.width || 3));
        maxY = Math.max(maxY, el.y + (el.height || 1));
      }
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [elements, selectedIds]);

  // Check if point is inside element
  const isPointInElement = (worldPoint: Point, element: DrawingElement): boolean => {
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
    } else if (element.type === 'path') {
      // Simple bounding box check for paths
      const xs = element.points.map((p: Point) => p.x);
      const ys = element.points.map((p: Point) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return (
        worldPoint.x >= minX &&
        worldPoint.x <= maxX &&
        worldPoint.y >= minY &&
        worldPoint.y <= maxY
      );
    }

    return false;
  };

  // Get resize handle at point
  const getResizeHandleAt = (screenPoint: Point, boundingBox: BoundingBox): ResizeHandle => {
    const box = boundingBox;
    const handleSize = 10; // px

    // Transform box corners to screen
    const topLeft = transformPoint({ x: box.x, y: box.y }, viewport, canvasWidth, canvasHeight);
    const topRight = transformPoint(
      { x: box.x + box.width, y: box.y },
      viewport,
      canvasWidth,
      canvasHeight
    );
    const bottomLeft = transformPoint(
      { x: box.x, y: box.y + box.height },
      viewport,
      canvasWidth,
      canvasHeight
    );
    const bottomRight = transformPoint(
      { x: box.x + box.width, y: box.y + box.height },
      viewport,
      canvasWidth,
      canvasHeight
    );

    const midTop = { x: (topLeft.x + topRight.x) / 2, y: topLeft.y };
    const midRight = { x: topRight.x, y: (topRight.y + bottomRight.y) / 2 };
    const midBottom = { x: (bottomLeft.x + bottomRight.x) / 2, y: bottomLeft.y };
    const midLeft = { x: topLeft.x, y: (topLeft.y + bottomLeft.y) / 2 };

    const isNear = (p1: Point, p2: Point) => {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy) < handleSize;
    };

    if (isNear(screenPoint, topLeft)) return 'nw';
    if (isNear(screenPoint, midTop)) return 'n';
    if (isNear(screenPoint, topRight)) return 'ne';
    if (isNear(screenPoint, midRight)) return 'e';
    if (isNear(screenPoint, bottomRight)) return 'se';
    if (isNear(screenPoint, midBottom)) return 's';
    if (isNear(screenPoint, bottomLeft)) return 'sw';
    if (isNear(screenPoint, midLeft)) return 'w';

    return null;
  };

  // 🆕 Double-click handler - otwiera edytor tekstu
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!onTextEdit) return;
    
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    // Znajdź kliknięty element
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      
      // Sprawdź tylko teksty
      if (el.type === 'text' && isPointInElement(worldPoint, el)) {
        onTextEdit(el.id);
        return;
      }
    }
  };

  // Mouse down handler
  const handleMouseDown = (e: React.MouseEvent) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    // Check if clicking on resize handle
    const bbox = getSelectionBoundingBox();
    if (bbox && selectedIds.size > 0) {
      const handle = getResizeHandleAt(screenPoint, bbox);
      if (handle) {
        setIsResizing(true);
        setResizeHandle(handle);
        setResizeOriginalBox(bbox);

        const originalElements = new Map<string, DrawingElement>();
        elements.forEach((el) => {
          if (selectedIds.has(el.id)) {
            originalElements.set(el.id, { ...el });
          }
        });
        setResizeOriginalElements(originalElements);
        return;
      }
    }

    // Check if clicking on selected element (start drag)
    if (selectedIds.size > 0) {
      const clickedSelected = elements.find(
        (el) => selectedIds.has(el.id) && isPointInElement(worldPoint, el)
      );

      if (clickedSelected) {
        setIsDragging(true);
        setDragStart(worldPoint);

        const originalElements = new Map<string, DrawingElement>();
        elements.forEach((el) => {
          if (selectedIds.has(el.id)) {
            originalElements.set(el.id, { ...el });
          }
        });
        setDraggedElementsOriginal(originalElements);
        return;
      }
    }

    // Check if clicking on any element (select)
    const clickedElement = elements.find((el) => isPointInElement(worldPoint, el));

    if (clickedElement) {
      if (e.shiftKey) {
        // Shift+Click = add/remove from selection
        const newSelection = new Set(selectedIds);
        if (newSelection.has(clickedElement.id)) {
          newSelection.delete(clickedElement.id);
        } else {
          newSelection.add(clickedElement.id);
        }
        onSelectionChange(newSelection);
      } else {
        // Single select
        onSelectionChange(new Set([clickedElement.id]));
      }
    } else {
      // Start selection box
      setIsSelecting(true);
      setSelectionStart(screenPoint);
      setSelectionEnd(screenPoint);
    }
  };

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    // Resizing
    if (isResizing && resizeHandle && resizeOriginalBox) {
      const deltaX = worldPoint.x - resizeOriginalBox.x;
      const deltaY = worldPoint.y - resizeOriginalBox.y;

      // Calculate scale factors based on handle
      let scaleX = 1;
      let scaleY = 1;
      let pivotX = resizeOriginalBox.x;
      let pivotY = resizeOriginalBox.y;

      if (resizeHandle.includes('e')) {
        scaleX = (worldPoint.x - resizeOriginalBox.x) / resizeOriginalBox.width;
        pivotX = resizeOriginalBox.x;
      } else if (resizeHandle.includes('w')) {
        scaleX = (resizeOriginalBox.x + resizeOriginalBox.width - worldPoint.x) / resizeOriginalBox.width;
        pivotX = resizeOriginalBox.x + resizeOriginalBox.width;
      }

      if (resizeHandle.includes('s')) {
        scaleY = (worldPoint.y - resizeOriginalBox.y) / resizeOriginalBox.height;
        pivotY = resizeOriginalBox.y;
      } else if (resizeHandle.includes('n')) {
        scaleY = (resizeOriginalBox.y + resizeOriginalBox.height - worldPoint.y) / resizeOriginalBox.height;
        pivotY = resizeOriginalBox.y + resizeOriginalBox.height;
      }

      // Apply transformations to all selected elements
      const updates = new Map<string, Partial<DrawingElement>>();

      resizeOriginalElements.forEach((originalEl, id) => {
        if (originalEl.type === 'shape') {
          const newStartX = pivotX + (originalEl.startX - pivotX) * scaleX;
          const newStartY = pivotY + (originalEl.startY - pivotY) * scaleY;
          const newEndX = pivotX + (originalEl.endX - pivotX) * scaleX;
          const newEndY = pivotY + (originalEl.endY - pivotY) * scaleY;

          updates.set(id, {
            startX: newStartX,
            startY: newStartY,
            endX: newEndX,
            endY: newEndY,
          });
        } else if (originalEl.type === 'text') {
          const newX = pivotX + (originalEl.x - pivotX) * scaleX;
          const newY = pivotY + (originalEl.y - pivotY) * scaleY;
          const newWidth = (originalEl.width || 3) * scaleX;
          const newHeight = (originalEl.height || 1) * scaleY;

          updates.set(id, {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          });
        } else if (originalEl.type === 'path') {
          const newPoints = originalEl.points.map((p: Point) => ({
            x: pivotX + (p.x - pivotX) * scaleX,
            y: pivotY + (p.y - pivotY) * scaleY,
          }));

          updates.set(id, { points: newPoints });
        }
      });

      onElementsUpdate(updates);
      return;
    }

    // Dragging
    if (isDragging && dragStart) {
      const dx = worldPoint.x - dragStart.x;
      const dy = worldPoint.y - dragStart.y;

      const updates = new Map<string, Partial<DrawingElement>>();

      draggedElementsOriginal.forEach((originalEl, id) => {
        if (originalEl.type === 'path') {
          const newPoints = originalEl.points.map((p: Point) => ({
            x: p.x + dx,
            y: p.y + dy,
          }));
          updates.set(id, { points: newPoints });
        } else if (originalEl.type === 'shape') {
          updates.set(id, {
            startX: originalEl.startX + dx,
            startY: originalEl.startY + dy,
            endX: originalEl.endX + dx,
            endY: originalEl.endY + dy,
          });
        } else if (originalEl.type === 'text') {
          updates.set(id, {
            x: originalEl.x + dx,
            y: originalEl.y + dy,
          });
        }
      });

      onElementsUpdate(updates);
      return;
    }

    // Selection box
    if (isSelecting && selectionStart) {
      setSelectionEnd(screenPoint);
    }
  };

  // Mouse up handler
  const handleMouseUp = () => {
    // Finish selection box
    if (isSelecting && selectionStart && selectionEnd) {
      const worldStart = inverseTransformPoint(selectionStart, viewport, canvasWidth, canvasHeight);
      const worldEnd = inverseTransformPoint(selectionEnd, viewport, canvasWidth, canvasHeight);

      const minX = Math.min(worldStart.x, worldEnd.x);
      const maxX = Math.max(worldStart.x, worldEnd.x);
      const minY = Math.min(worldStart.y, worldEnd.y);
      const maxY = Math.max(worldStart.y, worldEnd.y);

      // Find elements inside selection box
      const newSelection = new Set<string>();
      elements.forEach((el) => {
        if (el.type === 'shape') {
          const elMinX = Math.min(el.startX, el.endX);
          const elMaxX = Math.max(el.startX, el.endX);
          const elMinY = Math.min(el.startY, el.endY);
          const elMaxY = Math.max(el.startY, el.endY);

          if (elMinX >= minX && elMaxX <= maxX && elMinY >= minY && elMaxY <= maxY) {
            newSelection.add(el.id);
          }
        } else if (el.type === 'text') {
          const elMaxX = el.x + (el.width || 3);
          const elMaxY = el.y + (el.height || 1);

          if (el.x >= minX && elMaxX <= maxX && el.y >= minY && elMaxY <= maxY) {
            newSelection.add(el.id);
          }
        } else if (el.type === 'path') {
          const allInside = el.points.every(
            (p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
          );
          if (allInside) {
            newSelection.add(el.id);
          }
        }
      });

      onSelectionChange(newSelection);
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    
    // 🆕 Zakończenie drag - zapisz do historii
    if (isDragging && draggedElementsOriginal.size > 0) {
      onOperationFinish?.();
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDraggedElementsOriginal(new Map());
    
    // 🆕 Zakończenie resize - zapisz do historii
    if (isResizing && resizeOriginalElements.size > 0) {
      onOperationFinish?.();
    }
    
    setIsResizing(false);
    setResizeHandle(null);
    setResizeOriginalBox(null);
    setResizeOriginalElements(new Map());
  };

  // Render selection box
  const renderSelectionBox = () => {
    const bbox = getSelectionBoundingBox();
    if (!bbox || selectedIds.size === 0) return null;

    const topLeft = transformPoint({ x: bbox.x, y: bbox.y }, viewport, canvasWidth, canvasHeight);
    const bottomRight = transformPoint(
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      viewport,
      canvasWidth,
      canvasHeight
    );

    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;

    const handleSize = 10;

    return (
      <>
        {/* Selection rectangle */}
        <div
          className="absolute border-2 border-blue-500 pointer-events-none"
          style={{
            left: topLeft.x,
            top: topLeft.y,
            width: width,
            height: height,
          }}
        />

        {/* Resize handles */}
        {[
          { pos: 'nw', x: topLeft.x, y: topLeft.y },
          { pos: 'n', x: topLeft.x + width / 2, y: topLeft.y },
          { pos: 'ne', x: topLeft.x + width, y: topLeft.y },
          { pos: 'e', x: topLeft.x + width, y: topLeft.y + height / 2 },
          { pos: 'se', x: topLeft.x + width, y: topLeft.y + height },
          { pos: 's', x: topLeft.x + width / 2, y: topLeft.y + height },
          { pos: 'sw', x: topLeft.x, y: topLeft.y + height },
          { pos: 'w', x: topLeft.x, y: topLeft.y + height / 2 },
        ].map(({ pos, x, y }) => (
          <div
            key={pos}
            className="absolute bg-white border-2 border-blue-500 rounded-full cursor-pointer"
            style={{
              left: x - handleSize / 2,
              top: y - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor:
                pos === 'nw' || pos === 'se'
                  ? 'nwse-resize'
                  : pos === 'ne' || pos === 'sw'
                  ? 'nesw-resize'
                  : pos === 'n' || pos === 's'
                  ? 'ns-resize'
                  : 'ew-resize',
            }}
          />
        ))}
      </>
    );
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ cursor: 'default' }}
    >
      {/* Invisible overlay for mouse events */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
      {/* Active selection box */}
      {isSelecting && selectionStart && selectionEnd && (
        <div
          className="absolute border-2 border-dashed border-blue-500 bg-blue-50/20 pointer-events-none"
          style={{
            left: Math.min(selectionStart.x, selectionEnd.x),
            top: Math.min(selectionStart.y, selectionEnd.y),
            width: Math.abs(selectionEnd.x - selectionStart.x),
            height: Math.abs(selectionEnd.y - selectionStart.y),
          }}
        />
      )}

      {/* Selection bounding box + handles */}
      {renderSelectionBox()}
    </div>
  );
}