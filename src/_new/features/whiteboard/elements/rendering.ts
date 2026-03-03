/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/rendering.ts
 * ============================================================================
 *
 * IMPORTUJE Z:
 * - ./types (DrawingElement, DrawingPath, Shape, TextElement, FunctionPlot, ImageElement, ViewportTransform)
 * - ./viewport (transformPoint)
 * - ./utils (clampLineWidth, clampFontSize, evaluateExpression)
 *
 * EKSPORTUJE:
 * - drawPath (function) - rysuje Ĺ›cieĹĽkÄ™ piĂłrem
 * - drawShape (function) - rysuje ksztaĹ‚ty geometryczne
 * - drawText (function) - rysuje elementy tekstowe
 * - drawFunction (function) - rysuje wykresy funkcji
 * - drawImage (function) - rysuje obrazy
 * - drawElement (function) - GĹĂ“WNA funkcja - deleguje do powyĹĽszych
 *
 * UĹ»YWANE PRZEZ:
 * - WhiteboardCanvas.tsx (gĹ‚Ăłwna pÄ™tla renderowania)
 *
 * âš ď¸Ź ZALEĹ»NOĹšCI:
 * - types.ts - zmiana interfejsĂłw wymaga aktualizacji funkcji draw
 * - viewport.ts - uĹĽywa transformPoint do konwersji wspĂłĹ‚rzÄ™dnych
 * - utils.ts - uĹĽywa clamp i evaluateExpression
 *
 * PRZEZNACZENIE:
 * GĹ‚Ăłwny moduĹ‚ renderowania wszystkich elementĂłw na canvas.
 * Konwertuje wspĂłĹ‚rzÄ™dne Ĺ›wiata na ekran i rysuje z transformacjami viewport.
 * ============================================================================
 */

import {
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot,
  ImageElement,
  MarkdownNote,
  TableElement,
  ViewportTransform,
} from '@/_new/features/whiteboard/types';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';
import { clampLineWidth, clampFontSize, evaluateExpression } from '@/_new/features/whiteboard/elements/math-eval';

/**
 * Rysuje Ĺ›cieĹĽkÄ™ (path) - linie rysowane piĂłrem
 * WAĹ»NE: UĹĽywa clamp dla lineWidth!
 * ObsĹ‚uguje teĹĽ pojedyncze punkty (kropki)
 * đź†• ObsĹ‚uguje zmiennÄ… gruboĹ›Ä‡ (pressure-sensitive) jeĹ›li path.widths jest zdefiniowane
 * đź†• ObsĹ‚uguje opacity dla highlightera
 */
