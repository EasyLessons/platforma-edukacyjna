/**
 * ============================================================================
 * PLIK: handlers/text-handler.ts — Handler elementów tekstowych
 * ============================================================================
 *
 * Resize:  proporcjonalne skalowanie (Miro-style) – szerokość i czcionka
 *          rosną o ten sam %, układ tekstu (łamanie wierszy) nie zmienia się.
 * Rotate:  obrót środka wokół pivota + zapis kąta rotacji do elementu.
 * Render:  bez clampowania czcionki – pełne skalowanie z viewportem.
 * ============================================================================
 */

import type { TextElement, ViewportTransform } from '@/_new/features/whiteboard/types';
import type { ElementHandler, BoundingBox, RenderExtras } from './types';
import { rotateAroundPivot, getRotatedAABB, getSimpleAABB } from './handler-utils';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';

// ─── Pomocnicza – zawijanie tekstu na canvasie ────────────────────────────────

function calculateRequiredTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): number {
  const lines = text.split('\n');
  let total = 0;

  for (const line of lines) {
    const words = line.split(' ');
    let current = '';

    for (const word of words) {
      const test = current + (current ? ' ' : '') + word;
      if (ctx.measureText(test).width > maxWidth && current) {
        total++;
        current = word;
        while (ctx.measureText(current).width > maxWidth) {
          let fit = 0;
          for (let j = 1; j <= current.length; j++) {
            if (ctx.measureText(current.substring(0, j)).width <= maxWidth) fit = j;
            else break;
          }
          if (fit === 0) fit = 1;
          total++;
          current = current.substring(fit);
        }
      } else {
        current = test;
      }
    }

    while (current && ctx.measureText(current).width > maxWidth) {
      let fit = 0;
      for (let j = 1; j <= current.length; j++) {
        if (ctx.measureText(current.substring(0, j)).width <= maxWidth) fit = j;
        else break;
      }
      if (fit === 0) fit = 1;
      total++;
      current = current.substring(fit);
    }
    if (current) total++;
  }

  return total;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const TextHandler: ElementHandler<TextElement> = {
  canResize: true,
  canRotate: true,

  getBoundingBox(el): BoundingBox {
    const w = el.width  ?? 3;
    const h = el.height ?? 1;
    if (el.rotation && el.rotation !== 0) {
      return getRotatedAABB(el.x, el.y, w, h, el.rotation);
    }
    return getSimpleAABB(el.x, el.y, w, h);
  },

  isPointInElement(point, el) {
    const w = el.width  ?? 3;
    const h = el.height ?? 1;

    if (el.rotation && el.rotation !== 0) {
      // Odwróć punkt o –rotację wokół środka elementu
      const cx = el.x + w / 2;
      const cy = el.y + h / 2;
      const cos = Math.cos(-el.rotation);
      const sin = Math.sin(-el.rotation);
      const dx = point.x - cx;
      const dy = point.y - cy;
      const rx = cx + dx * cos - dy * sin;
      const ry = cy + dx * sin + dy * cos;
      return rx >= el.x && rx <= el.x + w && ry >= el.y && ry <= el.y + h;
    }

    return point.x >= el.x && point.x <= el.x + w && point.y >= el.y && point.y <= el.y + h;
  },

  resize(el, pivotX, pivotY, scaleX, scaleY) {
    // Miro-style: czyste proporcjonalne skalowanie
    return {
      x:        pivotX + (el.x - pivotX) * scaleX,
      y:        pivotY + (el.y - pivotY) * scaleY,
      width:    (el.width  ?? 3) * scaleX,
      height:   (el.height ?? 1) * scaleY,
      fontSize: el.fontSize * scaleX,
    };
  },

  move(el, dx, dy) {
    return { x: el.x + dx, y: el.y + dy };
  },

  rotate(el, rotationAngle, pivot, cos, sin) {
    const w = el.width  ?? 3;
    const h = el.height ?? 1;
    const cx = el.x + w / 2;
    const cy = el.y + h / 2;
    const newCenter = rotateAroundPivot({ x: cx, y: cy }, pivot, cos, sin);

    return {
      x:        newCenter.x - w / 2,
      y:        newCenter.y - h / 2,
      rotation: (el.rotation ?? 0) + rotationAngle,
    };
  },

  render(ctx, el, viewport, canvasWidth, canvasHeight, extras) {
    const pos = transformPoint({ x: el.x, y: el.y }, viewport, canvasWidth, canvasHeight);

    if (el.rotation && el.rotation !== 0) {
      ctx.save();
      const w = (el.width ?? 3) * viewport.scale * 100;
      const h = (el.height ?? 1) * viewport.scale * 100;
      const cx = pos.x + w / 2;
      const cy = pos.y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(el.rotation);
      ctx.translate(-cx, -cy);
    }

    const fontWeight = el.fontWeight ?? 'normal';
    const fontStyle  = el.fontStyle  ?? 'normal';
    const fontFamily = el.fontFamily ?? 'Arial, sans-serif';
    // Brak clampowania – pełne skalowanie z viewportem
    const fontSize   = el.fontSize * viewport.scale;

    ctx.fillStyle    = el.color;
    ctx.font         = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';

    const textAlign = el.textAlign ?? 'left';
    ctx.textAlign   = textAlign;

    const lines      = el.text.split('\n');
    const lineHeight = fontSize * 1.4;
    const paddingX   = 0;
    const paddingY   = 0;

    let textX = pos.x + paddingX;
    if (el.width) {
      const boxWidth     = el.width * viewport.scale * 100;
      const contentWidth = boxWidth - paddingX * 2;
      if (textAlign === 'center') textX = pos.x + paddingX + contentWidth / 2;
      else if (textAlign === 'right') textX = pos.x + paddingX + contentWidth;
    }

    if (el.width) {
      const boxWidth = el.width * viewport.scale * 100;
      const maxWidth = boxWidth - paddingX * 2;

      if (extras?.debug) {
        const requiredLines = calculateRequiredTextLines(ctx, el.text, maxWidth);
        const reqPx = requiredLines * lineHeight + paddingY * 2;
        const curPx = (el.height ?? 0) * viewport.scale * 100;
        const needsExpand = reqPx > curPx;

        ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, boxWidth, curPx);
        ctx.strokeStyle = needsExpand ? 'rgba(255,0,0,0.8)' : 'rgba(0,255,0,0.8)';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(pos.x, pos.y, boxWidth, reqPx);
        ctx.setLineDash([]);

        if (needsExpand && extras?.onAutoExpand) {
          const newH = reqPx / (viewport.scale * 100);
          extras.onAutoExpand(el.id, newH);
        }
      }

      let currentY = pos.y + paddingY;

      for (const line of lines) {
        const words = line.split(' ');
        let current = '';

        for (const word of words) {
          const test = current + (current ? ' ' : '') + word;
          if (ctx.measureText(test).width > maxWidth && current) {
            ctx.fillText(current, textX, currentY);
            current  = word;
            currentY += lineHeight;

            while (ctx.measureText(current).width > maxWidth) {
              let fit = 0;
              for (let j = 1; j <= current.length; j++) {
                if (ctx.measureText(current.substring(0, j)).width <= maxWidth) fit = j;
                else break;
              }
              if (fit === 0) fit = 1;
              ctx.fillText(current.substring(0, fit), textX, currentY);
              current  = current.substring(fit);
              currentY += lineHeight;
            }
          } else {
            current = test;
          }
        }

        while (current && ctx.measureText(current).width > maxWidth) {
          let fit = 0;
          for (let j = 1; j <= current.length; j++) {
            if (ctx.measureText(current.substring(0, j)).width <= maxWidth) fit = j;
            else break;
          }
          if (fit === 0) fit = 1;
          ctx.fillText(current.substring(0, fit), textX, currentY);
          current  = current.substring(fit);
          currentY += lineHeight;
        }

        if (current) { ctx.fillText(current, textX, currentY); currentY += lineHeight; }
      }
    } else {
      lines.forEach((line, i) => {
        ctx.fillText(line, textX, pos.y + paddingY + i * lineHeight);
      });
    }

    if (el.rotation && el.rotation !== 0) ctx.restore();
  },
};
