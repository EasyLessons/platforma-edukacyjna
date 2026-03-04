/**
 * ============================================================================
 * PLIK: handlers/shape-handler.ts — Handler kształtów geometrycznych
 * ============================================================================
 */

import type { Shape, ViewportTransform } from '@/_new/features/whiteboard/types';
import type { ElementHandler, BoundingBox, RenderExtras } from './types';
import { rotateAroundPivot } from './handler-utils';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';
import { clampLineWidth } from '@/_new/features/whiteboard/elements/math-eval';

export const ShapeHandler: ElementHandler<Shape> = {
  canResize: true,
  canRotate: true,

  getBoundingBox(el): BoundingBox {
    return {
      x: Math.min(el.startX, el.endX),
      y: Math.min(el.startY, el.endY),
      width: Math.abs(el.endX - el.startX),
      height: Math.abs(el.endY - el.startY),
    };
  },

  isPointInElement(point, el) {
    const minX = Math.min(el.startX, el.endX);
    const maxX = Math.max(el.startX, el.endX);
    const minY = Math.min(el.startY, el.endY);
    const maxY = Math.max(el.startY, el.endY);
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  },

  resize(el, pivotX, pivotY, scaleX, scaleY) {
    return {
      startX: pivotX + (el.startX - pivotX) * scaleX,
      startY: pivotY + (el.startY - pivotY) * scaleY,
      endX: pivotX + (el.endX - pivotX) * scaleX,
      endY: pivotY + (el.endY - pivotY) * scaleY,
    };
  },

  move(el, dx, dy) {
    return {
      startX: el.startX + dx,
      startY: el.startY + dy,
      endX: el.endX + dx,
      endY: el.endY + dy,
    };
  },

  rotate(el, _rotationAngle, pivot, cos, sin) {
    // Obróć środek kształtu wokół pivota zaznaczenia
    const centerX = (el.startX + el.endX) / 2;
    const centerY = (el.startY + el.endY) / 2;
    const newCenter = rotateAroundPivot({ x: centerX, y: centerY }, pivot, cos, sin);

    // Obróć punkty kształtu wokół jego własnego środka
    const localStart = rotateAroundPivot({ x: el.startX, y: el.startY }, { x: centerX, y: centerY }, cos, sin);
    const localEnd   = rotateAroundPivot({ x: el.endX,   y: el.endY   }, { x: centerX, y: centerY }, cos, sin);

    const offsetX = newCenter.x - centerX;
    const offsetY = newCenter.y - centerY;

    return {
      startX: localStart.x + offsetX,
      startY: localStart.y + offsetY,
      endX:   localEnd.x   + offsetX,
      endY:   localEnd.y   + offsetY,
    };
  },

  render(ctx, shape, viewport, canvasWidth, canvasHeight) {
    const start = transformPoint({ x: shape.startX, y: shape.startY }, viewport, canvasWidth, canvasHeight);
    const end   = transformPoint({ x: shape.endX,   y: shape.endY   }, viewport, canvasWidth, canvasHeight);

    ctx.strokeStyle = shape.color;
    ctx.fillStyle   = shape.color;
    ctx.lineWidth   = clampLineWidth(shape.strokeWidth, viewport.scale);

    switch (shape.shapeType) {
      case 'rectangle':
        if (shape.fill) ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
        else            ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        break;

      case 'circle': {
        const radiusX = Math.abs(end.x - start.x) / 2;
        const radiusY = Math.abs(end.y - start.y) / 2;
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
        if (shape.fill) ctx.fill(); else ctx.stroke();
        break;
      }

      case 'triangle': {
        const midX     = (start.x + end.x) / 2;
        const triTopY  = Math.min(start.y, end.y);
        const triBotY  = Math.max(start.y, end.y);
        ctx.beginPath();
        ctx.moveTo(midX, triTopY);
        ctx.lineTo(end.x, triBotY);
        ctx.lineTo(start.x, triBotY);
        ctx.closePath();
        if (shape.fill) ctx.fill(); else ctx.stroke();
        break;
      }

      case 'line':
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;

      case 'arrow': {
        const headLen = 15;
        const angle   = Math.atan2(end.y - start.y, end.x - start.x);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        break;
      }

      case 'polygon': {
        const sides   = shape.sides || 5;
        const cx      = (start.x + end.x) / 2;
        const cy      = (start.y + end.y) / 2;
        const rx      = Math.abs(end.x - start.x) / 2;
        const ry      = Math.abs(end.y - start.y) / 2;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = (i * 2 * Math.PI) / sides - Math.PI / 2;
          const px = cx + rx * Math.cos(a);
          const py = cy + ry * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (shape.fill) ctx.fill(); else ctx.stroke();
        break;
      }
    }

    if (shape.rotation && shape.rotation !== 0) ctx.restore();
  },
};
