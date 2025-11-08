/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/Grid.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - ./types (ViewportTransform)
 * - ./viewport (transformPoint)
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
 * ============================================================================
 */

'use client';

import { ViewportTransform } from './types';
import { transformPoint } from './viewport';

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
  // === SIATKA W TLE ===
  ctx.lineWidth = 1;

  // Zakres widocznych kratek w świecie (co 0.5 jednostki)
  const startX = Math.floor((viewport.x - width / (2 * viewport.scale)) / 0.5) * 0.5;
  const endX = Math.ceil((viewport.x + width / (2 * viewport.scale)) / 0.5) * 0.5;
  const startY = Math.floor((viewport.y - height / (2 * viewport.scale)) / 0.5) * 0.5;
  const endY = Math.ceil((viewport.y + height / (2 * viewport.scale)) / 0.5) * 0.5;

  // Pionowe linie siatki (co 0.5 jednostki)
  for (let worldX = startX; worldX <= endX; worldX += 0.5) {
    // Co druga linia (pełne liczby) jest grubsza
    const isMainLine = worldX % 1 === 0;
    ctx.strokeStyle = isMainLine 
      ? 'rgba(200, 200, 200, 0.45)'  // Grubsza (pełne liczby: 0, 1, 2...)
      : 'rgba(200, 200, 200, 0.3)'; // Cieńsza (0.5, 1.5, 2.5...)
    
    ctx.beginPath();
    const screenPos = transformPoint({ x: worldX, y: 0 }, viewport, width, height);
    ctx.moveTo(screenPos.x, 0);
    ctx.lineTo(screenPos.x, height);
    ctx.stroke();
  }

// Poziome linie siatki (co 0.5 jednostki)
for (let worldY = startY; worldY <= endY; worldY += 0.5) {
  // Co druga linia (pełne liczby) jest grubsza
  const isMainLine = worldY % 1 === 0;
  ctx.strokeStyle = isMainLine 
    ? 'rgba(200, 200, 200, 0.45)'  // Grubsza (pełne liczby: 0, 1, 2...)
    : 'rgba(200, 200, 200, 0.3)'; // Cieńsza (0.5, 1.5, 2.5...)
  
  ctx.beginPath();
  const screenPos = transformPoint({ x: 0, y: worldY }, viewport, width, height);
  ctx.moveTo(0, screenPos.y);
  ctx.lineTo(width, screenPos.y);
  ctx.stroke();
  } 
  
  // === OSIE ===
  const origin = transformPoint({ x: 0, y: 0 }, viewport, width, height);
  
  // Oś X (czerwona) - pozioma
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, origin.y);
  ctx.lineTo(width, origin.y);
  ctx.stroke();
  
  // Oś Y (niebieska) - pionowa
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, height);
  ctx.stroke();
  
  // === PODZIAŁKA (co 1 jednostkę = 2 kratki = 100px) ===
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.font = `${Math.max(10, 12 * viewport.scale)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  // Podziałka na osi X
  const startXLabel = Math.floor((viewport.x - width / (2 * viewport.scale)));
  const endXLabel = Math.ceil((viewport.x + width / (2 * viewport.scale)));
  
  for (let worldX = startXLabel; worldX <= endXLabel; worldX += 1) {
    if (worldX === 0) continue; // Pomijamy początek
    
    const screenPos = transformPoint({ x: worldX, y: 0 }, viewport, width, height);
    
    if (screenPos.x >= 0 && screenPos.x <= width) {
      // Liczba
      ctx.fillText(worldX.toString(), screenPos.x, origin.y + 8);
      
      // Kreska na osi
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(screenPos.x, origin.y - 6);
      ctx.lineTo(screenPos.x, origin.y + 6);
      ctx.stroke();
    }
  }
  
  // Podziałka na osi Y
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  const startYLabel = Math.floor((viewport.y - height / (2 * viewport.scale)));
  const endYLabel = Math.ceil((viewport.y + height / (2 * viewport.scale)));
  
  for (let worldY = startYLabel; worldY <= endYLabel; worldY += 1) {
    if (worldY === 0) continue; // Pomijamy początek
    
    const screenPos = transformPoint({ x: 0, y: worldY }, viewport, width, height);
    
    if (screenPos.y >= 0 && screenPos.y <= height) {
      // Liczba (minus bo Y w canvas idzie w dół)
      ctx.fillText((-worldY).toString(), origin.x + 10, screenPos.y);
      
      // Kreska na osi
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(origin.x - 6, screenPos.y);
      ctx.lineTo(origin.x + 6, screenPos.y);
      ctx.stroke();
    }
  }
  
  // === PUNKT (0,0) ===
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Etykieta (0,0)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.font = `${Math.max(12, 14 * viewport.scale)}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('(0, 0)', origin.x + 8, origin.y - 8);
}
