/**
 * ============================================================================
 * PLIK: handlers/handler-utils.ts — Wspólna matematyka handlerów
 * ============================================================================
 * Czyste funkcje pomocnicze używane przez wszystkie handlery.
 * Brak zależności od React/hooks.
 * ============================================================================
 */

import type { Point } from '@/_new/features/whiteboard/types';
import type { BoundingBox } from './types';

/**
 * Obraca punkt wokół pivota.
 * cos/sin są prekomputowane przez wywołującego (wydajność).
 */
export function rotateAroundPivot(
  point: Point,
  pivot: Point,
  cos: number,
  sin: number,
): Point {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

/**
 * Axis-aligned bounding box prostokąta z uwzględnieniem rotacji.
 * Liczy 4 rotowane narożniki i zwraca ich min/max.
 */
export function getRotatedAABB(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
): BoundingBox {
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const corners: Point[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const corner of corners) {
    const dx = corner.x - centerX;
    const dy = corner.y - centerY;
    const rx = centerX + dx * cos - dy * sin;
    const ry = centerY + dx * sin + dy * cos;
    if (rx < minX) minX = rx;
    if (ry < minY) minY = ry;
    if (rx > maxX) maxX = rx;
    if (ry > maxY) maxY = ry;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * AABB bez rotacji – prosty przypadek (box types: markdown, table, pdf).
 */
export function getSimpleAABB(
  x: number,
  y: number,
  width: number,
  height: number,
): BoundingBox {
  return { x, y, width, height };
}
