/**
 * ============================================================================
 * MATEMATYKA VIEWPORTU — czyste funkcje, zero side-effectów
 * ============================================================================
 * Wszystko co dotyczy przeliczania współrzędnych i fizyki ruchu tablicy.
 *
 * UŻYWANE PRZEZ:
 * - navigation/use-pan.ts      (pan myszką i touch)
 * - navigation/use-zoom.ts     (zoom scroll/pinch)
 * - navigation/use-momentum.ts (efekt rzucania)
 * - canvas/whiteboard-canvas.tsx
 * - canvas/grid.tsx
 * - canvas/remote-cursors.tsx
 * ============================================================================
 */

import { Point, ViewportTransform, MomentumState } from '../types';

// ─── STAŁE FIZYKI ────────────────────────────────────────────────────────────

/** Im wyższe, tym dłużej tablica się ślizga po puszczeniu */
const MOMENTUM_FRICTION = 0.9;
/** Prędkość poniżej której zatrzymujemy momentum */
const MOMENTUM_THRESHOLD = 0.001;
/** Maksymalna prędkość momentum (zapobiega "wystrzeliwaniu" tablicy) */
const MAX_MOMENTUM_VELOCITY = 1;

// ─── TRANSFORMACJE WSPÓŁRZĘDNYCH ─────────────────────────────────────────────

/**
 * Punkt tablicy → punkt na ekranie (world → screen).
 * Uwaga: 100px = 1 jednostka matematyczna (2 kratki siatki = 1 jednostka).
 */
export function transformPoint(
  point: Point,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const scale = viewport.scale * 100;

  return {
    x: (point.x - viewport.x) * scale + centerX,
    y: (point.y - viewport.y) * scale + centerY,
  };
}

/**
 * Punkt na ekranie → punkt tablicy (screen → world).
 * Odwrotność transformPoint.
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

// ─── PAN (PRZESUWANIE) ────────────────────────────────────────────────────────

/**
 * Przesuń viewport myszką / dotykiem (przytrzymanie i ciągnięcie).
 *
 * @param dx - różnica X w pikselach ekranu od ostatniej klatki
 * @param dy - różnica Y w pikselach ekranu od ostatniej klatki
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
 * Przesuń viewport kółkiem myszy / touchpadem (2 palce przesunięcie).
 *
 * @param deltaX - deltaX z WheelEvent
 * @param deltaY - deltaY z WheelEvent
 */
export function panViewportWithWheel(
  viewport: ViewportTransform,
  deltaX: number,
  deltaY: number
): ViewportTransform {
  const panSpeed = 1.0;
  return {
    ...viewport,
    x: viewport.x + (deltaX * panSpeed) / (viewport.scale * 100),
    y: viewport.y + (deltaY * panSpeed) / (viewport.scale * 100),
  };
}

// ─── ZOOM ─────────────────────────────────────────────────────────────────────

/**
 * Zoom viewport z zachowaniem punktu pod kursorem.
 * Działa dla: scroll kółkiem + Ctrl, pinch gesture na touchpadzie.
 *
 * @param deltaY  - deltaY z WheelEvent (ujemne = zoom in)
 * @param mouseX  - pozycja X kursora na ekranie
 * @param mouseY  - pozycja Y kursora na ekranie
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
  const newScale = Math.min(Math.max(oldScale * scaleChange, 0.1), 5.0);

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const mouseRelX = mouseX - centerX;
  const mouseRelY = mouseY - centerY;

  const worldX = viewport.x + mouseRelX / (oldScale * 100);
  const worldY = viewport.y + mouseRelY / (oldScale * 100);

  return {
    x: worldX - mouseRelX / (newScale * 100),
    y: worldY - mouseRelY / (newScale * 100),
    scale: newScale,
  };
}

/**
 * Constrain viewport — na nieskończonej tablicy brak ograniczeń.
 * Zostawiamy dla przyszłych rozszerzeń (np. tryb z ramką).
 */
export function constrainViewport(viewport: ViewportTransform): ViewportTransform {
  return viewport;
}

// ─── MOMENTUM (EFEKT RZUCANIA) ────────────────────────────────────────────────

/**
 * Uruchom momentum po puszczeniu palca/myszy z prędkością.
 * Prędkość jest ograniczona żeby tablica nie "wystrzeliła".
 */
export function startMomentum(velocityX: number, velocityY: number): MomentumState {
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
}

/**
 * Zatrzymaj momentum natychmiast (np. gdy user dotknie tablicy ponownie).
 */
export function stopMomentum(momentum: MomentumState): MomentumState {
  return { ...momentum, isActive: false, velocityX: 0, velocityY: 0 };
}

/**
 * Klatka animacji momentum — oblicza przesunięcie i redukuje prędkość (tarcie).
 * Wywołuj w requestAnimationFrame dopóki momentum.isActive === true.
 *
 * @returns viewport (przesunięcie do dodania) lub null gdy momentum wygasło
 */
export function updateMomentum(
  momentum: MomentumState,
  currentTime: number
): { momentum: MomentumState; viewport: { x: number; y: number } | null } {
  if (!momentum.isActive) return { momentum, viewport: null };

  const deltaTime = (currentTime - momentum.lastTimestamp) / 16; // normalizacja do 60fps

  const newVelocityX = momentum.velocityX * Math.pow(MOMENTUM_FRICTION, deltaTime);
  const newVelocityY = momentum.velocityY * Math.pow(MOMENTUM_FRICTION, deltaTime);

  const speed = Math.sqrt(newVelocityX ** 2 + newVelocityY ** 2);
  if (speed < MOMENTUM_THRESHOLD) {
    return {
      momentum: { ...momentum, isActive: false, velocityX: 0, velocityY: 0 },
      viewport: null,
    };
  }

  return {
    momentum: {
      ...momentum,
      velocityX: newVelocityX,
      velocityY: newVelocityY,
      lastTimestamp: currentTime,
    },
    viewport: {
      x: newVelocityX * deltaTime,
      y: newVelocityY * deltaTime,
    },
  };
}

// ─── VIEWPORT CULLING ─────────────────────────────────────────────────────────

/**
 * Czy element jest widoczny w aktualnym viewporcie?
 * Elementy poza ekranem nie są renderowane (optymalizacja).
 *
 * @param margin - margines w px — elementy tuż za krawędzią też są renderowane
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
  const topLeft = transformPoint({ x: elementX, y: elementY }, viewport, canvasWidth, canvasHeight);
  const bottomRight = transformPoint(
    { x: elementX + elementWidth, y: elementY + elementHeight },
    viewport,
    canvasWidth,
    canvasHeight
  );

  if (bottomRight.x < -margin) return false;
  if (topLeft.x > canvasWidth + margin) return false;
  if (bottomRight.y < -margin) return false;
  if (topLeft.y > canvasHeight + margin) return false;

  return true;
}
