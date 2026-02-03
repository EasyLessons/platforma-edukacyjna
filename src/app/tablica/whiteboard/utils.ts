/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/utils.ts
 * ============================================================================
 *
 * IMPORTUJE Z:
 * - ./types (Point, ViewportTransform, DrawingElement)
 *
 * EKSPORTUJE:
 * - clampLineWidth (function) - ogranicza szerokość linii (0.5-20px)
 * - clampFontSize (function) - ogranicza rozmiar czcionki (10-200px)
 * - evaluateExpression (function) - evaluator wyrażeń matematycznych
 * - isOutsideViewport (function) - sprawdza czy element poza viewport (TODO)
 *
 * UŻYWANE PRZEZ:
 * - rendering.ts (clamp dla renderowania)
 *
 * PRZEZNACZENIE:
 * Funkcje pomocnicze dla tablicy:
 * - Clamp dla rozmiaru linii/czcionek ze skalowaniem viewport
 * - Parser wyrażeń matematycznych (sin, cos, tan, ^, pi, e itp.)
 * - Culling elementów poza viewport (placeholder)
 * ============================================================================
 */

import { Point, ViewportTransform, DrawingElement } from './types';
import { evaluate } from 'mathjs';

/**
 * Clamp lineWidth: min 0.5px, max 20px
 * Linie skalują się z viewport, ale z limitami
 */
export function clampLineWidth(width: number, scale: number): number {
  const scaled = width * scale;
  return Math.max(0.5, Math.min(20, scaled));
}

/**
 * Clamp fontSize: min 10px, max 200px
 * Tekst skaluje się z viewport, ale z limitami
 */
export function clampFontSize(size: number, scale: number): number {
  const scaled = size * scale;
  return Math.max(10, Math.min(200, scaled));
}

/**
 * Math expression evaluator using math.js
 * Obsługuje zaawansowane funkcje: sqrt(), cbrt(), log(), sin(), cos(), tan(),
 * abs(), ceil(), floor(), exp(), ^, pi, e i wiele innych
 */
export function evaluateExpression(expr: string, x: number): number {
  try {
    // math.js wspiera:
    // - operatory: +, -, *, /, ^, %
    // - funkcje: sqrt, cbrt, sin, cos, tan, asin, acos, atan, log, log10, exp, abs, ceil, floor, round
    // - stałe: pi, e
    // - automatyczne mnożenie: 2x = 2*x, 3(x+1) = 3*(x+1)
    const result = evaluate(expr, { x });

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Invalid result');
    }

    return result;
  } catch (e) {
    throw new Error('Cannot evaluate expression');
  }
}

/**
 * Culling - sprawdza czy element jest poza viewport
 * TODO: implement proper culling
 */
export function isOutsideViewport(element: DrawingElement, viewport: ViewportTransform): boolean {
  // Na razie placeholder - zawsze false (rysuj wszystko)
  return false;
}
