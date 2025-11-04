/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/selection.ts
 * ============================================================================
 * 
 * EKSPORTUJE:
 * - getBoundingBox - oblicza prostokąt ograniczający dla elementu
 * - isPointInBoundingBox - sprawdza czy punkt jest w bounding box
 * - getResizeHandle - określa który uchwyt został kliknięty
 * - applyResize - aplikuje resize do elementu
 * - drawSelectionBox - rysuje ramkę zaznaczenia z uchwytami
 * 
 * PRZEZNACZENIE:
 * Logika SelectTool - zaznaczanie, przesuwanie, skalowanie elementów
 * ============================================================================
 */

import { DrawingElement, Point, BoundingBox, ResizeHandle, ViewportTransform } from './types';
import { transformPoint } from './viewport';

/**
 * Oblicza bounding box elementu w współrzędnych świata
 */
export function getBoundingBox(element: DrawingElement): BoundingBox | null {
  switch (element.type) {
    case 'path':
      if (element.points.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      element.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      const padding = element.width / 2;
      return { 
        x: minX - padding, 
        y: minY - padding, 
        width: maxX - minX + padding * 2, 
        height: maxY - minY + padding * 2 
      };
    
    case 'shape':
      const x = Math.min(element.startX, element.endX);
      const y = Math.min(element.startY, element.endY);
      const width = Math.abs(element.endX - element.startX);
      const height = Math.abs(element.endY - element.startY);
      return { x, y, width, height };
    
    case 'text':
      // Przybliżony rozmiar tekstu
      const lines = element.text.split('\n');
      const maxLineLength = Math.max(...lines.map(l => l.length), 1);
      const textWidth = maxLineLength * element.fontSize * 0.6;
      const textHeight = lines.length * element.fontSize * 1.2;
      return { x: element.x, y: element.y, width: textWidth, height: textHeight };
    
    case 'function':
      // Funkcja nie ma prostego bounding box - pomijamy zaznaczanie
      return null;
    
    case 'image':
      return { x: element.x, y: element.y, width: element.width, height: element.height };
    
    default:
      return null;
  }
}

/**
 * Sprawdza czy punkt (w świecie) jest w bounding box
 */
export function isPointInBoundingBox(point: Point, box: BoundingBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

/**
 * Określa który uchwyt resize został kliknięty (w ekranie)
 * Zwraca 'nw', 'ne', 'sw', 'se' lub null
 */
export function getResizeHandle(
  screenPoint: Point,
  box: BoundingBox,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): ResizeHandle {
  const handleSize = 10; // promień uchwytu w pikselach
  
  // Konwertuj rogi box ze świata na ekran
  const nw = transformPoint({ x: box.x, y: box.y }, viewport, canvasWidth, canvasHeight);
  const ne = transformPoint({ x: box.x + box.width, y: box.y }, viewport, canvasWidth, canvasHeight);
  const sw = transformPoint({ x: box.x, y: box.y + box.height }, viewport, canvasWidth, canvasHeight);
  const se = transformPoint({ x: box.x + box.width, y: box.y + box.height }, viewport, canvasWidth, canvasHeight);
  
  const dist = (p1: Point, p2: Point) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  
  if (dist(screenPoint, nw) < handleSize) return 'nw';
  if (dist(screenPoint, ne) < handleSize) return 'ne';
  if (dist(screenPoint, sw) < handleSize) return 'sw';
  if (dist(screenPoint, se) < handleSize) return 'se';
  
  return null;
}

/**
 * Aplikuje resize do elementu
 * handle - który róg ciągniemy
 * delta - zmiana w współrzędnych świata
 */
export function applyResize(
  element: DrawingElement,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number
): DrawingElement {
  if (!handle) return element;
  
  switch (element.type) {
    case 'shape': {
      let { startX, startY, endX, endY } = element;
      
      // Normalizuj współrzędne
      const minX = Math.min(startX, endX);
      const minY = Math.min(startY, endY);
      const maxX = Math.max(startX, endX);
      const maxY = Math.max(startY, endY);
      
      let newMinX = minX, newMinY = minY, newMaxX = maxX, newMaxY = maxY;
      
      if (handle === 'nw') {
        newMinX += deltaX;
        newMinY += deltaY;
      } else if (handle === 'ne') {
        newMaxX += deltaX;
        newMinY += deltaY;
      } else if (handle === 'sw') {
        newMinX += deltaX;
        newMaxY += deltaY;
      } else if (handle === 'se') {
        newMaxX += deltaX;
        newMaxY += deltaY;
      }
      
      // Zapobiegaj odwróceniu
      if (newMaxX - newMinX < 10) return element;
      if (newMaxY - newMinY < 10) return element;
      
      return {
        ...element,
        startX: newMinX,
        startY: newMinY,
        endX: newMaxX,
        endY: newMaxY
      };
    }
    
    case 'image': {
      const { x, y, width, height } = element;
      let newX = x, newY = y, newWidth = width, newHeight = height;
      
      if (handle === 'nw') {
        newX += deltaX;
        newY += deltaY;
        newWidth -= deltaX;
        newHeight -= deltaY;
      } else if (handle === 'ne') {
        newY += deltaY;
        newWidth += deltaX;
        newHeight -= deltaY;
      } else if (handle === 'sw') {
        newX += deltaX;
        newWidth -= deltaX;
        newHeight += deltaY;
      } else if (handle === 'se') {
        newWidth += deltaX;
        newHeight += deltaY;
      }
      
      if (newWidth < 20 || newHeight < 20) return element;
      
      return {
        ...element,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      };
    }
    
    case 'text': {
      // Tekst - zmiana fontSize proporcjonalnie
      const box = getBoundingBox(element);
      if (!box) return element;
      
      const oldWidth = box.width;
      const oldHeight = box.height;
      
      let scaleX = 1, scaleY = 1;
      
      if (handle === 'se') {
        scaleX = (oldWidth + deltaX) / oldWidth;
        scaleY = (oldHeight + deltaY) / oldHeight;
      } else if (handle === 'ne') {
        scaleX = (oldWidth + deltaX) / oldWidth;
        scaleY = (oldHeight - deltaY) / oldHeight;
      } else if (handle === 'sw') {
        scaleX = (oldWidth - deltaX) / oldWidth;
        scaleY = (oldHeight + deltaY) / oldHeight;
      } else if (handle === 'nw') {
        scaleX = (oldWidth - deltaX) / oldWidth;
        scaleY = (oldHeight - deltaY) / oldHeight;
      }
      
      const scale = Math.max(scaleX, scaleY);
      const newFontSize = Math.max(12, Math.min(120, element.fontSize * scale));
      
      return {
        ...element,
        fontSize: newFontSize
      };
    }
    
    default:
      return element;
  }
}

/**
 * Rysuje ramkę zaznaczenia z 4 uchwytami w rogach
 */
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  box: BoundingBox,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Konwertuj box ze świata na ekran
  const topLeft = transformPoint({ x: box.x, y: box.y }, viewport, canvasWidth, canvasHeight);
  const bottomRight = transformPoint(
    { x: box.x + box.width, y: box.y + box.height },
    viewport,
    canvasWidth,
    canvasHeight
  );
  
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;
  
  // Ramka
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(topLeft.x, topLeft.y, width, height);
  ctx.setLineDash([]);
  
  // Uchwyty w rogach
  const handleSize = 8;
  const handles = [
    { x: topLeft.x, y: topLeft.y }, // nw
    { x: bottomRight.x, y: topLeft.y }, // ne
    { x: topLeft.x, y: bottomRight.y }, // sw
    { x: bottomRight.x, y: bottomRight.y }, // se
  ];
  
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  
  handles.forEach(handle => {
    ctx.fillRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
  });
}

/**
 * Przesuwa element o deltę w świecie
 */
export function translateElement(
  element: DrawingElement,
  deltaX: number,
  deltaY: number
): DrawingElement {
  switch (element.type) {
    case 'path':
      return {
        ...element,
        points: element.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }))
      };
    
    case 'shape':
      return {
        ...element,
        startX: element.startX + deltaX,
        startY: element.startY + deltaY,
        endX: element.endX + deltaX,
        endY: element.endY + deltaY
      };
    
    case 'text':
    case 'image':
      return {
        ...element,
        x: element.x + deltaX,
        y: element.y + deltaY
      };
    
    default:
      return element;
  }
}