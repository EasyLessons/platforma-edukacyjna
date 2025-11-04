import {
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot,
  ImageElement,
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
  ctx.lineWidth = clampLineWidth(path.width, viewport.scale);
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
  ctx.lineWidth = clampLineWidth(shape.strokeWidth, viewport.scale);
  
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
 * Rysuje tekst (text) - NOWY: z obsługą bounding box i rich text
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
  
  // 🆕 Font styling
  const fontWeight = textEl.fontWeight || 'normal';
  const fontStyle = textEl.fontStyle || 'normal';
  const fontFamily = textEl.fontFamily || 'Arial, sans-serif';
  const fontSize = clampFontSize(textEl.fontSize, viewport.scale);
  
  ctx.fillStyle = textEl.color;
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  
  // 🆕 Text alignment
  const textAlign = textEl.textAlign || 'left';
  ctx.textAlign = textAlign;
  
  const lines = textEl.text.split('\n');
  const lineHeight = fontSize * 1.4;
  
  // 🆕 Calculate X offset based on alignment and width
  let xOffset = 0;
  if (textEl.width) {
    const boxWidth = textEl.width * viewport.scale * 100;
    if (textAlign === 'center') {
      xOffset = boxWidth / 2;
    } else if (textAlign === 'right') {
      xOffset = boxWidth;
    }
  }
  
  // 🆕 Text wrapping jeśli jest width
  if (textEl.width) {
    const maxWidth = textEl.width * viewport.scale * 100;
    let currentY = pos.y;
    
    lines.forEach((line) => {
      const words = line.split(' ');
      let currentLine = '';
      
      words.forEach((word, i) => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          ctx.fillText(currentLine, pos.x + xOffset, currentY);
          currentLine = word;
          currentY += lineHeight;
        } else {
          currentLine = testLine;
        }
      });
      
      if (currentLine) {
        ctx.fillText(currentLine, pos.x + xOffset, currentY);
        currentY += lineHeight;
      }
    });
  } else {
    // Bez width - rysuj normalnie
    lines.forEach((line, i) => {
      ctx.fillText(line, pos.x + xOffset, pos.y + i * lineHeight);
    });
  }
  
  // 🆕 DEBUG: rysuj bounding box (opcjonalnie - zakomentuj w produkcji)
  // if (textEl.width && textEl.height) {
  //   const boxWidth = textEl.width * viewport.scale * 100;
  //   const boxHeight = textEl.height * viewport.scale * 100;
  //   ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
  //   ctx.lineWidth = 1;
  //   ctx.strokeRect(pos.x, pos.y, boxWidth, boxHeight);
  // }
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
  ctx.lineWidth = clampLineWidth(func.strokeWidth, viewport.scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  
  let started = false;
  const step = 0.02 / viewport.scale;
  
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
 * 🆕 Rysuje obrazek (image) - przyszłość
 */
export function drawImage(
  ctx: CanvasRenderingContext2D,
  img: ImageElement,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number,
  loadedImages: Map<string, HTMLImageElement>
): void {
  const topLeft = transformPoint({ x: img.x, y: img.y }, viewport, canvasWidth, canvasHeight);
  const bottomRight = transformPoint(
    { x: img.x + img.width, y: img.y + img.height },
    viewport,
    canvasWidth,
    canvasHeight
  );
  
  const screenWidth = bottomRight.x - topLeft.x;
  const screenHeight = bottomRight.y - topLeft.y;
  
  const htmlImg = loadedImages.get(img.id);
  if (htmlImg && htmlImg.complete) {
    ctx.drawImage(htmlImg, topLeft.x, topLeft.y, screenWidth, screenHeight);
  } else {
    // Placeholder while loading
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
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
  canvasHeight: number,
  loadedImages?: Map<string, HTMLImageElement>
): void {
  if (element.type === 'path') {
    drawPath(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'shape') {
    drawShape(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'text') {
    drawText(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'function') {
    drawFunction(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'image' && loadedImages) {
    drawImage(ctx, element, viewport, canvasWidth, canvasHeight, loadedImages);
  }
}