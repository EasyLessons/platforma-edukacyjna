/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/viewport.ts
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - ./types (Point, ViewportTransform)
 * 
 * EKSPORTUJE:
 * - transformPoint (function) - world coords → screen coords
 * - inverseTransformPoint (function) - screen coords → world coords
 * - panViewportWithMouse (function) - przesuwanie myszką
 * - panViewportWithWheel (function) - przesuwanie touchpadem (2 palce)
 * - zoomViewport (function) - zoom pinch (2 palce do/od siebie)
 * - constrainViewport (function) - ograniczenia viewport (obecnie brak)
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (obsługa myszy/touchpada)
 * - rendering.ts (transformacje przy renderowaniu)
 * - Grid.tsx (transformacje siatki)
 * 
 * PRZEZNACZENIE:
 * Moduł transformacji współrzędnych i viewport management:
 * - Konwersja między współrzędnymi świata i ekranu
 * - Pan (przesuwanie) myszką i touchpadem
 * - Zoom z zachowaniem punktu pod kursorem
 * - Skala: 100px = 1 jednostka matematyczna (2 kratki = 1 jednostka)
 * ============================================================================
 */

import { Point, ViewportTransform } from './types';

/**
 * Transform: world coordinates → screen coordinates
 * WAŻNE: 100px = 1 jednostka matematyczna (2 kratki = 1 jednostka)
 */
export function transformPoint(
  point: Point,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const scale = viewport.scale * 100; // WAŻNE: *100
  
  return {
    x: (point.x - viewport.x) * scale + centerX,
    y: (point.y - viewport.y) * scale + centerY
  };
}

/**
 * Transform: screen coordinates → world coordinates
 * Odwrotność transformPoint
 */
export function inverseTransformPoint(
  point: Point,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const scale = viewport.scale * 100;
  
  return {
    x: (point.x - centerX) / scale + viewport.x,
    y: (point.y - centerY) / scale + viewport.y
  };
}

/**
 * Pan viewport z myszką (przytrzymanie środkowego przycisku lub Ctrl+LMB)
 * mousePanSpeed = 1 (wolniejsze przesuwanie)
 */
export function panViewportWithMouse(
  viewport: ViewportTransform,
  dx: number,
  dy: number
): ViewportTransform {
  const mousePanSpeed = 1;
  return {
    ...viewport,
    x: viewport.x - (dx * mousePanSpeed) / (viewport.scale * 100),
    y: viewport.y - (dy * mousePanSpeed) / (viewport.scale * 100)
  };
}

/**
 * Pan viewport z touchpadem (wheel bez ctrlKey)
 * Dwa palce: przesuwanie w lewo/prawo/góra/dół
 */
export function panViewportWithWheel(
  viewport: ViewportTransform,
  deltaX: number,
  deltaY: number
): ViewportTransform {
  const panSpeed = 1.0;
  const dx = deltaX * panSpeed;
  const dy = deltaY * panSpeed;
  
  return {
    ...viewport,
    x: viewport.x + dx / (viewport.scale * 100),
    y: viewport.y + dy / (viewport.scale * 100)
  };
}

/**
 * Zoom viewport (pinch gesture - wheel z ctrlKey)
 * Dwa palce: do siebie/od siebie
 * Zoom zachowuje punkt pod myszką
 */
export function zoomViewport(
  viewport: ViewportTransform,
  deltaY: number,
  mouseX: number,
  mouseY: number,
  canvasWidth: number,
  canvasHeight: number
): ViewportTransform {
  const zoomIntensity = 0.1;
  const delta = -deltaY;
  const scaleChange = 1 + (delta > 0 ? zoomIntensity : -zoomIntensity);
  
  const oldScale = viewport.scale;
  const newScale = Math.min(Math.max(oldScale * scaleChange, 0.2), 5.0);
  
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const mouseRelX = mouseX - centerX;
  const mouseRelY = mouseY - centerY;
  
  // POPRAWKA: 100px = 1 jednostka
  const worldX = viewport.x + mouseRelX / (oldScale * 100);
  const worldY = viewport.y + mouseRelY / (oldScale * 100);
  
  const newViewportX = worldX - mouseRelX / (newScale * 100);
  const newViewportY = worldY - mouseRelY / (newScale * 100);
  
  return {
    x: newViewportX,
    y: newViewportY,
    scale: newScale
  };
}

/**
 * Constrain viewport (nieskończona tablica - pusty)
 * Brak ograniczeń - pełna swoboda
 */
export function constrainViewport(viewport: ViewportTransform): ViewportTransform {
  return viewport;
}
