import { describe, it, expect } from 'vitest';
import {
  sampleFunction,
  functionPlotSvg,
  validateExpression,
  niceStep,
  svgToDataUrl,
  DEFAULT_FUNCTION_SPEC,
} from './function-plot';

describe('validateExpression', () => {
  it('puste wyrażenie -> komunikat', () => {
    expect(validateExpression('   ')).toBe('Wprowadź wyrażenie matematyczne');
  });

  it('poprawne wyrażenie -> null', () => {
    expect(validateExpression('sin(x)')).toBeNull();
    expect(validateExpression('x^2 - 3')).toBeNull();
  });

  it('wyrażenie z dziedziną częściową (sqrt) przechodzi', () => {
    expect(validateExpression('sqrt(x)')).toBeNull();
  });

  it('bzdura składniowa -> komunikat o błędzie', () => {
    expect(validateExpression('sin(')).toBe('Wyrażenie zwraca nieprawidłowe wartości');
  });
});

describe('sampleFunction', () => {
  it('x^2 w zakresie ±2 daje jeden ciągły segment', () => {
    const segs = sampleFunction(
      { ...DEFAULT_FUNCTION_SPEC, expression: 'x^2', xRange: 2, yRange: 10 },
      0.5
    );
    expect(segs).toHaveLength(1);
    expect(segs[0][0]).toEqual({ x: -2, y: 4 });
    expect(segs[0][segs[0].length - 1].y).toBeCloseTo(4);
  });

  it('1/x przerywa linię w zerze (dwa segmenty)', () => {
    const segs = sampleFunction(
      { ...DEFAULT_FUNCTION_SPEC, expression: '1/x', xRange: 2, yRange: 10 },
      0.25
    );
    expect(segs.length).toBe(2);
    // Lewy segment ma same ujemne y, prawy same dodatnie
    expect(segs[0].every((p) => p.y < 0)).toBe(true);
    expect(segs[1].every((p) => p.y > 0)).toBe(true);
  });

  it('punkty poza yRange są wycinane', () => {
    const segs = sampleFunction(
      { ...DEFAULT_FUNCTION_SPEC, expression: 'x^2', xRange: 5, yRange: 4 },
      0.5
    );
    for (const seg of segs) for (const p of seg) expect(Math.abs(p.y)).toBeLessThanOrEqual(4);
  });

  it('sqrt(x) daje punkty tylko dla x >= 0', () => {
    const segs = sampleFunction(
      { ...DEFAULT_FUNCTION_SPEC, expression: 'sqrt(x)', xRange: 4, yRange: 4 },
      0.5
    );
    expect(segs).toHaveLength(1);
    expect(segs[0][0].x).toBeCloseTo(0);
  });
});

describe('functionPlotSvg', () => {
  it('zwraca poprawny SVG z osiami, ścieżką i etykietą wzoru', () => {
    const svg = functionPlotSvg({
      ...DEFAULT_FUNCTION_SPEC,
      expression: 'sin(x)',
      color: '#ff0000',
    });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('stroke="#ff0000"');
    expect(svg).toContain('y = sin(x)');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('escapuje znaki specjalne we wzorze (bez wstrzyknięcia)', () => {
    const svg = functionPlotSvg({ ...DEFAULT_FUNCTION_SPEC, expression: 'x<2' });
    expect(svg).toContain('y = x&lt;2');
    expect(svg).not.toContain('x<2');
  });

  it('dashed dodaje stroke-dasharray', () => {
    const svg = functionPlotSvg({ ...DEFAULT_FUNCTION_SPEC, dashed: true });
    expect(svg).toContain('stroke-dasharray');
  });

  it('svgToDataUrl koduje jako image/svg+xml', () => {
    const url = svgToDataUrl('<svg/>');
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(url.split(',')[1])).toBe('<svg/>');
  });
});

describe('niceStep', () => {
  it('daje "ładne" kroki siatki', () => {
    expect(niceStep(10)).toBe(2);
    expect(niceStep(5)).toBe(1);
    expect(niceStep(50)).toBe(10);
    expect(niceStep(100)).toBe(20);
  });
});
