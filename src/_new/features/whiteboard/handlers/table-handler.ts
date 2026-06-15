/**
 * ============================================================================
 * PLIK: handlers/table-handler.ts — Handler tabel
 * ============================================================================
 *
 * Tabela rysuje siatkę na canvas; treść komórek renderuje React overlay.
 * Przy resize automatycznie skaluje fontSize (calculateTableFontSize).
 * ============================================================================
 */

import type { TableElement, ViewportTransform } from '@/_new/features/whiteboard/types';
import type { ElementHandler, BoundingBox, RenderExtras } from './types';
import { rotateAroundPivot, getSimpleAABB } from './handler-utils';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';
import { calculateTableFontSize } from '@/_new/features/whiteboard/elements/table-helpers';

const MIN_SIZE = 0.1;

// ─── Word-wrap cache ──────────────────────────────────────────────────────────
//
// Slot key  (outer): `${table.id}|${r}|${c}`   — jeden wpis per komórka
// Content key (inner): krotka `text|maxW|fontSize|bold` — klucz weryfikacyjny
// MISS → rekalkulacja przez computeCellWrappedLines (ctx.measureText)
// HIT  → O(1), brak allocacji
// Inwalidacja per-table: invalidateTableWrapCache(id) usuwa wszystkie sloty tabeli.

interface CellCacheEntry {
  key: string;
  lines: string[];
}

const tableWrapCache = new Map<string, CellCacheEntry>();

/** Wywołaj przy usunięciu tabeli, aby zwolnić pamięć cache. */
export function invalidateTableWrapCache(tableId: string): void {
  const prefix = tableId + '|';
  for (const k of tableWrapCache.keys()) {
    if (k.startsWith(prefix)) tableWrapCache.delete(k);
  }
}

function getTableCellWrappedLines(
  ctx: CanvasRenderingContext2D,
  tableId: string,
  r: number,
  c: number,
  cellText: string,
  maxWidth: number,
  fontSize: number,
  bold: boolean,
): string[] {
  const slotKey    = `${tableId}|${r}|${c}`;
  const contentKey = `${cellText}|${maxWidth.toFixed(1)}|${fontSize.toFixed(1)}|${bold ? '1' : '0'}`;

  const cached = tableWrapCache.get(slotKey);
  if (cached?.key === contentKey) return cached.lines; // HIT — O(1)

  const lines = computeCellWrappedLines(ctx, cellText, maxWidth); // MISS
  tableWrapCache.set(slotKey, { key: contentKey, lines });
  return lines;
}

function computeCellWrappedLines(
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
      // Słowo szersze niż komórka → łamanie znak po znaku
      if (ctx.measureText(word).width > maxWidth) {
        if (current) { result.push(current); current = ''; }

        let remaining = word;
        while (ctx.measureText(remaining).width > maxWidth) {
          let fit = 0;
          for (let j = 1; j <= remaining.length; j++) {
            if (ctx.measureText(remaining.substring(0, j)).width <= maxWidth) fit = j;
            else break;
          }
          if (fit === 0) fit = 1;
          result.push(remaining.substring(0, fit));
          remaining = remaining.substring(fit);
        }
        current = remaining;
        continue;
      }

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

export const TableHandler: ElementHandler<TableElement> = {
  canResize: true,
  canRotate: false,

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
    const newWidth  = Math.max(MIN_SIZE, el.width  * scaleX);
    const newHeight = Math.max(MIN_SIZE, el.height * scaleY);
    return {
      x:        pivotX + (el.x - pivotX) * scaleX,
      y:        pivotY + (el.y - pivotY) * scaleY,
      width:    newWidth,
      height:   newHeight,
      fontSize: calculateTableFontSize(newHeight, el.rows),
    } as any;
  },

  move(el, dx, dy) {
    return { x: el.x + dx, y: el.y + dy };
  },

  rotate(el, _rotationAngle, pivot, cos, sin) {
    const cx = el.x + el.width  / 2;
    const cy = el.y + el.height / 2;
    const newCenter = rotateAroundPivot({ x: cx, y: cy }, pivot, cos, sin);
    return {
      x: newCenter.x - el.width  / 2,
      y: newCenter.y - el.height / 2,
    };
  },

  render(ctx, table, viewport, canvasWidth, canvasHeight) {
    const topLeft     = transformPoint({ x: table.x, y: table.y }, viewport, canvasWidth, canvasHeight);
    const bottomRight = transformPoint(
      { x: table.x + table.width, y: table.y + table.height },
      viewport, canvasWidth, canvasHeight,
    );

    const sw         = bottomRight.x - topLeft.x;
    const sh         = bottomRight.y - topLeft.y;
    const cellWidth  = sw / table.cols;
    const cellHeight = sh / table.rows;

    // Tło
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(topLeft.x, topLeft.y, sw, sh);

    // Tło nagłówka
    if (table.headerRow) {
      ctx.fillStyle = table.headerBgColor ?? '#f3f4f6';
      ctx.fillRect(topLeft.x, topLeft.y, sw, cellHeight);
    }

    // Siatka
    ctx.strokeStyle = table.borderColor ?? '#d1d5db';
    ctx.lineWidth   = 1;
    ctx.strokeRect(topLeft.x, topLeft.y, sw, sh);

    for (let r = 1; r < table.rows; r++) {
      const y = topLeft.y + r * cellHeight;
      ctx.beginPath(); ctx.moveTo(topLeft.x, y); ctx.lineTo(topLeft.x + sw, y); ctx.stroke();
    }
    for (let c = 1; c < table.cols; c++) {
      const x = topLeft.x + c * cellWidth;
      ctx.beginPath(); ctx.moveTo(x, topLeft.y); ctx.lineTo(x, topLeft.y + sh); ctx.stroke();
    }

    // Tekst komórek z word-wrappingiem i cache'owaniem
    const worldFontSize = table.fontSize ?? 0.12;
    const fontSize      = worldFontSize * viewport.scale * 100;
    const lineHeight    = fontSize * 1.2;
    // Horizontal padding per side matches the clip rect inset (3px)
    const wrapMaxWidth  = cellWidth - 8;

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < table.rows; r++) {
      for (let c = 0; c < table.cols; c++) {
        const cellText = table.cells[r]?.[c] ?? '';
        if (!cellText) continue;

        const isBold = r === 0 && !!table.headerRow;

        // Font musi być ustawiony przed getTableCellWrappedLines,
        // bo computeCellWrappedLines używa ctx.measureText z aktualnym fontem.
        ctx.font      = isBold
          ? `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
          : `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = isBold ? '#111827' : '#374151';

        const wrappedLines = getTableCellWrappedLines(
          ctx, table.id, r, c, cellText, wrapMaxWidth, fontSize, isBold,
        );

        const cx     = topLeft.x + c * cellWidth  + cellWidth  / 2;
        const cy     = topLeft.y + r * cellHeight + cellHeight / 2;
        const startY = cy - ((wrappedLines.length - 1) * lineHeight) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(topLeft.x + c * cellWidth + 3, topLeft.y + r * cellHeight + 2, cellWidth - 6, cellHeight - 4);
        ctx.clip();

        for (let i = 0; i < wrappedLines.length; i++) {
          ctx.fillText(wrappedLines[i], cx, startY + i * lineHeight);
        }

        ctx.restore();
      }
    }
  },
};
