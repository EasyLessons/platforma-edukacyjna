/**
 * ============================================================================
 * PLIK: handlers/types.ts — Kontrakt Wzorca Strategii
 * ============================================================================
 *
 * Każdy typ elementu (shape, text, image …) implementuje ten interfejs.
 * Dzięki temu select-tool.tsx i rendering.ts nie mają ani jednego if/else
 * per-element-type – zamiast tego pytają rejestr o handler i wywołują metodę.
 *
 * ZASADY:
 * - Wszystkie metody to CZYSTE FUNKCJE – przyjmują stary stan, zwracają nowy.
 * - Żadnych hooków, żadnego globalnego mutowania stanu.
 * - Każdy handler to dedykowany plik w tym folderze.
 * ============================================================================
 */

import type {
  DrawingElement,
  ViewportTransform,
  Point,
} from '@/_new/features/whiteboard/types';

// ─── SHARED VALUE OBJECTS ────────────────────────────────────────────────────

/** Axis-Aligned Bounding Box w jednostkach świata */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Opcjonalne dane przekazywane do metody render() */
export interface RenderExtras {
  /** Mapa z załadowanymi obiektami HTMLImageElement (potrzebna dla image-handler) */
  loadedImages?: Map<string, HTMLImageElement>;
  /** Tryb debugowania – rysuje pomocnicze prostokąty */
  debug?: boolean;
  /** Callback do automatycznego rozszerzania wysokości tekstu */
  onAutoExpand?: (elementId: string, newHeight: number) => void;
}

// ─── INTERFACE ───────────────────────────────────────────────────────────────

/**
 * Kontrakt hanldera elementu.
 * T jest zawężony do konkretnego podtypu DrawingElement.
 *
 * Przykład użycia w select-tool.tsx:
 *
 *   const handler = Registry[el.type];
 *   if (handler) {
 *     updatesMap.set(el.id, handler.resize(el, pivotX, pivotY, scaleX, scaleY));
 *   }
 */
export interface ElementHandler<T extends DrawingElement = DrawingElement> {
  /** Czy element obsługuje skalowanie za narożniki */
  canResize: boolean;
  /** Czy element obsługuje obracanie */
  canRotate: boolean;

  /**
   * Axis-aligned bounding box – uwzględnia rotację (liczy rotowane narożniki).
   * Używane przy obliczaniu selection box i snapowania podczas drag.
   */
  getBoundingBox(element: T): BoundingBox;

  /**
   * Hit-test – czy punkt (w jednostkach świata) trafia w element.
   * Uwzględnia rotację (odwraca transformację przed sprawdzeniem prostokąta).
   */
  isPointInElement(point: Point, element: T): boolean;

  /**
   * Proporcjonalne skalowanie – czysta funkcja.
   * @param pivotX/Y  nieruchomy narożnik w jednostkach świata
   * @param scaleX/Y  współczynnik nowy/stary
   * @returns aktualizacja Partial<DrawingElement> gotowa do przekazania do onElementsUpdate
   */
  resize(
    element: T,
    pivotX: number,
    pivotY: number,
    scaleX: number,
    scaleY: number,
  ): Partial<DrawingElement>;

  /**
   * Przesunięcie – czysta funkcja.
   * @param dx/dy delta w jednostkach świata (już przekorygowana o snap)
   */
  move(element: T, dx: number, dy: number): Partial<DrawingElement>;

  /**
   * Obrót wokół pivota – czysta funkcja.
   * cos/sin są prekomputowane przez wywołującego (jeden Math.cos/sin na cały tick).
   */
  rotate(
    element: T,
    rotationAngle: number,
    pivot: Point,
    cos: number,
    sin: number,
  ): Partial<DrawingElement>;

  /**
   * Rysowanie na canvas – czyste side-effect, brak mutowania stanu.
   * extras jest opcjonalne: potrzebne np. przez image-handler (loadedImages).
   */
  render(
    ctx: CanvasRenderingContext2D,
    element: T,
    viewport: ViewportTransform,
    canvasWidth: number,
    canvasHeight: number,
    extras?: RenderExtras,
  ): void;
}
