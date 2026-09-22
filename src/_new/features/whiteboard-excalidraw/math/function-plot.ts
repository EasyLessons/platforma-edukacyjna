/**
 * Wykres funkcji jako SVG - czysta logika (bez React, bez Excalidraw).
 *
 * Wyodrębnione z `features/whiteboard/components/toolbar/function-tool.tsx`
 * (renderPreview) i `features/whiteboard/elements/rendering.ts` (drawFunction):
 * tam próbkowanie było zaszyte w komponencie i w rysowaniu na canvasie,
 * tutaj jest oddzielone od transportu (SVG -> element `image` w Excalidraw).
 *
 * `evaluateExpression` importujemy ze starego silnika, bo to czysta funkcja
 * (mathjs) bez zależności od React/canvasu. Przy pełnej migracji ten jeden
 * plik (`elements/math-eval.ts`) przenosi się tutaj.
 */

import { evaluateExpression } from '@/_new/features/whiteboard/elements/math-eval';

export interface FunctionSpec {
  /** Wyrażenie w składni mathjs, np. `sin(x)`, `x^2 - 3`. */
  expression: string;
  /** Zakres osi X: [-xRange, xRange] w jednostkach matematycznych. */
  xRange: number;
  /** Zakres osi Y: [-yRange, yRange]; punkty poza są pomijane (przerwa w linii). */
  yRange: number;
  color: string;
  strokeWidth: number;
  dashed?: boolean;
}

export const DEFAULT_FUNCTION_SPEC: FunctionSpec = {
  expression: 'sin(x)',
  xRange: 10,
  yRange: 10,
  color: '#1e1e1e',
  strokeWidth: 2,
  dashed: false,
};

/** Fragment ciągłej linii (kolejne punkty). Przerwa = nowy segment. */
export type PlotSegment = { x: number; y: number }[];

/** Wynik walidacji wyrażenia - komunikaty po polsku jak w starym narzędziu. */
export function validateExpression(expr: string): string | null {
  if (!expr.trim()) return 'Wprowadź wyrażenie matematyczne';
  let finiteCount = 0;
  try {
    for (let x = -10; x <= 10; x += 1) {
      try {
        const y = evaluateExpression(expr, x);
        if (Number.isFinite(y)) finiteCount += 1;
      } catch {
        // pojedynczy punkt poza dziedziną (np. log(-1)) nie dyskwalifikuje wzoru
      }
    }
  } catch {
    return 'Nieprawidłowe wyrażenie matematyczne';
  }
  if (finiteCount === 0) return 'Wyrażenie zwraca nieprawidłowe wartości';
  return null;
}

/**
 * Próbkuje funkcję w przedziale [-xRange, xRange] i zwraca segmenty w układzie
 * matematycznym (y w górę). Punkty nieskończone / poza yRange przerywają linię -
 * dokładnie tak jak `drawFunction` w starym silniku (`started = false`).
 */
export function sampleFunction(spec: FunctionSpec, step = 0.02): PlotSegment[] {
  const segments: PlotSegment[] = [];
  let current: PlotSegment = [];
  const { expression, xRange, yRange } = spec;

  for (let x = -xRange; x <= xRange + 1e-9; x += step) {
    let y: number | null = null;
    try {
      const v = evaluateExpression(expression, x);
      if (Number.isFinite(v) && Math.abs(v) <= yRange) y = v;
    } catch {
      y = null;
    }
    if (y === null) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }
    current.push({ x, y });
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

export interface PlotSvgOptions {
  /** Szerokość i wysokość SVG w pikselach (kwadrat = 1 jednostka ma tę samą skalę na obu osiach tylko gdy xRange === yRange). */
  width?: number;
  height?: number;
  /** Rysować osie i siatkę. */
  axes?: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * Buduje samodzielny plik SVG z wykresem: osie, siatka, linia funkcji, etykieta wzoru.
 * Układ: środek SVG = (0,0), oś Y w górę.
 */
export function functionPlotSvg(spec: FunctionSpec, opts: PlotSvgOptions = {}): string {
  const width = opts.width ?? 400;
  const height = opts.height ?? 400;
  const axes = opts.axes ?? true;
  const sx = width / (2 * spec.xRange);
  const sy = height / (2 * spec.yRange);
  const toPx = (p: { x: number; y: number }) => ({
    x: width / 2 + p.x * sx,
    y: height / 2 - p.y * sy,
  });

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  );
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);

  if (axes) {
    const gridStep = niceStep(spec.xRange);
    const gridStepY = niceStep(spec.yRange);
    const grid: string[] = [];
    for (let gx = -spec.xRange; gx <= spec.xRange + 1e-9; gx += gridStep) {
      const { x } = toPx({ x: gx, y: 0 });
      grid.push(`M${x.toFixed(1)} 0V${height}`);
    }
    for (let gy = -spec.yRange; gy <= spec.yRange + 1e-9; gy += gridStepY) {
      const { y } = toPx({ x: 0, y: gy });
      grid.push(`M0 ${y.toFixed(1)}H${width}`);
    }
    parts.push(`<path d="${grid.join('')}" stroke="#e5e7eb" stroke-width="1" fill="none"/>`);
    parts.push(
      `<path d="M${width / 2} 0V${height}M0 ${height / 2}H${width}" stroke="#9ca3af" stroke-width="1.5" fill="none"/>`
    );
    parts.push(
      `<text x="${width - 6}" y="${height / 2 - 6}" font-size="12" text-anchor="end" fill="#6b7280" font-family="sans-serif">${spec.xRange}</text>`
    );
    parts.push(
      `<text x="${width / 2 + 6}" y="14" font-size="12" fill="#6b7280" font-family="sans-serif">${spec.yRange}</text>`
    );
  }

  const segments = sampleFunction(spec);
  const d = segments
    .map((seg) =>
      seg
        .map((p, i) => {
          const q = toPx(p);
          return `${i === 0 ? 'M' : 'L'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
        })
        .join('')
    )
    .join('');
  if (d) {
    parts.push(
      `<path d="${d}" stroke="${esc(spec.color)}" stroke-width="${spec.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${
        spec.dashed ? ' stroke-dasharray="6 4"' : ''
      }/>`
    );
  }

  parts.push(
    `<text x="8" y="${height - 8}" font-size="14" fill="${esc(spec.color)}" font-family="monospace">y = ${esc(spec.expression)}</text>`
  );
  parts.push('</svg>');
  return parts.join('');
}

/** SVG -> data URL (UTF-8, bez base64 - krótsze i czytelne w Y.Doc). */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Krok siatki: 1, 2, 5, 10, 20... tak, żeby było ~10 linii na oś. */
export function niceStep(range: number): number {
  const raw = (2 * range) / 10;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return nice * pow;
}
