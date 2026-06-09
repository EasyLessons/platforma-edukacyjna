/**
 * ============================================================================
 * PLIK: tools/registry.ts — Rejestr wtyczek-narzędzi
 * ============================================================================
 *
 * Jedyne miejsce, gdzie zbieramy wszystkie narzędzia. Dodanie narzędzia =
 * dopisanie jednej linii do ALL_TOOLS (po utworzeniu pliku `*.tool.tsx`).
 *
 * Toolbar, <ActiveToolOverlay/>, skróty (TOOL_SHORTCUTS), kursor i filtr ról
 * czytają z tego rejestru zamiast hardkodować listy.
 * ============================================================================
 */

import type { ToolDefinition, ToolId } from './types';

import { selectTool } from './select.tool';
import { panTool } from './pan.tool';
import { penTool } from './pen.tool';
import { textTool } from './text.tool';
import { shapeTool } from './shape.tool';
import { functionTool } from './function.tool';
import { imageTool } from './image.tool';
import { eraserTool } from './eraser.tool';
import { markdownTool } from './markdown.tool';
import { tableTool } from './table.tool';
import { arrowTool } from './arrow.tool';

/** Pełna lista narzędzi (kolejność nie ma znaczenia — sortujemy po `order`). */
export const ALL_TOOLS: ToolDefinition[] = [
  selectTool,
  panTool,
  penTool,
  textTool,
  shapeTool,
  functionTool,
  imageTool,
  eraserTool,
  markdownTool,
  tableTool,
  arrowTool,
];

export const toolRegistry: ReadonlyMap<ToolId, ToolDefinition> = new Map(
  ALL_TOOLS.map((t) => [t.id, t]),
);

export const getTool = (id: ToolId): ToolDefinition | undefined => toolRegistry.get(id);

/** Mapa skrót → id narzędzia (budowana raz; zastępuje switch w canvasie). */
export const TOOL_SHORTCUTS: ReadonlyMap<string, ToolId> = new Map(
  ALL_TOOLS.filter((t) => t.shortcut).map((t) => [t.shortcut as string, t.id]),
);
