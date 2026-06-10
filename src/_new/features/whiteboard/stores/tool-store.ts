/**
 * ============================================================================
 * PLIK: stores/tool-store.ts — Store narzędzi (zustand)
 * ============================================================================
 *
 * Następca tool-properties-store.ts (Faza 1). Trzyma:
 *  - właściwości narzędzi (color/lineWidth/fontSize/fillShape/selectedShape/polygonSides),
 *  - aktywne narzędzie `activeTool` (Faza 2 — przeniesione z useState w canvasie).
 *
 * Dlaczego zustand: selektory → granularna subskrypcja (zmiana koloru nie
 * re-renderuje komponentów czytających tylko `activeTool`), a hot-path może
 * czytać przez useToolStore.getState() bez re-renderów.
 * ============================================================================
 */

import { create } from 'zustand';
import type { ShapeType } from '@/_new/features/whiteboard/types';

/** Akcje narzędzia Obraz (wklej/wgraj obraz/wgraj PDF) — rejestrowane przez canvas. */
export interface ImageToolActions {
  paste: () => void;
  upload: () => void;
  pdfUpload: () => void;
}

export interface ToolStoreState {
  // ── właściwości ──
  color: string;
  lineWidth: number;
  fontSize: number;
  fillShape: boolean;
  selectedShape: ShapeType;
  polygonSides: number;
  // ── aktywne narzędzie (Faza 2) — `string` == ToolId (rozszerzalny) ──
  activeTool: string;
  // ── akcje narzędzia Obraz (Faza 3) — rejestrowane przez canvas, używane przez ImageProperties ──
  imageActions: ImageToolActions;

  // ── settery (drop-in za dawne setX z useState) ──
  setColor: (color: string) => void;
  setLineWidth: (lineWidth: number) => void;
  setFontSize: (fontSize: number) => void;
  setFillShape: (fillShape: boolean) => void;
  setSelectedShape: (selectedShape: ShapeType) => void;
  setPolygonSides: (polygonSides: number) => void;
  setActiveTool: (activeTool: string) => void;
  setImageActions: (imageActions: ImageToolActions) => void;
}

export const useToolStore = create<ToolStoreState>((set) => ({
  color: '#000000',
  lineWidth: 4,
  fontSize: 70,
  fillShape: false,
  selectedShape: 'rectangle',
  polygonSides: 5,
  activeTool: 'select',
  imageActions: { paste: () => {}, upload: () => {}, pdfUpload: () => {} },

  setColor: (color) => set({ color }),
  setLineWidth: (lineWidth) => set({ lineWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFillShape: (fillShape) => set({ fillShape }),
  setSelectedShape: (selectedShape) => set({ selectedShape }),
  setPolygonSides: (polygonSides) => set({ polygonSides }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setImageActions: (imageActions) => set({ imageActions }),
}));
