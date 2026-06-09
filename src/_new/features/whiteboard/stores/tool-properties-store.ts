/**
 * ============================================================================
 * PLIK: stores/tool-properties-store.ts — Store właściwości narzędzi (zustand)
 * ============================================================================
 *
 * Centralny stan właściwości aktualnie używanego narzędzia: kolor, grubość
 * linii, rozmiar czcionki, wypełnienie, wybrany kształt, liczba boków wielokąta.
 *
 * Dlaczego zustand zamiast useState/Context:
 *  - SELEKTORY → granularna subskrypcja. Komponent czytający tylko `lineWidth`
 *    nie re-renderuje się przy zmianie `color`. (Context re-renderowałby
 *    wszystkich konsumentów — krytyczne przy szybkich akcjach myszą/gestach.)
 *  - HOT-PATH bez subskrypcji → handlery i pętla canvas mogą czytać bieżącą
 *    wartość przez `useToolProperties.getState().color` (zero re-renderów).
 *
 * Wartości domyślne odpowiadają poprzednim useState w whiteboard-canvas.tsx
 * (color '#000000', lineWidth 4, fontSize 70, fillShape false,
 *  selectedShape 'rectangle', polygonSides 5).
 * ============================================================================
 */

import { create } from 'zustand';
import type { ShapeType } from '@/_new/features/whiteboard/types';

export interface ToolPropertiesState {
  // ── właściwości ──
  color: string;
  lineWidth: number;
  fontSize: number;
  fillShape: boolean;
  selectedShape: ShapeType;
  polygonSides: number;

  // ── settery (sygnatura (value) => void — drop-in za dawne setX z useState) ──
  setColor: (color: string) => void;
  setLineWidth: (lineWidth: number) => void;
  setFontSize: (fontSize: number) => void;
  setFillShape: (fillShape: boolean) => void;
  setSelectedShape: (selectedShape: ShapeType) => void;
  setPolygonSides: (polygonSides: number) => void;
}

export const useToolProperties = create<ToolPropertiesState>((set) => ({
  color: '#000000',
  lineWidth: 4,
  fontSize: 70,
  fillShape: false,
  selectedShape: 'rectangle',
  polygonSides: 5,

  setColor: (color) => set({ color }),
  setLineWidth: (lineWidth) => set({ lineWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFillShape: (fillShape) => set({ fillShape }),
  setSelectedShape: (selectedShape) => set({ selectedShape }),
  setPolygonSides: (polygonSides) => set({ polygonSides }),
}));
