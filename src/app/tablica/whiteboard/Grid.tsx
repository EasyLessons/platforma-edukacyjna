/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/Grid.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - ./types (ViewportTransform)
 * 
 * EKSPORTUJE:
 * - drawGrid (function) - renderuje siatkę kartezjańską z osiami
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (renderowane jako tło przed elementami)
 * 
 * PRZEZNACZENIE:
 * Moduł rysowania siatki kartezjańskiej:
 * - Siatka co 0.5 jednostki (50px przy scale=1)
 * - Podziałka co 1 jednostkę (100px = 2 kratki)
 * - Osie X (czerwona, pozioma) i Y (niebieska, pionowa)
 * - Punkt początku (0,0) z oznaczeniem
 * - Dynamiczne dostosowanie do viewport (pan/zoom)
 * - ZOPTYMALIZOWANE: batch rendering zamiast osobnych stroke() dla każdej linii
 * ============================================================================
 */

'use client';

import { ViewportTransform } from './types';

/**
 * Rysuje siatkę kartezjańską z osiami i podziałką
 * - Siatka co 0.5 jednostki (50px)
 * - Podziałka co 1 jednostkę (100px = 2 kratki)
 * - Osie X (czerwona) i Y (niebieska)
 * - Punkt (0,0) z etykietą
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportTransform,
  width: number,
  height: number
): void {
  // === ZOPTYMALIZOWANA SIATKA W TLE ===
  // Batch rendering - grupujemy wszystkie linie tego samego typu w jeden path
  
  // WAŻNE: Zaokrąglamy viewport do uniknięcia floating point issues
  const vx = viewport.x;
  const vy = viewport.y;
  const scale = viewport.scale;
  
  // Pre-calculate transform values
  const scale100 = scale * 100; // 1 jednostka = 100px * scale
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  // Obliczamy zakres widocznych kratek w świecie (co 0.5 jednostki)
  // Dodajemy margines żeby linie nie "wyskakiwały" na krawędziach
  const worldHalfWidth = halfWidth / scale100;
  const worldHalfHeight = halfHeight / scale100;
  
  const startX = Math.floor((vx - worldHalfWidth - 1) * 2) / 2;
  const endX = Math.ceil((vx + worldHalfWidth + 1) * 2) / 2;
  const startY = Math.floor((vy - worldHalfHeight - 1) * 2) / 2;
  const endY = Math.ceil((vy + worldHalfHeight + 1) * 2) / 2;

  // Funkcja inline do transformacji - BEZ zaokrąglania, crisp lines przez imageSmoothingEnabled
  const worldToScreenX = (worldX: number) => halfWidth + (worldX - vx) * scale100;
  const worldToScreenY = (worldY: number) => halfHeight + (worldY - vy) * scale100;

  // Wyłącz antialiasing dla ostrych linii
  ctx.imageSmoothingEnabled = false;
  
  // --- Pionowe linie cieńsze (0.5, 1.5, 2.5...) ---
  ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let worldX = startX; worldX <= endX; worldX += 0.5) {
    if (Math.abs(worldX % 1) > 0.1) { // Tylko linie 0.5 (z tolerancją float)
      const screenX = worldToScreenX(worldX);
      if (screenX >= -1 && screenX <= width + 1) {
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
      }
    }
  }
  ctx.stroke();

  // --- Pionowe linie grubsze (0, 1, 2...) ---
  ctx.strokeStyle = 'rgba(200, 200, 200, 0.45)';
  ctx.beginPath();
  for (let worldX = Math.floor(startX); worldX <= Math.ceil(endX); worldX += 1) {
    const screenX = worldToScreenX(worldX);
    if (screenX >= -1 && screenX <= width + 1) {
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
    }
  }
  ctx.stroke();

  // --- Poziome linie cieńsze (0.5, 1.5, 2.5...) ---
  ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
  ctx.beginPath();
  for (let worldY = startY; worldY <= endY; worldY += 0.5) {
    if (Math.abs(worldY % 1) > 0.1) { // Tylko linie 0.5 (z tolerancją float)
      const screenY = worldToScreenY(worldY);
      if (screenY >= -1 && screenY <= height + 1) {
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
      }
    }
  }
  ctx.stroke();

  // --- Poziome linie grubsze (0, 1, 2...) ---
  ctx.strokeStyle = 'rgba(200, 200, 200, 0.45)';
  ctx.beginPath();
  for (let worldY = Math.floor(startY); worldY <= Math.ceil(endY); worldY += 1) {
    const screenY = worldToScreenY(worldY);
    if (screenY >= -1 && screenY <= height + 1) {
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
    }
  }
  ctx.stroke();
  
  // === OSIE ===
  const originX = worldToScreenX(0);
  const originY = worldToScreenY(0);
  
  // Oś X (czerwona) - pozioma
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, originY);
  ctx.lineTo(width, originY);
  ctx.stroke();
  
  // Oś Y (niebieska) - pionowa
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, height);
  ctx.stroke();
  
  // === PODZIAŁKA (co 1 jednostkę = 2 kratki = 100px) ===
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.font = `${Math.max(10, 12 * scale)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  // Zakres podziałki - używamy już obliczonych wartości
  const startXLabel = Math.floor(startX);
  const endXLabel = Math.ceil(endX);
  
  // Batch kreślenie kresek na osi X
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let worldX = startXLabel; worldX <= endXLabel; worldX += 1) {
    if (worldX === 0) continue;
    const screenX = worldToScreenX(worldX);
    if (screenX >= 0 && screenX <= width) {
      ctx.moveTo(screenX, originY - 6);
      ctx.lineTo(screenX, originY + 6);
    }
  }
  ctx.stroke();
  
  // Tekst dla podziałki X
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  for (let worldX = startXLabel; worldX <= endXLabel; worldX += 1) {
    if (worldX === 0) continue;
    const screenX = worldToScreenX(worldX);
    if (screenX >= 0 && screenX <= width) {
      ctx.fillText(worldX.toString(), screenX, originY + 8);
    }
  }
  
  // Podziałka na osi Y
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  const startYLabel = Math.floor(startY);
  const endYLabel = Math.ceil(endY);
  
  // Batch kreślenie kresek na osi Y
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let worldY = startYLabel; worldY <= endYLabel; worldY += 1) {
    if (worldY === 0) continue;
    const screenY = worldToScreenY(worldY);
    if (screenY >= 0 && screenY <= height) {
      ctx.moveTo(originX - 6, screenY);
      ctx.lineTo(originX + 6, screenY);
    }
  }
  ctx.stroke();
  
  // Tekst dla podziałki Y
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  for (let worldY = startYLabel; worldY <= endYLabel; worldY += 1) {
    if (worldY === 0) continue;
    const screenY = worldToScreenY(worldY);
    if (screenY >= 0 && screenY <= height) {
      ctx.fillText((-worldY).toString(), originX + 10, screenY);
    }
  }
  
  // === PUNKT (0,0) ===
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.beginPath();
  ctx.arc(originX, originY, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Etykieta (0,0)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.font = `${Math.max(12, 14 * scale)}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('(0, 0)', originX + 8, originY - 8);
  
  // Przywróć imageSmoothingEnabled
  ctx.imageSmoothingEnabled = true;
}
