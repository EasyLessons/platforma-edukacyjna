/**
 * ============================================================================
 * PLIK: handlers/image-handler.ts — Handler obrazów
 * ============================================================================
 */

import type { ImageElement, ViewportTransform } from '@/_new/features/whiteboard/types';
import type { ElementHandler, BoundingBox, RenderExtras } from './types';
import { rotateAroundPivot, getRotatedAABB, getSimpleAABB } from './handler-utils';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';

const MIN_SIZE = 0.1;

export const ImageHandler: ElementHandler<ImageElement> = {
  canResize: true,
  canRotate: true,

  getBoundingBox(el): BoundingBox {
    if (el.rotation && el.rotation !== 0) {
      return getRotatedAABB(el.x, el.y, el.width, el.height, el.rotation);
    }
    return getSimpleAABB(el.x, el.y, el.width, el.height);
  },

  isPointInElement(point, el) {
    if (el.rotation && el.rotation !== 0) {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const cos = Math.cos(-el.rotation);
      const sin = Math.sin(-el.rotation);
      const dx = point.x - cx;
      const dy = point.y - cy;
      const rx = cx + dx * cos - dy * sin;
      const ry = cy + dx * sin + dy * cos;
      return rx >= el.x && rx <= el.x + el.width && ry >= el.y && ry <= el.y + el.height;
    }
    return (
      point.x >= el.x && point.x <= el.x + el.width &&
      point.y >= el.y && point.y <= el.y + el.height
    );
  },

  resize(el, pivotX, pivotY, scaleX, scaleY) {
    return {
      x:      pivotX + (el.x - pivotX) * scaleX,
      y:      pivotY + (el.y - pivotY) * scaleY,
      width:  Math.max(MIN_SIZE, el.width  * scaleX),
      height: Math.max(MIN_SIZE, el.height * scaleY),
    };
  },

  move(el, dx, dy) {
    return { x: el.x + dx, y: el.y + dy };
  },

  rotate(el, rotationAngle, pivot, cos, sin) {
    const cx = el.x + el.width  / 2;
    const cy = el.y + el.height / 2;
    const newCenter = rotateAroundPivot({ x: cx, y: cy }, pivot, cos, sin);
    return {
      x:        newCenter.x - el.width  / 2,
      y:        newCenter.y - el.height / 2,
      rotation: (el.rotation ?? 0) + rotationAngle,
    };
  },

  render(ctx, img, viewport, canvasWidth, canvasHeight, extras) {
    const topLeft     = transformPoint({ x: img.x, y: img.y }, viewport, canvasWidth, canvasHeight);
    const bottomRight = transformPoint(
      { x: img.x + img.width, y: img.y + img.height },
      viewport, canvasWidth, canvasHeight,
    );
    const sw = bottomRight.x - topLeft.x;
    const sh = bottomRight.y - topLeft.y;

    if (img.rotation && img.rotation !== 0) {
      ctx.save();
      const cx = topLeft.x + sw / 2;
      const cy = topLeft.y + sh / 2;
      ctx.translate(cx, cy);
      ctx.rotate(img.rotation);
      ctx.translate(-cx, -cy);
    }

    const htmlImg = extras?.loadedImages?.get(img.id);
    if (htmlImg && htmlImg.complete) {
      ctx.drawImage(htmlImg, topLeft.x, topLeft.y, sw, sh);
    } else {
      ctx.fillStyle   = '#f0f0f0';
      ctx.fillRect(topLeft.x, topLeft.y, sw, sh);
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth   = 2;
      ctx.strokeRect(topLeft.x, topLeft.y, sw, sh);
    }

    if (img.rotation && img.rotation !== 0) ctx.restore();
  },
};
