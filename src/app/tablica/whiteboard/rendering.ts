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
 * - drawPath (function) - rysuje ścieżkę piórem
 * - drawShape (function) - rysuje kształty geometryczne
 * - drawText (function) - rysuje elementy tekstowe
 * - drawFunction (function) - rysuje wykresy funkcji
 * - drawImage (function) - rysuje obrazy
 * - drawElement (function) - GŁÓWNA funkcja - deleguje do powyższych
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główna pętla renderowania)
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - zmiana interfejsów wymaga aktualizacji funkcji draw
 * - viewport.ts - używa transformPoint do konwersji współrzędnych
 * - utils.ts - używa clamp i evaluateExpression
 * 
 * PRZEZNACZENIE:
 * Główny moduł renderowania wszystkich elementów na canvas.
 * Konwertuje współrzędne świata na ekran i rysuje z transformacjami viewport.
 * ============================================================================
 */

import {
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot,
  ImageElement,
  PDFElement,
  MarkdownNote,
  TableElement,
  ViewportTransform
} from './types';
import { transformPoint } from './viewport';
import { clampLineWidth, clampFontSize, evaluateExpression } from './utils';

/**
 * Rysuje ścieżkę (path) - linie rysowane piórem
 * WAŻNE: Używa clamp dla lineWidth!
 * Obsługuje też pojedyncze punkty (kropki)
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
  
  // Pojedynczy punkt - rysuj jako kółko (kropka)
  if (path.points.length === 1) {
    const point = transformPoint(path.points[0], viewport, canvasWidth, canvasHeight);
    ctx.fillStyle = path.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  
  ctx.strokeStyle = path.color;
  ctx.lineWidth = lineWidth;
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
    
    case 'polygon':
      // Wielokąt foremny z n bokami
      const sides = shape.sides || 5; // domyślnie pięciokąt
      const polyCenterX = (start.x + end.x) / 2;
      const polyCenterY = (start.y + end.y) / 2;
      const polyRadiusX = Math.abs(end.x - start.x) / 2;
      const polyRadiusY = Math.abs(end.y - start.y) / 2;
      
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        // Zaczynamy od góry (-90 stopni = -PI/2)
        const polyAngle = (i * 2 * Math.PI / sides) - Math.PI / 2;
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
}

/**
 * Oblicza wymaganą wysokość dla tekstu z wrappingiem
 * Zwraca liczbę linii potrzebną do zmieszczenia tekstu
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
 * Rysuje tekst (text) - NOWY: z obsługą bounding box i rich text
 * WAŻNE: Używa clamp dla fontSize!
 * Zwraca obiekt z informacją o wymaganej wysokości
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
  
  // Padding (matching textarea px-3 py-2 = 12px 8px)
  const paddingX = 12; // 12px horizontal padding (px-3 = 0.75rem = 12px)
  const paddingY = 8;  // 8px vertical padding (py-2 = 0.5rem = 8px)
  
  // 🆕 Calculate X position based on alignment and width
  let textX = pos.x + paddingX;
  if (textEl.width) {
    const boxWidth = textEl.width * viewport.scale * 100;
    const contentWidth = boxWidth - (paddingX * 2); // Subtract padding from both sides
    
    if (textAlign === 'center') {
      textX = pos.x + paddingX + contentWidth / 2;
    } else if (textAlign === 'right') {
      textX = pos.x + paddingX + contentWidth;
    }
  }
  
  // 🆕 Text wrapping jeśli jest width
  if (textEl.width) {
    const boxWidth = textEl.width * viewport.scale * 100;
    const maxWidth = boxWidth - (paddingX * 2); // Subtract padding from both sides
    
    // Calculate required lines
    const requiredLines = calculateRequiredTextLines(ctx, textEl.text, maxWidth);
    const requiredHeight = (requiredLines * lineHeight + paddingY * 2) / (viewport.scale * 100);
    const currentHeight = textEl.height || 0;
    
    // Debug info
    if (debug) {
      console.log('📏 Text sizing:', {
        id: textEl.id,
        requiredLines,
        requiredHeight: requiredHeight.toFixed(2),
        currentHeight: currentHeight.toFixed(2),
        needsExpand: requiredHeight > currentHeight,
        width: textEl.width.toFixed(2),
        text: textEl.text.substring(0, 30) + '...'
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
  
  // 🔍 DEBUG MODE: Visual feedback
  if (debug && textEl.width && textEl.height) {
    const boxWidth = textEl.width * viewport.scale * 100;
    const boxHeight = textEl.height * viewport.scale * 100;
    const maxWidth = boxWidth - (paddingX * 2);
    
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
      return { requiredHeight: requiredHeightPx / (viewport.scale * 100) };
    }
  }
  
  return {};
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
 * 🆕 Rysuje dokument PDF
 * Renderuje placeholder - faktyczne renderowanie PDF odbywa się przez Canvas API w overlay
 */
