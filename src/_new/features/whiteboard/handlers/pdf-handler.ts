/**
 * ============================================================================
 * PLIK: handlers/pdf-handler.ts — Handler elementów PDF
 * ============================================================================
 *
 * PDF renderowany jest przez React overlay (brak rysowania na canvas).
 * handler.render() jest no-op – wstawiony dla kompletności interfejsu.
 * ============================================================================
 */

import type { PDFElement, ViewportTransform } from '@/_new/features/whiteboard/types';
import type { ElementHandler, BoundingBox, RenderExtras } from './types';
import { rotateAroundPivot, getRotatedAABB, getSimpleAABB } from './handler-utils';

const MIN_SIZE = 0.1;

export const PdfHandler: ElementHandler<PDFElement> = {
  canResize: true,
  canRotate: true,

  getBoundingBox(el): BoundingBox {
    if (el.rotation && el.rotation !== 0) {
      return getRotatedAABB(el.x, el.y, el.width, el.height, el.rotation);
    }
    return getSimpleAABB(el.x, el.y, el.width, el.height);
  },

  isPointInElement(point, el) {
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

  // PDF jest renderowany przez React overlay – canvas nic nie rysuje
  render(_ctx, _el, _viewport, _cw, _ch) {},
};
