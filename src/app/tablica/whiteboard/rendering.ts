/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/rendering.ts
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - ./types (DrawingElement, DrawingPath, Shape, TextElement, FunctionPlot, ViewportTransform)
 * - ./viewport (transformPoint)
 * - ./utils (clampLineWidth, clampFontSize, evaluateExpression)
 * 
 * EKSPORTUJE:
 * - drawPath (function) - renderuje ścieżkę (pen tool)
 * - drawShape (function) - renderuje kształty (rectangle, circle, triangle, line, arrow)
 * - drawText (function) - renderuje tekst
 * - drawFunction (function) - renderuje wykres funkcji matematycznej
 * - drawElement (function) - dispatcher - wybiera odpowiednią funkcję rysującą
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główna pętla renderowania)
 * 
 * PRZEZNACZENIE:
 * Moduł renderowania elementów na canvas:
 * - Rysowanie wszystkich typów elementów (path, shape, text, function)
 * - Transformacje world → screen przy użyciu viewport
 * - Clamp dla rozmiaru linii i czcionek przy zoomie
 * - Obsługa wyrażeń matematycznych dla wykresów funkcji
 * ============================================================================
 */

import {
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot,
  ViewportTransform
} from './types';
import { transformPoint } from './viewport';
import { clampLineWidth, clampFontSize, evaluateExpression } from './utils';

/**
 * Rysuje ścieżkę (path) - linie rysowane piórem
 * WAŻNE: Używa clamp dla lineWidth!
 */
export function drawPath(
  ctx: CanvasRenderingContext2D,
  path: DrawingPath,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (path.points.length < 2) return;
  
  ctx.strokeStyle = path.color;
  ctx.lineWidth = clampLineWidth(path.width, viewport.scale); // ✅ CLAMP!
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  
  const startPoint = transformPoint(path.points[0], viewport, canvasWidth, canvasHeight);
  ctx.moveTo(startPoint.x, startPoint.y);
  
  for (let i = 1; i < path.points.length; i++) {
    const point = transformPoint(path.points[i], viewport, canvasWidth, canvasHeight);
    ctx.lineTo(point.x, point.y);
  }
  
  ctx.stroke();
}

/**
 * Rysuje kształt (shape) - prostokąt, koło, trójkąt, linia, strzałka
 * WAŻNE: Używa clamp dla strokeWidth!
 */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  const start = transformPoint({ x: shape.startX, y: shape.startY }, viewport, canvasWidth, canvasHeight);
  const end = transformPoint({ x: shape.endX, y: shape.endY }, viewport, canvasWidth, canvasHeight);
  
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = clampLineWidth(shape.strokeWidth, viewport.scale); // ✅ CLAMP!
  
  switch (shape.shapeType) {
    case 'rectangle':
      if (shape.fill) {
        ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else {
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      }
      break;
    
    case 'circle':
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      if (shape.fill) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
      break;
    
    case 'triangle':
      const midX = (start.x + end.x) / 2;
      ctx.beginPath();
      ctx.moveTo(midX, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.lineTo(start.x, end.y);
      ctx.closePath();
      if (shape.fill) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
      break;
    
    case 'line':
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      break;
    
    case 'arrow':
      const headlen = 15;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headlen * Math.cos(angle - Math.PI / 6),
        end.y - headlen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headlen * Math.cos(angle + Math.PI / 6),
        end.y - headlen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
      break;
  }
}

/**
 * Rysuje tekst (text)
 * WAŻNE: Używa clamp dla fontSize!
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  textEl: TextElement,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  const pos = transformPoint({ x: textEl.x, y: textEl.y }, viewport, canvasWidth, canvasHeight);
  ctx.fillStyle = textEl.color;
  ctx.font = `${clampFontSize(textEl.fontSize, viewport.scale)}px Arial`; // ✅ CLAMP!
  ctx.textBaseline = 'top';
  
  const lines = textEl.text.split('\n');
  const lineHeight = clampFontSize(textEl.fontSize, viewport.scale) * 1.2;
  
  lines.forEach((line, i) => {
    ctx.fillText(line, pos.x, pos.y + i * lineHeight);
  });
}

/**
 * Rysuje wykres funkcji matematycznej
 * WAŻNE: Używa clamp dla strokeWidth i dynamiczny step!
 */
export function drawFunction(
  ctx: CanvasRenderingContext2D,
  func: FunctionPlot,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.strokeStyle = func.color;
  ctx.lineWidth = clampLineWidth(func.strokeWidth, viewport.scale); // ✅ CLAMP!
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  
  let started = false;
  const step = 0.02 / viewport.scale; // Dynamiczny step
  
  for (let worldX = -func.xRange; worldX <= func.xRange; worldX += step) {
    try {
      const worldY = evaluateExpression(func.expression, worldX);
      
      if (!isFinite(worldY)) continue;
      if (Math.abs(worldY) > func.yRange) continue;
      
      const screenPos = transformPoint({ x: worldX, y: -worldY }, viewport, canvasWidth, canvasHeight);
      
      if (!started) {
        ctx.moveTo(screenPos.x, screenPos.y);
        started = true;
      } else {
        ctx.lineTo(screenPos.x, screenPos.y);
      }
    } catch (e) {
      started = false;
    }
  }
  
  if (started) {
    ctx.stroke();
  }
}

/**
 * Rysuje pojedynczy element (dispatcher)
 * Wybiera odpowiednią funkcję w zależności od typu
 */
export function drawElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (element.type === 'path') {
    drawPath(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'shape') {
    drawShape(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'text') {
    drawText(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'function') {
    drawFunction(ctx, element, viewport, canvasWidth, canvasHeight);
  }
}
