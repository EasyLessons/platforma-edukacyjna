/**
 * ============================================================================
 * PLIK: handlers/text-handler.ts — Handler elementów tekstowych
 * ============================================================================
 *
 * Resize:  proporcjonalne skalowanie (Miro-style) – szerokość i czcionka
 *          rosną o ten sam %, układ tekstu (łamanie wierszy) nie zmienia się.
 * Rotate:  obrót środka wokół pivota + zapis kąta rotacji do elementu.
 * Render:  czysta funkcja – brak callbacków mutujących stan (patrz text-architecture.md).
 * ============================================================================
 */

import type { TextElement, ViewportTransform } from '@/_new/features/whiteboard/types';
import type { ElementHandler, BoundingBox, RenderExtras } from './types';
import { rotateAroundPivot, getRotatedAABB, getSimpleAABB } from './handler-utils';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';


// ─── Cache per-element ────────────────────────────────────────────────────────
//
// Klucz główny Map: el.id (jeden wpis per element).
// Klucz weryfikacyjny (CacheEntry.key): 6-polowa krotka rozdzielona "|".
// Zmiana któregokolwiek z 6 pól → MISS → rekalkulacja.
// Brak globalnego "stop-the-world" clear() — inwalidacja wyłącznie per el.id.

interface CacheEntry {
  key: string;
  lines: string[];
}

const textWrapCache = new Map<string, CacheEntry>();

/** Wywołaj przy usunięciu elementu tekstowego, aby zwolnić pamięć cache. */
export function invalidateTextCache(id: string): void {
  textWrapCache.delete(id);
}

function getWrappedLines(
  ctx: CanvasRenderingContext2D,
  el: TextElement,
  maxWidth: number,
): string[] {
  const newKey = [
    el.text,
    maxWidth.toFixed(1),
    el.fontSize,
    el.fontFamily  ?? 'Arial',
    el.fontWeight  ?? 'normal',
    el.fontStyle   ?? 'normal',
  ].join('|');

  const cached = textWrapCache.get(el.id);
  if (cached?.key === newKey) return cached.lines; // HIT — O(1)

  const lines = computeWrappedLines(ctx, el.text, maxWidth); // MISS
  textWrapCache.set(el.id, { key: newKey, lines });
  return lines;
}

function computeWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n');
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let current = '';

    for (const word of words) {
      // Słowo szersze niż ramka → łamanie znak po znaku
      if (ctx.measureText(word).width > maxWidth) {
        if (current) { result.push(current); current = ''; }

        let remaining = word;
        while (ctx.measureText(remaining).width > maxWidth) {
          let fit = 0;
          for (let j = 1; j <= remaining.length; j++) {
            if (ctx.measureText(remaining.substring(0, j)).width <= maxWidth) fit = j;
            else break;
          }
          if (fit === 0) fit = 1; // wymuś min. 1 znak
          result.push(remaining.substring(0, fit));
          remaining = remaining.substring(fit);
        }
        current = remaining;
        continue;
      }

      // Normalne słowo: dodaj do bieżącej linii lub zacznij nową
      const test = current + (current ? ' ' : '') + word;
      if (ctx.measureText(test).width > maxWidth && current) {
        result.push(current);
        current = word;
      } else {
        current = test;
      }
    }

    if (current) result.push(current);
  }

  return result;
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

    return (
      point.x >= el.x && point.x <= el.x + w &&
      point.y >= el.y && point.y <= el.y + h
    );
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
      const w  = (el.width  ?? 3) * viewport.scale * 100;
      const h  = (el.height ?? 1) * viewport.scale * 100;
      const cx = pos.x + w / 2;
      const cy = pos.y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(el.rotation);
      ctx.translate(-cx, -cy);
    }

    const fontWeight = el.fontWeight ?? 'normal';
    const fontStyle  = el.fontStyle  ?? 'normal';
    const fontFamily = el.fontFamily ?? 'Arial, sans-serif';
    const fontSize   = el.fontSize * viewport.scale;

    ctx.fillStyle    = el.color;
    ctx.font         = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';

    const textAlign = el.textAlign ?? 'left';
    ctx.textAlign   = textAlign;

    const lineHeight = fontSize * 1.4;
    const paddingX   = 0;
    const paddingY   = 0;

    let textX = pos.x + paddingX;

    if (el.width) {
      const boxWidth     = el.width * viewport.scale * 100;
      const contentWidth = boxWidth - paddingX * 2;
      if (textAlign === 'center') textX = pos.x + paddingX + contentWidth / 2;
      else if (textAlign === 'right') textX = pos.x + paddingX + contentWidth;

      const maxWidth     = boxWidth - paddingX * 2;
      const wrappedLines = getWrappedLines(ctx, el, maxWidth);

      if (extras?.debug) {
        const curPx = (el.height ?? 0) * viewport.scale * 100;
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
        ctx.lineWidth   = 2;
        ctx.strokeRect(pos.x, pos.y, boxWidth, curPx);
      }

      let currentY = pos.y + paddingY;
      for (const line of wrappedLines) {
        ctx.fillText(line, textX, currentY);
        currentY += lineHeight;
      }
    } else {
      el.text.split('\n').forEach((line, i) => {
        ctx.fillText(line, textX, pos.y + paddingY + i * lineHeight);
      });
    }

    if (el.rotation && el.rotation !== 0) ctx.restore();
  },
};
