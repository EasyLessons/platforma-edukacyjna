import { describe, it, expect } from 'vitest';
import {
  validateExpression,
  sampleFunctionPoints,
  ERROR_EMPTY_EXPRESSION,
  ERROR_INVALID_EXPRESSION,
} from './function-plot';

describe('validateExpression', () => {
  it('puste wyrazenie -> komunikat', () => {
    expect(validateExpression('')).toBe(ERROR_EMPTY_EXPRESSION);
    expect(validateExpression('   ')).toBe(ERROR_EMPTY_EXPRESSION);
  });

  it('poprawne wyrazenia -> null', () => {
    expect(validateExpression('sin(x)')).toBeNull();
    expect(validateExpression('x^2 - 3')).toBeNull();
    expect(validateExpression('2x + 1')).toBeNull();
    expect(validateExpression('abs(x)')).toBeNull();
  });

  it('bzdura skladniowa -> komunikat o bledzie', () => {
    expect(validateExpression('sin(')).toBe(ERROR_INVALID_EXPRESSION);
    expect(validateExpression('foo(x)')).toBe(ERROR_INVALID_EXPRESSION);
  });

  it('wyrazenie bez wartosci liczbowej dla ktoregos x z [-10,10] jest odrzucane', () => {
    // 1/x przy x = 0 -> Infinity; evaluateExpression rzuca -> "nieprawidlowe"
    expect(validateExpression('1/x')).toBe(ERROR_INVALID_EXPRESSION);
  });
});

describe('sampleFunctionPoints', () => {
  it('x^2 w zakresie ±2 daje punkty co step, y w ukladzie matematycznym', () => {
    const points = sampleFunctionPoints({ expression: 'x^2', xRange: 2, yRange: 10 }, 0.5);
    expect(points).toHaveLength(9);
    expect(points[0]).toEqual({ x: -2, y: 4 });
    expect(points[4]).toEqual({ x: 0, y: 0 });
    expect(points[8].y).toBeCloseTo(4);
  });

  it('punkty z |y| > yRange sa pomijane', () => {
    const points = sampleFunctionPoints({ expression: 'x^2', xRange: 5, yRange: 4 }, 0.5);
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) expect(Math.abs(p.y)).toBeLessThanOrEqual(4);
  });

  it('punkty poza dziedzina (sqrt ujemnych) sa pomijane bez rzucania', () => {
    const points = sampleFunctionPoints({ expression: 'sqrt(x)', xRange: 4, yRange: 4 }, 0.5);
    expect(points[0].x).toBeCloseTo(0);
    expect(points.every((p) => p.x >= -1e-9)).toBe(true);
  });

  it('bledne wyrazenie daje pusta liste', () => {
    expect(sampleFunctionPoints({ expression: 'sin(', xRange: 10, yRange: 10 })).toEqual([]);
  });

  it('domyslny krok to 0.1', () => {
    const points = sampleFunctionPoints({ expression: 'x', xRange: 1, yRange: 10 });
    expect(points).toHaveLength(21);
    expect(points[1].x).toBeCloseTo(-0.9);
  });
});
