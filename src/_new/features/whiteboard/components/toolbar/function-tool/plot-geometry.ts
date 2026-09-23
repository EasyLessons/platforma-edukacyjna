/**
 * Geometria preview wykresu: punkty matematyczne -> punkty ekranowe -> SVG path.
 *
 * Wyodrebnione z `toolbar/function-tool.tsx` (renderPreview). Uklad
 * matematyczny ma os Y w gore, tablica w dol - stad odwrocenie znaku.
 */

import type { ViewportTransform } from '@/_new/features/whiteboard/types';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';
import type { PlotPoint } from './function-plot';

/** Rzutuje punkty (x, y matematyczne) na wspolrzedne ekranu tablicy. */
export function projectPointsToScreen(
  points: PlotPoint[],
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): PlotPoint[] {
  return points.map((p) =>
    transformPoint({ x: p.x, y: -p.y }, viewport, canvasWidth, canvasHeight)
  );
}

/**
 * Buduje atrybut `d` sciezki SVG laczacej kolejne punkty.
 * Zwraca `null`, gdy punktow jest za malo, zeby narysowac linie.
 */
export function buildSvgPath(points: PlotPoint[]): string | null {
  if (points.length < 2) return null;
  return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
}
