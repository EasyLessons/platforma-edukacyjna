/**
 * ============================================================================
 * TYPY STANU TABLICY (canvas, viewport, nawigacja)
 * ============================================================================
 *
 * UŻYWANE PRZEZ:
 * - navigation/use-viewport.ts    (stan pozycji i zoom)
 * - navigation/use-pan.ts         (przesuwanie)
 * - navigation/use-zoom.ts        (zoom)
 * - navigation/use-momentum.ts    (efekt rzucania)
 * - canvas/whiteboard-canvas.tsx  (przekazywanie do renderowania)
 * - canvas/grid.tsx               (siatka musi wiedzieć gdzie jest viewport)
 * - canvas/coordinate-system.tsx  (osie X/Y)
 * - canvas/snap-guides.tsx        (linie pomocnicze)
 * - canvas/remote-cursors.tsx     (kursory innych — pozycja na ekranie)
 * ============================================================================
 */

/**
 * Stan widoku (kamery) tablicy.
 *
 * x, y    → przesunięcie widoku w pikselach ekranu
 * scale   → poziom przybliżenia (1.0 = 100%, 2.0 = 200%, 0.5 = 50%)
 *
 * Żeby zamienić punkt tablicy na punkt ekranu:
 *   screenX = tablicaX * scale + x
 *   screenY = tablicaY * scale + y
 *
 * Żeby zamienić punkt ekranu na punkt tablicy:
 *   tablicaX = (screenX - x) / scale
 *   tablicaY = (screenY - y) / scale
 */
export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Stan efektu momentum ("rzucania" tablicą).
 * Po puszczeniu myszy/palca tablica dalej się przesuwa, stopniowo zwalniając.
 *
 * velocityX, velocityY  → aktualna prędkość w px/ms
 * isActive              → czy momentum jest w trakcie działania
 * lastTimestamp         → czas ostatniej klatki (dla requestAnimationFrame)
 */
export interface MomentumState {
  velocityX: number;
  velocityY: number;
  isActive: boolean;
  lastTimestamp: number;
}

/**
 * Linia pomocnicza snap — pojawia się chwilowo gdy przeciągany element
 * wyrównuje się do krawędzi lub środka innego elementu.
 *
 * x lub y   → pozycja linii (tylko jedna z nich jest ustawiona)
 * type      → 'vertical' (pionowa) lub 'horizontal' (pozioma)
 */
export interface GuideLine {
  x?: number;
  y?: number;
  type: 'vertical' | 'horizontal';
}