export function drawPath(
  ctx: CanvasRenderingContext2D,
  path: DrawingPath,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (path.points.length === 0) return;

  const lineWidth = clampLineWidth(path.width, viewport.scale);

  // đź†• Ustaw opacity jeĹ›li zdefiniowane
  const originalAlpha = ctx.globalAlpha;
  if (path.opacity !== undefined) {
    ctx.globalAlpha = path.opacity;
  }

  // Pojedynczy punkt - rysuj jako kĂłĹ‚ko (kropka)
  if (path.points.length === 1) {
    const point = transformPoint(path.points[0], viewport, canvasWidth, canvasHeight);
    ctx.fillStyle = path.color;
    ctx.beginPath();
    const radius = path.widths && path.widths[0] 
      ? clampLineWidth(path.widths[0], viewport.scale) / 2 
      : lineWidth / 2;
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = originalAlpha; // đź†• PrzywrĂłÄ‡ opacity
    return;
  }

  ctx.strokeStyle = path.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // đź†• JeĹ›li mamy zmiennÄ… gruboĹ›Ä‡ - rysuj kaĹĽdy segment osobno
  if (path.widths && path.widths.length > 0) {
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = transformPoint(path.points[i], viewport, canvasWidth, canvasHeight);
      const p2 = transformPoint(path.points[i + 1], viewport, canvasWidth, canvasHeight);
      
      // UĹĽyj Ĺ›redniej gruboĹ›ci z dwĂłch sÄ…siednich punktĂłw
      const w1 = path.widths[i] || path.width;
      const w2 = path.widths[i + 1] || path.width;
      const avgWidth = (w1 + w2) / 2;
      
      ctx.lineWidth = clampLineWidth(avgWidth, viewport.scale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.globalAlpha = originalAlpha; // đź†• PrzywrĂłÄ‡ opacity
    return;
  }

  // StaĹ‚a gruboĹ›Ä‡ - rysuj normalnie
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  const startPoint = transformPoint(path.points[0], viewport, canvasWidth, canvasHeight);
  ctx.moveTo(startPoint.x, startPoint.y);

  for (let i = 1; i < path.points.length; i++) {
    const point = transformPoint(path.points[i], viewport, canvasWidth, canvasHeight);
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
  ctx.globalAlpha = originalAlpha; // đź†• PrzywrĂłÄ‡ opacity
}

/**
 * Rysuje ksztaĹ‚t (shape) - prostokÄ…t, koĹ‚o, trĂłjkÄ…t, linia, strzaĹ‚ka
 * WAĹ»NE: UĹĽywa clamp dla strokeWidth!
 */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  const start = transformPoint(
    { x: shape.startX, y: shape.startY },
    viewport,
    canvasWidth,
    canvasHeight
  );
  const end = transformPoint({ x: shape.endX, y: shape.endY }, viewport, canvasWidth, canvasHeight);

  // đźš« UsuniÄ™ta obsĹ‚uga rotacji dla shape - tylko dla image/text

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
      const triTopY = Math.min(start.y, end.y);
      const triBottomY = Math.max(start.y, end.y);
      ctx.beginPath();
      ctx.moveTo(midX, triTopY);
      ctx.lineTo(end.x, triBottomY);
      ctx.lineTo(start.x, triBottomY);
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

    case 'polygon':
      // WielokÄ…t foremny z n bokami
      const sides = shape.sides || 5; // domyĹ›lnie piÄ™ciokÄ…t
      const polyCenterX = (start.x + end.x) / 2;
      const polyCenterY = (start.y + end.y) / 2;
      const polyRadiusX = Math.abs(end.x - start.x) / 2;
      const polyRadiusY = Math.abs(end.y - start.y) / 2;

      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        // Zaczynamy od gĂłry (-90 stopni = -PI/2)
        const polyAngle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const px = polyCenterX + polyRadiusX * Math.cos(polyAngle);
        const py = polyCenterY + polyRadiusY * Math.sin(polyAngle);

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();

      if (shape.fill) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
      break;
  }

  // đź†• Restore context jeĹ›li byĹ‚a rotacja
  if (shape.rotation && shape.rotation !== 0) {
    ctx.restore();
  }
}

/**
 * Oblicza wymaganÄ… wysokoĹ›Ä‡ dla tekstu z wrappingiem
 * Zwraca liczbÄ™ linii potrzebnÄ… do zmieszczenia tekstu
 */
function calculateRequiredTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): number {
  const lines = text.split('\n');
  let totalLines = 0;

  lines.forEach((line) => {
    const words = line.split(' ');
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        totalLines++;
        currentLine = word;

        // Check if single word needs character wrapping
        while (ctx.measureText(currentLine).width > maxWidth) {
          let fitLength = 0;
          for (let j = 1; j <= currentLine.length; j++) {
            if (ctx.measureText(currentLine.substring(0, j)).width <= maxWidth) {
              fitLength = j;
            } else {
              break;
            }
          }
          if (fitLength === 0) fitLength = 1;
          totalLines++;
          currentLine = currentLine.substring(fitLength);
        }
      } else {
        currentLine = testLine;
      }
    });

    // Handle remaining line with character wrapping if needed
    while (currentLine && ctx.measureText(currentLine).width > maxWidth) {
      let fitLength = 0;
      for (let j = 1; j <= currentLine.length; j++) {
        if (ctx.measureText(currentLine.substring(0, j)).width <= maxWidth) {
          fitLength = j;
        } else {
          break;
        }
      }
      if (fitLength === 0) fitLength = 1;
      totalLines++;
      currentLine = currentLine.substring(fitLength);
    }

    if (currentLine) {
      totalLines++;
    }
  });

  return totalLines;
}

