/**
 * ============================================================================
 * POMOCNICZE FUNKCJE MATEMATYCZNE — dla elementów tablicy
 * ============================================================================
 *
 * UŻYWANE PRZEZ:
 * - elements/rendering/  (clamp przy rysowaniu linii i tekstu)
 * - toolbar/tools/function-tool.tsx  (evaluateExpression do wykresów)
 * ============================================================================
 */

import { evaluate } from 'mathjs';

/**
 * Ogranicz grubość linii ze skalowaniem viewport.
 * Min: 0.5px (żeby zawsze była widoczna), max: 100px (highlighter).
 */
export function clampLineWidth(width: number, scale: number): number {
  return Math.max(0.5, Math.min(100, width * scale));
}

/**
 * Ogranicz rozmiar czcionki ze skalowaniem viewport.
 * Min: 10px, max: 200px.
 */
export function clampFontSize(size: number, scale: number): number {
  return Math.max(10, Math.min(200, size * scale));
}

/**
 * Oblicz wartość wyrażenia matematycznego dla danego x.
 * Używany przez narzędzie wykresów funkcji (function-tool).
 *
 * Obsługuje: +, -, *, /, ^, sqrt(), cbrt(), sin(), cos(), tan(),
 *            asin(), acos(), atan(), log(), log10(), exp(), abs(),
 *            ceil(), floor(), round(), pi, e
 *
 * @throws Error gdy wyrażenie jest nieprawidłowe lub wynik nie jest liczbą
 */
export function evaluateExpression(expr: string, x: number): number {
  try {
    const result = evaluate(expr, { x });
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Invalid result');
    }
    return result;
  } catch {
    throw new Error('Cannot evaluate expression');
  }
}
