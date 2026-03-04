/**
 * ============================================================================
 * PLIK: handlers/markdown-handler.ts — Handler notatek Markdown
 * ============================================================================
 *
 * Markdown NIE jest rysowany na canvas – treść renderowana jest przez React overlay.
 * Canvas rysuje tu tylko tło + ramkę.
 * Minimalne wymiary: 1.5 × 1.0 (world units) żeby notatka pozostała czytelna.
 * ============================================================================
 */

import type { MarkdownNote, ViewportTransform } from '@/_new/features/whiteboard/types';
import type { ElementHandler, BoundingBox, RenderExtras } from './types';
import { rotateAroundPivot, getSimpleAABB } from './handler-utils';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';

const MARKDOWN_MIN_W = 1.5;
const MARKDOWN_MIN_H = 1.0;

export const MarkdownHandler: ElementHandler<MarkdownNote> = {
  canResize: true,
  canRotate: false, // Markdown nie obsługuje rotacji

  getBoundingBox(el): BoundingBox {
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
      width:  Math.max(MARKDOWN_MIN_W, el.width  * scaleX),
      height: Math.max(MARKDOWN_MIN_H, el.height * scaleY),
    };
  },

  move(el, dx, dy) {
    return { x: el.x + dx, y: el.y + dy };
  },

  rotate(el, rotationAngle, pivot, cos, sin) {
    // Markdown nie obraca się – tylko przesuwa środek wokół pivota zaznaczenia
    const cx = el.x + el.width  / 2;
    const cy = el.y + el.height / 2;
    const newCenter = rotateAroundPivot({ x: cx, y: cy }, pivot, cos, sin);
    return {
      x: newCenter.x - el.width  / 2,
      y: newCenter.y - el.height / 2,
    };
  },

  render(ctx, note, viewport, canvasWidth, canvasHeight) {
    // UWAGA: treść Markdown renderowana przez React overlay.
    // Canvas rysuje tylko kontener (tło + ramka) – reszta to HTML.
    const topLeft     = transformPoint({ x: note.x, y: note.y }, viewport, canvasWidth, canvasHeight);
    const bottomRight = transformPoint(
      { x: note.x + note.width, y: note.y + note.height },
      viewport, canvasWidth, canvasHeight,
    );
    const sw = bottomRight.x - topLeft.x;
    const sh = bottomRight.y - topLeft.y;

    ctx.fillStyle = note.backgroundColor ?? '#ffffff';
    ctx.fillRect(topLeft.x, topLeft.y, sw, sh);

    ctx.strokeStyle = note.borderColor ?? '#e5e7eb';
    ctx.lineWidth   = 2;
    ctx.strokeRect(topLeft.x, topLeft.y, sw, sh);

    if (note.isFromChatbot) {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(topLeft.x + 12, topLeft.y + 12, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};
