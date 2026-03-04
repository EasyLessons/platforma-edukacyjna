/**
 * ============================================================================
 * PLIK: handlers/element-registry.ts — Rejestr handlerów elementów
 * ============================================================================
 *
 * Mapuje string type → handler.  Jedyne miejsce, gdzie łączymy typ elementu
 * z jego implementacją.  select-tool.tsx i rendering.ts pytają ten rejestr
 * zamiast stosować if/else.
 *
 * Użycie:
 *
 *   import { ElementRegistry } from '@/_new/features/whiteboard/handlers/element-registry';
 *
 *   const handler = ElementRegistry[element.type];
 *   if (handler) {
 *     updatesMap.set(el.id, handler.resize(el, pivotX, pivotY, scaleX, scaleY));
 *   }
 *
 * ============================================================================
 */

import type { DrawingElement } from '@/_new/features/whiteboard/types';
import type { ElementHandler } from './types';

import { PathHandler }     from './path-handler';
import { ShapeHandler }    from './shape-handler';
import { TextHandler }     from './text-handler';
import { ImageHandler }    from './image-handler';
import { MarkdownHandler } from './markdown-handler';
import { TableHandler }    from './table-handler';
import { PdfHandler }      from './pdf-handler';

/**
 * Główny rejestr.
 * Klucze odpowiadają wartości pola `type` w DrawingElement (union).
 * Wartość `ElementHandler<any>` – zawężono do `any`, by uniknąć
 * problemów z wariancją generyczną podczas zwykłego lookup.
 */
export const ElementRegistry: Partial<Record<DrawingElement['type'], ElementHandler<any>>> = {
  path:     PathHandler,
  shape:    ShapeHandler,
  text:     TextHandler,
  image:    ImageHandler,
  markdown: MarkdownHandler,
  table:    TableHandler,
  pdf:      PdfHandler,
  // 'function' – brak handlera (nie jest zaznaczalny w select-tool)
};
