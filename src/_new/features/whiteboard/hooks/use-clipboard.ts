/**
 * use-clipboard.ts
 *
 * Obsługuje kopiowanie, duplikację i wklejanie elementów na tablicy.
 *
 * ODPOWIEDZIALNOŚĆ:
 *  - Ctrl+C (handleCopy) — zapamiętuje zaznaczone elementy
 *  - Ctrl+D (handleDuplicate) — duplikuje z offsetem 0.3 jednostki
 *  - Ctrl+V (handlePaste) — wkleja w środek aktualnego widoku
 *
 * Zależności zewnętrzne przekazywane jako parametry:
 *  - elementsRef / selectedElementIdsRef / viewportRef / canvasRef — odczyt bieżącego stanu
 *  - onAddElements — dodaje nowe elementy do stanu tablicy
 *  - onBroadcastCreated — informuje innych użytkowników
 *  - onMarkUnsaved — oznacza element jako wymagający zapisu
 *  - onDebouncedSave — triggeruje zapis do bazy po 2s
 *  - onSelectElements — zaznacza nowo wklejone/zduplikowane elementy
 *  - boardIdRef — aktualny boardId do triggeru save
 */

import { useState, useCallback } from 'react';
import { inverseTransformPoint } from '../navigation/viewport-math';
import type { DrawingElement, DrawingPath, Shape, TextElement, ImageElement,
  MarkdownNote, TableElement, FunctionPlot, PDFElement, ViewportTransform } from '../types';

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface UseClipboardOptions {
  elementsRef: React.RefObject<DrawingElement[]>;
  selectedElementIdsRef: React.RefObject<Set<string>>;
  viewportRef: React.RefObject<ViewportTransform>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  boardIdRef: React.RefObject<string>;
  onAddElements: (newElements: DrawingElement[]) => void;
  onBroadcastCreated: (element: DrawingElement) => Promise<void>;
  onMarkUnsaved: (ids: string[]) => void;
  onDebouncedSave: (boardId: string) => void;
  onSelectElements: (ids: string[]) => void;
  onLoadImage?: (id: string, src: string) => void;
}