/**
 * Rysuje tekst (text) - NOWY: z obsĹ‚ugÄ… bounding box i rich text
 * WAĹ»NE: UĹĽywa clamp dla fontSize!
 * Zwraca obiekt z informacjÄ… o wymaganej wysokoĹ›ci
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  textEl: TextElement,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number,
  debug: boolean = false
): { requiredHeight?: number } {
  const pos = transformPoint({ x: textEl.x, y: textEl.y }, viewport, canvasWidth, canvasHeight);

  // đź†• ObsĹ‚uga rotacji
  if (textEl.rotation && textEl.rotation !== 0) {
    ctx.save();
    
    // Ĺšrodek tekstu w screen space
    const width = (textEl.width || 3) * viewport.scale * 100;
    const height = (textEl.height || 1) * viewport.scale * 100;
    const centerX = pos.x + width / 2;
    const centerY = pos.y + height / 2;
    
    ctx.translate(centerX, centerY);
    ctx.rotate(textEl.rotation);
    ctx.translate(-centerX, -centerY);
  }

  // đź†• Font styling
  const fontWeight = textEl.fontWeight || 'normal';
  const fontStyle = textEl.fontStyle || 'normal';
  const fontFamily = textEl.fontFamily || 'Arial, sans-serif';
  const fontSize = clampFontSize(textEl.fontSize, viewport.scale);

  ctx.fillStyle = textEl.color;
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';

  // đź†• Text alignment
  const textAlign = textEl.textAlign || 'left';
  ctx.textAlign = textAlign;

  const lines = textEl.text.split('\n');
  const lineHeight = fontSize * 1.4;

  // Padding (matching textarea px-3 py-2 = 12px 8px)
  const paddingX = 12; // 12px horizontal padding (px-3 = 0.75rem = 12px)
  const paddingY = 8; // 8px vertical padding (py-2 = 0.5rem = 8px)

  // đź†• Calculate X position based on alignment and width
  let textX = pos.x + paddingX;
  if (textEl.width) {
    const boxWidth = textEl.width * viewport.scale * 100;
    const contentWidth = boxWidth - paddingX * 2; // Subtract padding from both sides

    if (textAlign === 'center') {
      textX = pos.x + paddingX + contentWidth / 2;
    } else if (textAlign === 'right') {
      textX = pos.x + paddingX + contentWidth;
    }
  }

  // đź†• Text wrapping jeĹ›li jest width
  if (textEl.width) {
    const boxWidth = textEl.width * viewport.scale * 100;
    const maxWidth = boxWidth - paddingX * 2; // Subtract padding from both sides

    // Calculate required lines
    const requiredLines = calculateRequiredTextLines(ctx, textEl.text, maxWidth);
    const requiredHeight = (requiredLines * lineHeight + paddingY * 2) / (viewport.scale * 100);
    const currentHeight = textEl.height || 0;

    // Debug info
    if (debug) {
      console.log('đź“Ź Text sizing:', {
        id: textEl.id,
        requiredLines,
        requiredHeight: requiredHeight.toFixed(2),
        currentHeight: currentHeight.toFixed(2),
        needsExpand: requiredHeight > currentHeight,
        width: textEl.width.toFixed(2),
        text: textEl.text.substring(0, 30) + '...',
      });
    }

    let currentY = pos.y + paddingY;

    lines.forEach((line) => {
      const words = line.split(' ');
      let currentLine = '';

      words.forEach((word, i) => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          // Current line is full, render it
          ctx.fillText(currentLine, textX, currentY);
          currentLine = word;
          currentY += lineHeight;

          // Check if single word is too long (character-based wrapping)
          while (ctx.measureText(currentLine).width > maxWidth) {
            // Find how many characters fit
            let fitLength = 0;
            for (let j = 1; j <= currentLine.length; j++) {
              if (ctx.measureText(currentLine.substring(0, j)).width <= maxWidth) {
                fitLength = j;
              } else {
                break;
              }
            }

            if (fitLength === 0) fitLength = 1; // At least one character

            // Render the part that fits
            ctx.fillText(currentLine.substring(0, fitLength), textX, currentY);
            currentLine = currentLine.substring(fitLength);
            currentY += lineHeight;
          }
        } else {
          currentLine = testLine;
        }
      });

      // Render remaining line (with character wrapping if needed)
      while (currentLine && ctx.measureText(currentLine).width > maxWidth) {
        let fitLength = 0;
        for (let j = 1; j <= currentLine.length; j++) {
          if (ctx.measureText(currentLine.substring(0, j)).width <= maxWidth) {
            fitLength = j;
          } else {
            break;
          }
        }

        if (fitLength === 0) fitLength = 1;

        ctx.fillText(currentLine.substring(0, fitLength), textX, currentY);
        currentLine = currentLine.substring(fitLength);
        currentY += lineHeight;
      }

      if (currentLine) {
        ctx.fillText(currentLine, textX, currentY);
        currentY += lineHeight;
      }
    });
  } else {
    // Bez width - rysuj normalnie
    lines.forEach((line, i) => {
      ctx.fillText(line, textX, pos.y + paddingY + i * lineHeight);
    });
  }

  // đź”Ť DEBUG MODE: Visual feedback
  if (debug && textEl.width && textEl.height) {
    const boxWidth = textEl.width * viewport.scale * 100;
    const boxHeight = textEl.height * viewport.scale * 100;
    const maxWidth = boxWidth - paddingX * 2;

    // Calculate required height
    const requiredLines = calculateRequiredTextLines(ctx, textEl.text, maxWidth);
    const requiredHeightPx = requiredLines * lineHeight + paddingY * 2;

    // Draw current box (blue)
    ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x, pos.y, boxWidth, boxHeight);

    // Draw required box (red if needs expand, green if ok)
    const needsExpand = requiredHeightPx > boxHeight;
    ctx.strokeStyle = needsExpand ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(pos.x, pos.y, boxWidth, requiredHeightPx);
    ctx.setLineDash([]);

    // Draw label
    ctx.fillStyle = needsExpand ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 255, 0, 0.9)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Lines: ${requiredLines} | Current: ${boxHeight.toFixed(0)}px | Need: ${requiredHeightPx.toFixed(0)}px`,
      pos.x,
      pos.y - 20
    );

    // Return required height for auto-expand
    if (needsExpand) {
      if (textEl.rotation && textEl.rotation !== 0) {
        ctx.restore();
      }
      return { requiredHeight: requiredHeightPx / (viewport.scale * 100) };
    }
  }

  if (textEl.rotation && textEl.rotation !== 0) {
    ctx.restore();
  }

  return {};
}

/**
 * Rysuje wykres funkcji matematycznej
 * WAĹ»NE: UĹĽywa clamp dla strokeWidth i dynamiczny step!
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
  
  // ObsĹ‚uga linii przerywanej
  if (func.strokeDasharray) {
    const dashArray = func.strokeDasharray.split(' ').map(Number);
    ctx.setLineDash(dashArray);
  } else {
    ctx.setLineDash([]);
  }
  
  ctx.beginPath();

  let started = false;
  const step = 0.02 / viewport.scale;

  for (let worldX = -func.xRange; worldX <= func.xRange; worldX += step) {
    try {
      const worldY = evaluateExpression(func.expression, worldX);

      if (!isFinite(worldY)) continue;
      if (Math.abs(worldY) > func.yRange) continue;

      const screenPos = transformPoint(
        { x: worldX, y: -worldY },
        viewport,
        canvasWidth,
        canvasHeight
      );

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
  
  // Resetuj lineDash po narysowaniu
  ctx.setLineDash([]);
}

/**
 * đź†• Rysuje obrazek (image) - przyszĹ‚oĹ›Ä‡
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

  // đź†• ObsĹ‚uga rotacji
  if (img.rotation && img.rotation !== 0) {
    ctx.save();
    
    // Ĺšrodek obrazu w screen space
    const centerX = topLeft.x + screenWidth / 2;
    const centerY = topLeft.y + screenHeight / 2;
    
    // PrzesuĹ„ do Ĺ›rodka, obrĂłÄ‡, przesuĹ„ z powrotem
    ctx.translate(centerX, centerY);
    ctx.rotate(img.rotation);
    ctx.translate(-centerX, -centerY);
  }

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

  if (img.rotation && img.rotation !== 0) {
    ctx.restore();
  }
}

/**
 * Rysuje pojedynczy element (dispatcher)
 * Wybiera odpowiedniÄ… funkcjÄ™ w zaleĹĽnoĹ›ci od typu
 */
