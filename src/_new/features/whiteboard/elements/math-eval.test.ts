import { describe, it, expect } from 'vitest';
import { clampLineWidth, clampFontSize, evaluateExpression } from './math-eval';

// ─── clampLineWidth ────────────────────────────────────────────────────────

describe('clampLineWidth', () => {
  it('wartość w zakresie — bez clamp', () => {
    expect(clampLineWidth(5, 1)).toBeCloseTo(5);
  });

  it('wynik poniżej minimum 0.5 → zwraca 0.5', () => {
    expect(clampLineWidth(0.01, 0.1)).toBeCloseTo(0.5); // 0.01*0.1=0.001 < 0.5
  });

  it('wynik powyżej maksimum 100 → zwraca 100', () => {
    expect(clampLineWidth(200, 10)).toBeCloseTo(100); // 200*10=2000 > 100
  });

  it('skalowanie viewportu (scale>1) powiększa grubość', () => {
    expect(clampLineWidth(3, 2)).toBeCloseTo(6);
  });

  it('grubość dokładnie na granicy minimum (0.5) jest zwracana bez zmian', () => {
    expect(clampLineWidth(0.5, 1)).toBeCloseTo(0.5);
  });

  it('grubość dokładnie na granicy maksimum (100) jest zwracana bez zmian', () => {
    expect(clampLineWidth(100, 1)).toBeCloseTo(100);
  });
});

// ─── clampFontSize ─────────────────────────────────────────────────────────

describe('clampFontSize', () => {
  it('wartość w zakresie — bez clamp', () => {
    expect(clampFontSize(16, 1)).toBeCloseTo(16);
  });

  it('wynik poniżej minimum 10 → zwraca 10', () => {
    expect(clampFontSize(1, 0.1)).toBeCloseTo(10); // 1*0.1=0.1 < 10
  });

  it('wynik powyżej maksimum 200 → zwraca 200', () => {
    expect(clampFontSize(100, 10)).toBeCloseTo(200); // 100*10=1000 > 200
  });

  it('skalowanie viewportu pomniejsza czcionkę', () => {
    expect(clampFontSize(50, 0.5)).toBeCloseTo(25);
  });
});

// ─── evaluateExpression ────────────────────────────────────────────────────

describe('evaluateExpression', () => {
  it('x^2 dla x=3 → 9', () => {
    expect(evaluateExpression('x^2', 3)).toBeCloseTo(9);
  });

  it('2*x + 1 dla x=4 → 9', () => {
    expect(evaluateExpression('2*x + 1', 4)).toBeCloseTo(9);
  });

  it('sqrt(x) dla x=4 → 2', () => {
    expect(evaluateExpression('sqrt(x)', 4)).toBeCloseTo(2);
  });

  it('sin(x) dla x=π/2 → 1', () => {
    expect(evaluateExpression('sin(x)', Math.PI / 2)).toBeCloseTo(1);
  });

  it('cos(x) dla x=0 → 1', () => {
    expect(evaluateExpression('cos(x)', 0)).toBeCloseTo(1);
  });

  it('wyrażenie stałe: pi ≈ 3.14159', () => {
    expect(evaluateExpression('pi', 0)).toBeCloseTo(Math.PI);
  });

  it('wyrażenie z e ≈ 2.71828', () => {
    expect(evaluateExpression('e', 0)).toBeCloseTo(Math.E);
  });

  it('abs(x) dla x=-5 → 5', () => {
    expect(evaluateExpression('abs(x)', -5)).toBeCloseTo(5);
  });

  it('dzielenie przez zero (1/0) → rzuca błąd (Infinity nie jest finite)', () => {
    expect(() => evaluateExpression('1/0', 0)).toThrow();
  });

  it('dzielenie przez x=0 → rzuca błąd', () => {
    expect(() => evaluateExpression('1/x', 0)).toThrow();
  });

  it('nieprawidłowe wyrażenie → rzuca błąd', () => {
    expect(() => evaluateExpression('abc!!!', 1)).toThrow();
  });

  it('wyrażenie zwracające string → rzuca błąd', () => {
    // mathjs może zwrócić np. obiekt dla niektórych wyrażeń
    expect(() => evaluateExpression('"hello"', 0)).toThrow();
  });
});