export interface UseClipboardReturn {
  copiedElements: DrawingElement[];
  handleCopy: () => void;
  handleDuplicate: () => void;
  handlePaste: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DUPLICATE_OFFSET = 0.3;

function generateId(): string {
  return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
}

function offsetElement(el: DrawingElement, dx: number, dy: number): DrawingElement {
  switch (el.type) {
    case 'path':
      return { ...el, id: generateId(), points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } as DrawingPath;
    case 'shape':
      return { ...el, id: generateId(), startX: el.startX + dx, startY: el.startY + dy, endX: el.endX + dx, endY: el.endY + dy } as Shape;
    case 'text':
      return { ...el, id: generateId(), x: el.x + dx, y: el.y + dy } as TextElement;
    case 'image':
      return { ...el, id: generateId(), x: el.x + dx, y: el.y + dy } as ImageElement;
    case 'markdown':
      return { ...el, id: generateId(), x: el.x + dx, y: el.y + dy } as MarkdownNote;
    case 'table':
      return { ...el, id: generateId(), x: el.x + dx, y: el.y + dy, cells: el.cells.map((row) => [...row]) } as TableElement;
    case 'function':
      return { ...(el as FunctionPlot), id: generateId() } as FunctionPlot;
    case 'pdf':
      return { ...el, id: generateId(), x: el.x + dx, y: el.y + dy } as PDFElement;
    default:
      return { ...el, id: generateId() };
  }
}

/** Oblicz środek grupy elementów w przestrzeni świata */
function groupCenter(elements: DrawingElement[]): { x: number; y: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach((el) => {
    if (el.type === 'path') {
      el.points.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    } else if (el.type === 'shape') {
      minX = Math.min(minX, el.startX, el.endX); minY = Math.min(minY, el.startY, el.endY);
      maxX = Math.max(maxX, el.startX, el.endX); maxY = Math.max(maxY, el.startY, el.endY);
    } else if ('x' in el && 'y' in el) {
      const typed = el as { x: number; y: number; width?: number; height?: number };
      minX = Math.min(minX, typed.x); minY = Math.min(minY, typed.y);
      maxX = Math.max(maxX, typed.x + (typed.width ?? 0)); maxY = Math.max(maxY, typed.y + (typed.height ?? 0));
    }
  });
  return {
    x: isFinite(minX) ? (minX + maxX) / 2 : 0,
    y: isFinite(minY) ? (minY + maxY) / 2 : 0,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useClipboard({
  elementsRef,
  selectedElementIdsRef,
  viewportRef,
  canvasRef,
  boardIdRef,
  onAddElements,
  onBroadcastCreated,
  onMarkUnsaved,
  onDebouncedSave,
  onSelectElements,
  onLoadImage,
}: UseClipboardOptions): UseClipboardReturn {

  const [copiedElements, setCopiedElements] = useState<DrawingElement[]>([]);

  // ─── Copy ──────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const selectedIds = selectedElementIdsRef.current;
    if (!selectedIds || selectedIds.size === 0) return;
    const toCopy = (elementsRef.current ?? []).filter((el) => selectedIds.has(el.id));
    setCopiedElements(toCopy);
  }, [elementsRef, selectedElementIdsRef]);

  // ─── Duplicate ─────────────────────────────────────────────────────────
  const handleDuplicate = useCallback(() => {
    const selectedIds = selectedElementIdsRef.current;
    if (!selectedIds || selectedIds.size === 0) return;
    const toDuplicate = (elementsRef.current ?? []).filter((el) => selectedIds.has(el.id));
    if (toDuplicate.length === 0) return;

    const newElements = toDuplicate.map((el) =>
      offsetElement(el, DUPLICATE_OFFSET, DUPLICATE_OFFSET)
    );

    onAddElements(newElements);
    onMarkUnsaved(newElements.map((e) => e.id));
    newElements.forEach((el) => {
      onBroadcastCreated(el);
      if (el.type === 'image' && (el as ImageElement).src && onLoadImage) {
        onLoadImage(el.id, (el as ImageElement).src);
      }
    });
    if (boardIdRef.current) onDebouncedSave(boardIdRef.current);
    onSelectElements(newElements.map((e) => e.id));
  }, [elementsRef, selectedElementIdsRef, boardIdRef, onAddElements, onBroadcastCreated, onMarkUnsaved, onDebouncedSave, onSelectElements, onLoadImage]);

  // ─── Paste ─────────────────────────────────────────────────────────────
  const handlePaste = useCallback(() => {
    if (copiedElements.length === 0) return;
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;

    // Środek ekranu → przestrzeń świata
    const centerWorld = inverseTransformPoint(
      { x: canvas.width / 2, y: canvas.height / 2 },
      viewport,
      canvas.width,
      canvas.height
    );

    const originalCenter = groupCenter(copiedElements);
    const dx = centerWorld.x - originalCenter.x;
    const dy = centerWorld.y - originalCenter.y;

    const newElements = copiedElements.map((el) => offsetElement(el, dx, dy));

    onAddElements(newElements);
    onMarkUnsaved(newElements.map((e) => e.id));
    newElements.forEach((el) => {
      onBroadcastCreated(el);
      if (el.type === 'image' && (el as ImageElement).src && onLoadImage) {
        onLoadImage(el.id, (el as ImageElement).src);
      }
    });
    if (boardIdRef.current) onDebouncedSave(boardIdRef.current);
    onSelectElements(newElements.map((e) => e.id));
  }, [copiedElements, canvasRef, viewportRef, boardIdRef, onAddElements, onBroadcastCreated, onMarkUnsaved, onDebouncedSave, onSelectElements, onLoadImage]);

  return { copiedElements, handleCopy, handleDuplicate, handlePaste };
}