export function drawElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number,
  loadedImages?: Map<string, HTMLImageElement>,
  debug?: boolean,
  onAutoExpand?: (elementId: string, newHeight: number) => void,
  elements?: DrawingElement[]
): void {
  if (element.type === 'path') {
    drawPath(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'shape') {
    drawShape(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'text') {
    const result = drawText(ctx, element, viewport, canvasWidth, canvasHeight, debug);

    // Auto-expand if needed
    if (result.requiredHeight && onAutoExpand) {
      onAutoExpand(element.id, result.requiredHeight);
    }
  } else if (element.type === 'function') {
    drawFunction(ctx, element, viewport, canvasWidth, canvasHeight);
  } else if (element.type === 'image' && loadedImages) {
    drawImage(ctx, element, viewport, canvasWidth, canvasHeight, loadedImages);
  } else if (element.type === 'markdown') {
    // UWAGA: Notatki markdown NIE sÄ… rysowane na canvas!
    // SÄ… renderowane TYLKO jako HTML overlay przez MarkdownNoteView
    // Rysowanie na canvas powodowaĹ‚o ghosting (podwĂłjne renderowanie)
    return;
  } else if (element.type === 'table') {
    drawTable(ctx, element, viewport, canvasWidth, canvasHeight);
  }
}

/**
 * Rysuje notatkÄ™ Markdown (prostokÄ…t z ramkÄ… - treĹ›Ä‡ renderowana przez React)
 * Canvas rysuje tylko kontener, treĹ›Ä‡ Markdown jest renderowana przez overlay
 */
export function drawMarkdownNote(
  ctx: CanvasRenderingContext2D,
  note: MarkdownNote,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  const topLeft = transformPoint({ x: note.x, y: note.y }, viewport, canvasWidth, canvasHeight);
  const bottomRight = transformPoint(
    { x: note.x + note.width, y: note.y + note.height },
    viewport,
    canvasWidth,
    canvasHeight
  );

  const screenWidth = bottomRight.x - topLeft.x;
  const screenHeight = bottomRight.y - topLeft.y;

  // TĹ‚o
  ctx.fillStyle = note.backgroundColor || '#ffffff';
  ctx.fillRect(topLeft.x, topLeft.y, screenWidth, screenHeight);

  // Ramka
  ctx.strokeStyle = note.borderColor || '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.strokeRect(topLeft.x, topLeft.y, screenWidth, screenHeight);

  // Ikona notatki w rogu (opcjonalnie)
  if (note.isFromChatbot) {
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(topLeft.x + 12, topLeft.y + 12, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Rysuje tabelÄ™ (linie siatki - treĹ›Ä‡ komĂłrek renderowana przez React overlay)
 */
export function drawTable(
  ctx: CanvasRenderingContext2D,
  table: TableElement,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): void {
  const topLeft = transformPoint({ x: table.x, y: table.y }, viewport, canvasWidth, canvasHeight);
  const bottomRight = transformPoint(
    { x: table.x + table.width, y: table.y + table.height },
    viewport,
    canvasWidth,
    canvasHeight
  );

  const screenWidth = bottomRight.x - topLeft.x;
  const screenHeight = bottomRight.y - topLeft.y;
  const cellWidth = screenWidth / table.cols;
  const cellHeight = screenHeight / table.rows;

  // TĹ‚o caĹ‚ej tabeli
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(topLeft.x, topLeft.y, screenWidth, screenHeight);

  // TĹ‚o nagĹ‚Ăłwka
  if (table.headerRow) {
    ctx.fillStyle = table.headerBgColor || '#f3f4f6';
    ctx.fillRect(topLeft.x, topLeft.y, screenWidth, cellHeight);
  }

  // Linie siatki
  ctx.strokeStyle = table.borderColor || '#d1d5db';
  ctx.lineWidth = 1;

  // ZewnÄ™trzna ramka
  ctx.strokeRect(topLeft.x, topLeft.y, screenWidth, screenHeight);

  // Linie poziome
  for (let r = 1; r < table.rows; r++) {
    const y = topLeft.y + r * cellHeight;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, y);
    ctx.lineTo(topLeft.x + screenWidth, y);
    ctx.stroke();
  }

  // Linie pionowe
  for (let c = 1; c < table.cols; c++) {
    const x = topLeft.x + c * cellWidth;
    ctx.beginPath();
    ctx.moveTo(x, topLeft.y);
    ctx.lineTo(x, topLeft.y + screenHeight);
    ctx.stroke();
  }

  // --- Tekst komórek ---
  // fontSize w world units, przemnożone przez scale dla ekranu
  const worldFontSize = table.fontSize ?? 0.12; // fallback dla starych tabel bez fontSize
  const screenFontSize = worldFontSize * viewport.scale * 100; // scale*100 = px per world unit
  const fontSize = Math.max(10, Math.min(screenFontSize, 15)); // clamp 10-15px

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let r = 0; r < table.rows; r++) {
    for (let c = 0; c < table.cols; c++) {
      const cellText = table.cells[r]?.[c] ?? '';
      if (!cellText) continue;
      const cx = topLeft.x + c * cellWidth + cellWidth / 2;
      const cy = topLeft.y + r * cellHeight + cellHeight / 2;
      if (r === 0 && table.headerRow) {
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#111827';
      } else {
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#374151';
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(topLeft.x + c * cellWidth + 3, topLeft.y + r * cellHeight + 2, cellWidth - 6, cellHeight - 4);
      ctx.clip();
      ctx.fillText(cellText, cx, cy, cellWidth - 8);
      ctx.restore();
    }
  }
}

