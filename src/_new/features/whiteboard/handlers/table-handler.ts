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
      // Automatyczne skalowanie czcionki wraz z rozmiarem tabeli
      fontSize: calculateTableFontSize(newHeight, el.rows),
    } as any;
  },

  move(el, dx, dy) {
    return { x: el.x + dx, y: el.y + dy };
  },

  rotate(el, _rotationAngle, pivot, cos, sin) {
    // Tabela nie obraca się – przesuwa środek wokół pivota zaznaczenia
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

    // Tekst komórek – pełne skalowanie z viewportem
    const worldFontSize  = table.fontSize ?? 0.12;
    const fontSize       = worldFontSize * viewport.scale * 100;

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < table.rows; r++) {
      for (let c = 0; c < table.cols; c++) {
        const cellText = table.cells[r]?.[c] ?? '';
        if (!cellText) continue;

        const cx = topLeft.x + c * cellWidth  + cellWidth  / 2;
        const cy = topLeft.y + r * cellHeight + cellHeight / 2;

        if (r === 0 && table.headerRow) {
          ctx.font      = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillStyle = '#111827';
        } else {
          ctx.font      = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillStyle = '#374151';
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(topLeft.x + c * cellWidth + 3, topLeft.y + r * cellHeight + 2, cellWidth - 6, cellHeight - 4);
        ctx.clip();

        const lines      = cellText.split('\n');
        const lineHeight = fontSize * 1.2;
        const startY     = cy - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, i) => {
          ctx.fillText(line, cx, startY + i * lineHeight, cellWidth - 8);
        });

        ctx.restore();
      }
    }
  },
};
