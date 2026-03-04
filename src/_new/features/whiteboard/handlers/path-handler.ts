/**
 * ============================================================================
 * PLIK: handlers/path-handler.ts — Handler odręcznych ścieżek
 * ============================================================================
 */

import type { DrawingPath, Point, ViewportTransform } from '@/_new/features/whiteboard/types';
import type { ElementHandler, BoundingBox, RenderExtras } from './types';
import { rotateAroundPivot } from './handler-utils';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';
import { clampLineWidth } from '@/_new/features/whiteboard/elements/math-eval';

export const PathHandler: ElementHandler<DrawingPath> = {
  canResize: true,
  canRotate: true,

  getBoundingBox(el): BoundingBox {
    if (el.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  },

  isPointInElement(point, el) {
    const box = PathHandler.getBoundingBox(el);
    return (
      point.x >= box.x && point.x <= box.x + box.width &&
      point.y >= box.y && point.y <= box.y + box.height
    );
  },

  resize(el, pivotX, pivotY, scaleX, scaleY) {
    const newPoints = el.points.map((p: Point) => ({
      x: pivotX + (p.x - pivotX) * scaleX,
      y: pivotY + (p.y - pivotY) * scaleY,
    }));
    return { points: newPoints };
  },

  move(el, dx, dy) {
    return { points: el.points.map((p: Point) => ({ x: p.x + dx, y: p.y + dy })) };
  },

  rotate(el, _rotationAngle, pivot, cos, sin) {
    // Znajdź środek ścieżki
    const xs = el.points.map((p: Point) => p.x);
    const ys = el.points.map((p: Point) => p.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

    // Obróć środek wokół pivota zaznaczenia
    const newCenter = rotateAroundPivot({ x: centerX, y: centerY }, pivot, cos, sin);

    // Obróć każdy punkt wokół własnego środka ścieżki
    const rotatedPoints = el.points.map((p: Point) =>
      rotateAroundPivot(p, { x: centerX, y: centerY }, cos, sin),
    );

    const offsetX = newCenter.x - centerX;
    const offsetY = newCenter.y - centerY;

    return {
      points: rotatedPoints.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
    };
  },

  render(ctx, path, viewport, canvasWidth, canvasHeight) {
    if (path.points.length === 0) return;

    const lineWidth = clampLineWidth(path.width, viewport.scale);
    const originalAlpha = ctx.globalAlpha;
    if (path.opacity !== undefined) ctx.globalAlpha = path.opacity;

    // Pojedynczy punkt → kropka
    if (path.points.length === 1) {
      const point = transformPoint(path.points[0], viewport, canvasWidth, canvasHeight);
      ctx.fillStyle = path.color;
      ctx.beginPath();
      const radius = path.widths?.[0]
        ? clampLineWidth(path.widths[0], viewport.scale) / 2
        : lineWidth / 2;
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = originalAlpha;
      return;
    }

    ctx.strokeStyle = path.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Zmienna grubość
    if (path.widths && path.widths.length > 0) {
      for (let i = 0; i < path.points.length - 1; i++) {
        const p1 = transformPoint(path.points[i], viewport, canvasWidth, canvasHeight);
        const p2 = transformPoint(path.points[i + 1], viewport, canvasWidth, canvasHeight);
        const w1 = path.widths[i] || path.width;
        const w2 = path.widths[i + 1] || path.width;
        ctx.lineWidth = clampLineWidth((w1 + w2) / 2, viewport.scale);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.globalAlpha = originalAlpha;
      return;
    }

    // Stała grubość
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    const start = transformPoint(path.points[0], viewport, canvasWidth, canvasHeight);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < path.points.length; i++) {
      const p = transformPoint(path.points[i], viewport, canvasWidth, canvasHeight);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.globalAlpha = originalAlpha;
  },
};