export function drawPDF(
  ctx: CanvasRenderingContext2D,
  pdf: PDFElement,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number,
  loadedPDFPages?: Map<string, HTMLCanvasElement>
): void {
  const topLeft = transformPoint({ x: pdf.x, y: pdf.y }, viewport, canvasWidth, canvasHeight);
  const bottomRight = transformPoint(
    { x: pdf.x + pdf.width, y: pdf.y + pdf.height },
    viewport,
    canvasWidth,
    canvasHeight
  );
  
  const screenWidth = bottomRight.x - topLeft.x;
  const screenHeight = bottomRight.y - topLeft.y;
  
  // Sprawdź czy PDF jest załadowany
  const pdfCanvas = loadedPDFPages?.get(pdf.id);
  if (pdfCanvas) {
    ctx.drawImage(pdfCanvas, topLeft.x, topLeft.y, screenWidth, screenHeight);
  } else {
    // Placeholder podczas ładowania
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
    
    // Ramka
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.strokeRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
    
    // Ikona PDF
    ctx.fillStyle = '#dc2626';
    ctx.font = `${Math.min(screenWidth, screenHeight) * 0.3}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PDF', topLeft.x + screenWidth / 2, topLeft.y + screenHeight / 2);
    
    // Nazwa pliku (jeśli jest)
    if (pdf.fileName) {
      ctx.font = `${Math.min(screenWidth, screenHeight) * 0.1}px Arial`;
      ctx.fillStyle = '#666';
      ctx.fillText(pdf.fileName, topLeft.x + screenWidth / 2, topLeft.y + screenHeight * 0.7);
    }
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
  loadedImages?: Map<string, HTMLImageElement>,
  debug?: boolean,
  onAutoExpand?: (elementId: string, newHeight: number) => void,
  loadedPDFPages?: Map<string, HTMLCanvasElement>
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
  } else if (element.type === 'pdf' && loadedPDFPages) {
    drawPDF(ctx, element, viewport, canvasWidth, canvasHeight, loadedPDFPages);
  } else if (element.type === 'markdown') {
    // UWAGA: Notatki markdown NIE są rysowane na canvas!
    // Są renderowane TYLKO jako HTML overlay przez MarkdownNoteView
    // Rysowanie na canvas powodowało ghosting (podwójne renderowanie)
    return;
  } else if (element.type === 'table') {
    // UWAGA: Tabele NIE są rysowane na canvas!
    // Są renderowane TYLKO jako HTML overlay przez TableView
    // Rysowanie na canvas powodowało ghosting (podwójne renderowanie)
    return;
  }
}

/**
 * Rysuje notatkę Markdown (prostokąt z ramką - treść renderowana przez React)
 * Canvas rysuje tylko kontener, treść Markdown jest renderowana przez overlay
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
  
  // Tło
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
 * Rysuje tabelę (linie siatki - treść komórek renderowana przez React overlay)
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
  
  // Tło całej tabeli
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
  
  // Tło nagłówka
  if (table.headerRow) {
    ctx.fillStyle = table.headerBgColor || '#f3f4f6';
    ctx.fillRect(topLeft.x, topLeft.y, screenWidth, cellHeight);
  }
  
  // Linie siatki
  ctx.strokeStyle = table.borderColor || '#d1d5db';
  ctx.lineWidth = 1;
  
  // Zewnętrzna ramka
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
}