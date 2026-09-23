/**
 * Wykres funkcji - czysta logika walidacji i probkowania (bez React).
 *
 * Wyodrebnione z `toolbar/function-tool.tsx` (validateExpression + petla
 * w renderPreview). Nazwy zgodne z prototypem Excalidraw
 * (`whiteboard-excalidraw/math/function-plot.ts`): `validateExpression`
 * zwraca komunikat bledu po polsku albo `null`, `FunctionSpec` opisuje
 * wzor i zakresy. Roznica: tutaj probkowanie zwraca plaska liste punktow
 * (tak rysowal stary preview), prototyp zwraca segmenty z przerwami.
 */

import { evaluateExpression } from '@/_new/features/whiteboard/elements/math-eval';

export interface FunctionSpec {
  /** Wyrazenie w skladni mathjs, np. `sin(x)`, `x^2 - 3`. */
  expression: string;
  /** Zakres osi X: [-xRange, xRange] w jednostkach matematycznych. */
  xRange: number;
  /** Zakres osi Y: [-yRange, yRange]; punkty poza sa pomijane. */
  yRange: number;
}

export interface PlotPoint {
  x: number;
  y: number;
}

/** Domyslny krok probkowania preview (jednostki matematyczne). */
export const PREVIEW_SAMPLE_STEP = 0.1;

export const ERROR_EMPTY_EXPRESSION = 'Wprowadź wyrażenie matematyczne';
export const ERROR_NON_FINITE = 'Wyrażenie zwraca nieprawidłowe wartości';
export const ERROR_INVALID_EXPRESSION = 'Nieprawidłowe wyrażenie matematyczne';

/**
 * Sprawdza wyrazenie na calkowitych x z przedzialu [-10, 10].
 * Zwraca komunikat bledu albo `null`, gdy wyrazenie jest poprawne.
 *
 * Uwaga (zachowanie odziedziczone): `evaluateExpression` rzuca takze przy
 * wyniku nieskonczonym lub zespolonym, wiec wzory z dziedzina czesciowa
 * (`sqrt(x)`, `log(x)`, `1/x`) sa odrzucane jako "nieprawidlowe".
 */
export function validateExpression(expr: string): string | null {
  if (!expr.trim()) return ERROR_EMPTY_EXPRESSION;

  try {
    for (let x = -10; x <= 10; x += 1) {
      const y = evaluateExpression(expr, x);
      if (!isFinite(y)) return ERROR_NON_FINITE;
    }
    return null;
  } catch {
    return ERROR_INVALID_EXPRESSION;
  }
}

/**
 * Probkuje funkcje w [-xRange, xRange] co `step` i zwraca punkty w ukladzie
 * matematycznym (y w gore). Punkty poza dziedzina, nieskonczone lub
 * z |y| > yRange sa pomijane (bez przerywania linii).
 */
export function sampleFunctionPoints(
  spec: FunctionSpec,
  step: number = PREVIEW_SAMPLE_STEP
): PlotPoint[] {
  const points: PlotPoint[] = [];
  const { expression, xRange, yRange } = spec;

  for (let x = -xRange; x <= xRange; x += step) {
    try {
      const y = evaluateExpression(expression, x);
      if (!isFinite(y) || Math.abs(y) > yRange) continue;
      points.push({ x, y });
    } catch {
      // Ignoruj punkty z bledami (np. log(-1))
    }
  }

  return points;
}
