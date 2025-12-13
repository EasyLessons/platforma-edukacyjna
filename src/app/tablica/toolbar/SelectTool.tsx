/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/SelectTool.tsx
 * ============================================================================
 * 
 * ✅ POPRAWKI:
 * - Używamy newBoxX/newBoxY do obliczania pivotu (KRYTYCZNE!)
 * - Skalujemy fontSize dla tekstów (nie tylko width/height)
 * - Tylko 4 rogi (nw, ne, se, sw)
 * - MIN_SIZE = 0.1 zapobiega znikaniu elementów
 * ============================================================================
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Point, ViewportTransform, DrawingElement } from '../whiteboard/types';
import { transformPoint, inverseTransformPoint, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';
import { TextMiniToolbar } from './TextMiniToolbar';
import { SelectionPropertiesPanel } from './SelectionPropertiesPanel';

interface SelectToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  elements: DrawingElement[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onElementUpdate: (id: string, updates: Partial<DrawingElement>) => void;
  onElementUpdateWithHistory?: (id: string, updates: Partial<DrawingElement>) => void;
  onElementsUpdate: (updates: Map<string, Partial<DrawingElement>>) => void;
  onOperationFinish?: () => void;
  onTextEdit?: (id: string) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

type ResizeHandle =
  | 'nw'
  | 'ne'
  | 'se'
  | 'sw'
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
  onElementUpdateWithHistory,
  onElementsUpdate,
  onOperationFinish,
  onTextEdit,
  onViewportChange,
}: SelectToolProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Point | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [draggedElementsOriginal, setDraggedElementsOriginal] = useState<Map<string, DrawingElement>>(new Map());

  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [resizeOriginalBox, setResizeOriginalBox] = useState<BoundingBox | null>(null);
  const [resizeOriginalElements, setResizeOriginalElements] = useState<Map<string, DrawingElement>>(new Map());

  const overlayRef = useRef<HTMLDivElement>(null);

  // 🆕 Natywny wheel listener z { passive: false }
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

  // 🔥 KRYTYCZNE: Global mouseup/mousemove dla resize/drag
  useEffect(() => {
    if (!isResizing && !isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const screenPoint = { x: e.clientX, y: e.clientY };
      const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

      if (isResizing && resizeHandle && resizeOriginalBox) {
        const currentWorldX = worldPoint.x;
        const currentWorldY = worldPoint.y;
        
        let newBoxX = resizeOriginalBox.x;
        let newBoxY = resizeOriginalBox.y;
        let newBoxWidth = resizeOriginalBox.width;
        let newBoxHeight = resizeOriginalBox.height;
        
        const MIN_SIZE = 0.1;
        
        if (resizeHandle === 'se') {
          newBoxWidth = Math.max(MIN_SIZE, currentWorldX - resizeOriginalBox.x);
          newBoxHeight = Math.max(MIN_SIZE, currentWorldY - resizeOriginalBox.y);
        } else if (resizeHandle === 'sw') {
          const originalRight = resizeOriginalBox.x + resizeOriginalBox.width;
          newBoxWidth = Math.max(MIN_SIZE, originalRight - currentWorldX);
          newBoxX = originalRight - newBoxWidth;
          newBoxHeight = Math.max(MIN_SIZE, currentWorldY - resizeOriginalBox.y);
        } else if (resizeHandle === 'ne') {
          newBoxWidth = Math.max(MIN_SIZE, currentWorldX - resizeOriginalBox.x);
          const originalBottom = resizeOriginalBox.y + resizeOriginalBox.height;
          newBoxHeight = Math.max(MIN_SIZE, originalBottom - currentWorldY);
          newBoxY = originalBottom - newBoxHeight;
        } else if (resizeHandle === 'nw') {
          const originalRight = resizeOriginalBox.x + resizeOriginalBox.width;
          const originalBottom = resizeOriginalBox.y + resizeOriginalBox.height;
          newBoxWidth = Math.max(MIN_SIZE, originalRight - currentWorldX);
          newBoxX = originalRight - newBoxWidth;
          newBoxHeight = Math.max(MIN_SIZE, originalBottom - currentWorldY);
          newBoxY = originalBottom - newBoxHeight;
        }
        
        const scaleX = newBoxWidth / resizeOriginalBox.width;
        const scaleY = newBoxHeight / resizeOriginalBox.height;
        
        // 🔥 POPRAWKA: Pivot to ORYGINALNY przeciwległy róg, nie nowy!
        let pivotX: number;
        let pivotY: number;
        
        if (resizeHandle === 'se') {
          // Lewy górny róg (oryginalny)
          pivotX = resizeOriginalBox.x;
          pivotY = resizeOriginalBox.y;
        } else if (resizeHandle === 'sw') {
          // Prawy górny róg (oryginalny)
          pivotX = resizeOriginalBox.x + resizeOriginalBox.width;
          pivotY = resizeOriginalBox.y;
        } else if (resizeHandle === 'ne') {
          // Lewy dolny róg (oryginalny)
          pivotX = resizeOriginalBox.x;
          pivotY = resizeOriginalBox.y + resizeOriginalBox.height;
        } else if (resizeHandle === 'nw') {
          // Prawy dolny róg (oryginalny)
          pivotX = resizeOriginalBox.x + resizeOriginalBox.width;
          pivotY = resizeOriginalBox.y + resizeOriginalBox.height;
        } else {
          // Fallback (nie powinno się zdarzyć)
          pivotX = resizeOriginalBox.x;
          pivotY = resizeOriginalBox.y;
        }
        
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
            
            const avgScale = (scaleX + scaleY) / 2;
            const newFontSize = originalEl.fontSize * avgScale;

            updates.set(id, {
              x: newX,
              y: newY,
              width: Math.max(MIN_SIZE, newWidth),
              height: Math.max(MIN_SIZE, newHeight),
              fontSize: Math.max(8, Math.min(120, newFontSize)),
            });
          } else if (originalEl.type === 'image') {
            const newX = pivotX + (originalEl.x - pivotX) * scaleX;
            const newY = pivotY + (originalEl.y - pivotY) * scaleY;
            const newWidth = originalEl.width * scaleX;
            const newHeight = originalEl.height * scaleY;

            updates.set(id, {
              x: newX,
              y: newY,
              width: Math.max(MIN_SIZE, newWidth),
              height: Math.max(MIN_SIZE, newHeight),
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
      } else if (isDragging && dragStart) {
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
          } else if (originalEl.type === 'image') {
            updates.set(id, {
              x: originalEl.x + dx,
              y: originalEl.y + dy,
            });
          }
        });

        onElementsUpdate(updates);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging && draggedElementsOriginal.size > 0) {
        onOperationFinish?.();
      }
      
      if (isResizing && resizeOriginalElements.size > 0) {
        onOperationFinish?.();
      }
      
      setIsDragging(false);
      setDragStart(null);
      setDraggedElementsOriginal(new Map());
      
      setIsResizing(false);
      setResizeHandle(null);
      setResizeOriginalBox(null);
      setResizeOriginalElements(new Map());
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isResizing, isDragging, resizeHandle, resizeOriginalBox, resizeOriginalElements, dragStart, draggedElementsOriginal, viewport, canvasWidth, canvasHeight, onElementsUpdate, onOperationFinish]);

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
      } else if (el.type === 'image') {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      }
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [elements, selectedIds]);

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
    } else if (element.type === 'image') {
      return (
        worldPoint.x >= element.x &&
        worldPoint.x <= element.x + element.width &&
        worldPoint.y >= element.y &&
        worldPoint.y <= element.y + element.height
      );
    } else if (element.type === 'path') {
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

  const getResizeHandleAt = (screenPoint: Point, boundingBox: BoundingBox): ResizeHandle => {
    const box = boundingBox;
    const handleSize = 10;

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

    const isNear = (p1: Point, p2: Point) => {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy) < handleSize;
    };

    if (isNear(screenPoint, topLeft)) return 'nw';
    if (isNear(screenPoint, topRight)) return 'ne';
    if (isNear(screenPoint, bottomRight)) return 'se';
    if (isNear(screenPoint, bottomLeft)) return 'sw';

    return null;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!onTextEdit) return;
    
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      
      if (el.type === 'text' && isPointInElement(worldPoint, el)) {
        onTextEdit(el.id);
        return;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

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

    const clickedElement = elements.find((el) => isPointInElement(worldPoint, el));

    if (clickedElement) {
      if (e.shiftKey) {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(clickedElement.id)) {
          newSelection.delete(clickedElement.id);
        } else {
          newSelection.add(clickedElement.id);
        }
        onSelectionChange(newSelection);
      } else {
        onSelectionChange(new Set([clickedElement.id]));
      }
    } else {
      setIsSelecting(true);
      setSelectionStart(screenPoint);
      setSelectionEnd(screenPoint);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Tylko dla zaznaczania obszaru - resize/drag obsługiwane przez global listener
    if (isSelecting && selectionStart) {
      setSelectionEnd({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    // Tylko dla zaznaczania obszaru - resize/drag mouseup obsługiwane przez global listener
    if (isSelecting && selectionStart && selectionEnd) {
      const worldStart = inverseTransformPoint(selectionStart, viewport, canvasWidth, canvasHeight);
      const worldEnd = inverseTransformPoint(selectionEnd, viewport, canvasWidth, canvasHeight);

      const minX = Math.min(worldStart.x, worldEnd.x);
      const maxX = Math.max(worldStart.x, worldEnd.x);
      const minY = Math.min(worldStart.y, worldEnd.y);
      const maxY = Math.max(worldStart.y, worldEnd.y);

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
        } else if (el.type === 'image') {
          const elMaxX = el.x + el.width;
          const elMaxY = el.y + el.height;

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
  };

  const renderTextToolbar = () => {
    if (selectedIds.size !== 1 || !onElementUpdateWithHistory) return null;
    
    const selectedId = Array.from(selectedIds)[0];
    const selectedElement = elements.find(el => el.id === selectedId);
    
    if (!selectedElement || selectedElement.type !== 'text') return null;
    
    const textElement = selectedElement;
    
    const topLeft = transformPoint(
      { x: textElement.x, y: textElement.y },
      viewport,
      canvasWidth,
      canvasHeight
    );
    
    return (
      <TextMiniToolbar
        style={{
          fontSize: textElement.fontSize,
          color: textElement.color,
          fontWeight: textElement.fontWeight || 'normal',
          fontStyle: textElement.fontStyle || 'normal',
          textAlign: textElement.textAlign || 'left',
        }}
        onChange={(updates) => onElementUpdateWithHistory(selectedId, updates)}
        position={topLeft}
        className="pointer-events-auto"
      />
    );
  };

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
        <div
          className="absolute border-2 z-40 border-blue-500 pointer-events-none"
          style={{
            left: topLeft.x,
            top: topLeft.y,
            width: width,
            height: height,
          }}
        />

        {[
          { pos: 'nw', x: topLeft.x, y: topLeft.y, cursor: 'nwse-resize' },
          { pos: 'ne', x: topLeft.x + width, y: topLeft.y, cursor: 'nesw-resize' },
          { pos: 'se', x: topLeft.x + width, y: topLeft.y + height, cursor: 'nwse-resize' },
          { pos: 'sw', x: topLeft.x, y: topLeft.y + height, cursor: 'nesw-resize' },
        ].map(({ pos, x, y, cursor }) => (
          <div
            key={pos}
            className="absolute bg-white z-50 border-2 border-blue-500 rounded-full pointer-events-auto"
            style={{
              left: x - handleSize / 2,
              top: y - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: cursor,
            }}
            onMouseDown={(e) => {
              e.stopPropagation(); // 🔥 KRYTYCZNE: zatrzymaj propagację do interactive overlay!
              setIsResizing(true);
              setResizeHandle(pos as ResizeHandle);
              setResizeOriginalBox(bbox);

              const originalElements = new Map<string, DrawingElement>();
              elements.forEach((el) => {
                if (selectedIds.has(el.id)) {
                  originalElements.set(el.id, { ...el });
                }
              });
              setResizeOriginalElements(originalElements);
            }}
          />
        ))}
      </>
    );
  };

  // Renderuj panel właściwości dla zaznaczonych kształtów/ścieżek
  const renderPropertiesPanel = () => {
    if (selectedIds.size === 0 || !onElementUpdateWithHistory) return null;
    
    // Sprawdź czy są zaznaczone elementy typu shape lub path (nie text)
    const selectedElements = elements.filter(el => selectedIds.has(el.id));
    const hasEditableElements = selectedElements.some(
      el => el.type === 'shape' || el.type === 'path'
    );
    
    // Nie pokazuj jeśli zaznaczony jest tylko tekst
    const onlyText = selectedElements.every(el => el.type === 'text');
    if (!hasEditableElements || onlyText) return null;
    
    // Oblicz pozycję panelu - nad bounding box
    const bbox = getSelectionBoundingBox();
    if (!bbox) return null;
    
    const topCenter = transformPoint(
      { x: bbox.x + bbox.width / 2, y: bbox.y },
      viewport,
      canvasWidth,
      canvasHeight
    );
    
    return (
      <SelectionPropertiesPanel
        elements={elements}
        selectedIds={selectedIds}
        position={topCenter}
        onElementUpdate={onElementUpdateWithHistory}
      />
    );
  };

 return (
    <>
      {/* Invisible overlay for wheel events only */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{ touchAction: 'none' }}
      />
      
      {/* Interactive overlay for mouse events */}
      <div
        className="absolute inset-0 z-30 pointer-events-auto"
        style={{ cursor: 'default', touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
      
      {isSelecting && selectionStart && selectionEnd && (
        <div
          className="absolute border-2 z-40 border-dashed border-blue-500 bg-blue-50/20 pointer-events-none"
          style={{
            left: Math.min(selectionStart.x, selectionEnd.x),
            top: Math.min(selectionStart.y, selectionEnd.y),
            width: Math.abs(selectionEnd.x - selectionStart.x),
            height: Math.abs(selectionEnd.y - selectionStart.y),
          }}
        />
      )}

      {renderTextToolbar()}
      {renderPropertiesPanel()}
      {renderSelectionBox()}
    </>
  );
}