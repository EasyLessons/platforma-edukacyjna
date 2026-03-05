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
import { ElementRegistry } from '@/_new/features/whiteboard/handlers/element-registry';


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
 * Rysuje pojedynczy element (dispatcher) — Strategy Pattern.
 * Zamiast if/else używa ElementRegistry: każdy typ ma własny handler.
 * Typ 'function' obsługiwany bezpośrednio (brak handlera w rejestrze).
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
  // Wykres funkcji – jedyny typ bez handlera (niezaznaczalny)
  if (element.type === 'function') {
    drawFunction(ctx, element, viewport, canvasWidth, canvasHeight);
    return;
  }

  const handler = ElementRegistry[element.type];
  if (!handler) return;

  handler.render(ctx, element, viewport, canvasWidth, canvasHeight, {
    loadedImages,
    debug,
    onAutoExpand,
  });
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
  // Pełne skalowanie wraz z viewportem - bez sztywnych limitów px!
  const fontSize = screenFontSize;

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
      
      // Obsługa wielu linii tekstu w komórce
      const lines = cellText.split('\n');
      const lineHeight = fontSize * 1.2;
      const totalTextHeight = lines.length * lineHeight;
      const startY = cy - (totalTextHeight - lineHeight) / 2;
      
      lines.forEach((line, lineIndex) => {
        const lineY = startY + lineIndex * lineHeight;
        ctx.fillText(line, cx, lineY, cellWidth - 8);
      });
      
      ctx.restore();
    }
  }
}

