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

import { Point, ViewportTransform, MomentumState } from './types';

const MOMENTUM_FRICTION = 0.9; // Tarcie - im wyższe, tym dłużej się ślizga
const MOMENTUM_THRESHOLD = 0.001; // Prędkość poniżej której zatrzymujemy
const MAX_MOMENTUM_VELOCITY = 1; // Maksymalna prędkość

// 🆕 Funkcja do aktualizacji momentum
export const updateMomentum = (
  momentum: MomentumState,
  currentTime: number
): { momentum: MomentumState; viewport: { x: number; y: number } | null } => {
  if (!momentum.isActive) {
    return { momentum, viewport: null };
  }

  const deltaTime = (currentTime - momentum.lastTimestamp) / 16; // Normalizuj do 60fps

  // Zastosuj tarcie
  const newVelocityX = momentum.velocityX * Math.pow(MOMENTUM_FRICTION, deltaTime);
  const newVelocityY = momentum.velocityY * Math.pow(MOMENTUM_FRICTION, deltaTime);

  // Sprawdź czy prędkość jest poniżej progu zatrzymania
  const speed = Math.sqrt(newVelocityX * newVelocityX + newVelocityY * newVelocityY);
  if (speed < MOMENTUM_THRESHOLD) {
    return {
      momentum: { ...momentum, isActive: false, velocityX: 0, velocityY: 0 },
      viewport: null,
    };
  }

  // Oblicz przesunięcie viewport na podstawie prędkości
  const viewportChange = {
    x: newVelocityX * deltaTime,
    y: newVelocityY * deltaTime,
  };

  return {
    momentum: {
      ...momentum,
      velocityX: newVelocityX,
      velocityY: newVelocityY,
      lastTimestamp: currentTime,
    },
    viewport: viewportChange,
  };
};

// 🆕 Funkcja do uruchomienia momentum
export const startMomentum = (
  momentum: MomentumState,
  velocityX: number,
  velocityY: number
): MomentumState => {
  // Ogranicz maksymalną prędkość
  const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
  if (speed > MAX_MOMENTUM_VELOCITY) {
    const scale = MAX_MOMENTUM_VELOCITY / speed;
    velocityX *= scale;
    velocityY *= scale;
  }

  return {
    velocityX,
    velocityY,
    isActive: true,
    lastTimestamp: performance.now(),
  };
};

// 🆕 Funkcja do zatrzymania momentum
export const stopMomentum = (momentum: MomentumState): MomentumState => {
  return {
    ...momentum,
    isActive: false,
    velocityX: 0,
    velocityY: 0,
  };
};

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
    y: (point.y - viewport.y) * scale + centerY,
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
    y: (point.y - centerY) / scale + viewport.y,
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
    y: viewport.y - (dy * mousePanSpeed) / (viewport.scale * 100),
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
    y: viewport.y + dy / (viewport.scale * 100),
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
    scale: newScale,
  };
}

/**
 * Constrain viewport (nieskończona tablica - pusty)
 * Brak ograniczeń - pełna swoboda
 */
export function constrainViewport(viewport: ViewportTransform): ViewportTransform {
  return viewport;
}

/**
 * 🆕 VIEWPORT CULLING - sprawdza czy element jest widoczny w viewport
 * Zwraca true jeśli element (lub jego część) jest w widocznym obszarze
 *
 * OPTYMALIZACJA: Elementy poza ekranem nie są renderowane
 *
 * @param elementX - pozycja X elementu (world coords)
 * @param elementY - pozycja Y elementu (world coords)
 * @param elementWidth - szerokość elementu (world coords)
 * @param elementHeight - wysokość elementu (world coords)
 * @param viewport - aktualny viewport
 * @param canvasWidth - szerokość canvas w px
 * @param canvasHeight - wysokość canvas w px
 * @param margin - margines w px (domyślnie 100) - elementy tuż za ekranem są renderowane
 */
export function isElementInViewport(
  elementX: number,
  elementY: number,
  elementWidth: number,
  elementHeight: number,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number,
  margin: number = 100
): boolean {
  // Transformuj rogi elementu do screen coordinates
  const topLeft = transformPoint({ x: elementX, y: elementY }, viewport, canvasWidth, canvasHeight);

  const bottomRight = transformPoint(
    { x: elementX + elementWidth, y: elementY + elementHeight },
    viewport,
    canvasWidth,
    canvasHeight
  );

  // Sprawdź czy prostokąt elementu przecina się z prostokątem ekranu (+ margines)
  const screenLeft = -margin;
  const screenTop = -margin;
  const screenRight = canvasWidth + margin;
  const screenBottom = canvasHeight + margin;

  // Jeśli element jest całkowicie poza ekranem - zwróć false
  if (bottomRight.x < screenLeft) return false; // Element całkowicie po lewej
  if (topLeft.x > screenRight) return false; // Element całkowicie po prawej
  if (bottomRight.y < screenTop) return false; // Element całkowicie powyżej
  if (topLeft.y > screenBottom) return false; // Element całkowicie poniżej

  return true;
}
