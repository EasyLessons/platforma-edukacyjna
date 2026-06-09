/**
 * ============================================================================
 * PLIK: tools/tool-host-context.tsx — Gniazdko dla wtyczek-narzędzi
 * ============================================================================
 *
 * Jeden kontekst dostarczany przez canvas, niosący:
 *  - silnik (stabilny z Fazy 1),
 *  - reaktywny stan potrzebny narzędziom (viewport, elements, selekcja…),
 *  - refy współdzielone (htmlOverlays, edytor tekstu, ImageTool),
 *  - callbacki-klej, które NIE są intencjami silnika (UI: setTool/loadImage/edycja…).
 *
 * Konsumuje go WYŁĄCZNIE aktualnie zamontowany overlay (jeden naraz przez
 * <ActiveToolOverlay/>), więc zmiany reaktywne re-renderują tylko aktywne
 * narzędzie — dokładnie jak dawna drabinka. Toolbar NIE konsumuje tego
 * kontekstu (czyta tylko store), więc pan/zoom go nie re-renderują.
 * ============================================================================
 */

'use client';

import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type {
  DrawingElement,
  DrawingPath,
  Shape,
  FunctionPlot,
  ImageElement,
  MarkdownNote,
  TableElement,
  ArrowElement,
  TextElement,
  ViewportTransform,
} from '@/_new/features/whiteboard/types';
import type { GuideLine } from '@/_new/features/whiteboard/selection/snap-utils';
import type { ImageToolRef } from '@/_new/features/whiteboard/components/toolbar/image-tool';
import type { WhiteboardEngine } from '@/_new/features/whiteboard/engine/types';

export interface ToolHostContextValue {
  // ── silnik + stan współdzielony ──
  engine: WhiteboardEngine;
  viewport: ViewportTransform;
  viewportRef: RefObject<ViewportTransform>;
  canvasWidth: number;
  canvasHeight: number;
  isGestureActive: boolean;
  onViewportChange: (viewport: ViewportTransform) => void;

  // ── reaktywny stan ──
  elements: DrawingElement[];
  selectedIds: Set<string>;
  editingTextId: string | null;
  overlaysVisible: boolean;

  // ── refy współdzielone z canvasem ──
  htmlOverlaysRef: RefObject<HTMLDivElement | null>;
  textEditorDivRef: RefObject<HTMLDivElement | null>;
  imageToolRef: RefObject<ImageToolRef | null>;

  // ── tworzenie (forward do handlerów canvasu, które wołają silnik) ──
  onPathCreate: (path: DrawingPath) => void;
  onShapeCreate: (shape: Shape) => void;
  onFunctionCreate: (func: FunctionPlot) => void;
  onImageCreate: (image: ImageElement) => void;
  onNoteCreate: (note: MarkdownNote) => void;
  onTableCreate: (table: TableElement) => void;
  onArrowCreate: (arrow: ArrowElement) => void;
  onTextCreate: (text: TextElement) => void;

  // ── tekst ──
  onTextUpdate: (id: string, updates: Partial<TextElement>) => void;
  onTextDelete: (id: string) => void;
  onEditingComplete: () => void;
  onTextEdit: (id: string) => void;

  // ── select ──
  onSelectionChange: (ids: Set<string>) => void;
  onElementUpdate: (id: string, updates: Partial<DrawingElement>) => void;
  onElementUpdateWithHistory: (id: string, updates: Partial<DrawingElement>) => void;
  onElementsUpdate: (updates: Map<string, Partial<DrawingElement>>) => void;
  onOperationFinish: (originalElements?: Map<string, DrawingElement>) => void;
  onMarkdownEdit: (id: string) => void;
  onActiveGuidesChange: (guides: GuideLine[]) => void;
  onDeleteSelected: () => void;
  onCopySelected: () => void;
  onDuplicateSelected: () => void;
  onSaveGroupTemplate: (elements: DrawingElement[]) => void;

  // ── eraser ──
  onElementDelete: (id: string) => void;

  // ── pan ──
  onPanStart: () => void;
  onPanEnd: () => void;
}

const ToolHostContext = createContext<ToolHostContextValue | null>(null);

export const ToolHostProvider = ToolHostContext.Provider;

export function useToolHost(): ToolHostContextValue {
  const value = useContext(ToolHostContext);
  if (!value) {
    throw new Error('useToolHost musi być użyty wewnątrz <ToolHostProvider>');
  }
  return value;
}
