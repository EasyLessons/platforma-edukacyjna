/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/types.ts
 * ============================================================================
 * 
 * IMPORTUJE Z: (brak - plik podstawowy)
 * 
 * EKSPORTUJE:
 * - Point (interface) - współrzędne x, y
 * - ViewportTransform (interface) - stan widoku: x, y, scale
 * - DrawingPath (interface) - ścieżka rysowana piórem
 * - Shape (interface) - kształt geometryczny
 * - TextElement (interface) - element tekstowy
 * - FunctionPlot (interface) - wykres funkcji matematycznej
 * - ImageElement (interface) - obraz/zdjęcie
 * - DrawingElement (type) - union wszystkich typów elementów
 * 
 * UŻYWANE PRZEZ:
 * ⚠️ BARDZO WAŻNE - używane przez WSZYSTKIE pliki w /tablica!
 * - WhiteboardCanvas.tsx (główny komponent)
 * - viewport.ts (transformacje)
 * - rendering.ts (renderowanie)
 * - Grid.tsx (siatka)
 * - utils.ts (pomocnicze)
 * - SelectTool.tsx (zaznaczanie)
 * - TextTool.tsx (tekst)
 * - selection.ts (logika zaznaczania)
 * 
 * ⚠️ UWAGA: Zmiana tutaj wpływa na CAŁY projekt tablicy!
 * Sprawdzaj wszystkie pliki po modyfikacji!
 * ============================================================================
 */

export interface Point {
  x: number;
  y: number;
}

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

export interface DrawingPath {
  id: string;
  type: 'path';
  points: Point[];
  color: string;
  width: number;
}

export interface Shape {
  id: string;
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow' | 'polygon';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  strokeWidth: number;
  fill: boolean;
  sides?: number; // Liczba boków dla polygon (3+)
}

export interface TextElement {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width?: number; // 🆕 Szerokość bounding box
  height?: number; // 🆕 Wysokość bounding box
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: string; // 🆕 Domyślnie: 'Arial, sans-serif'
  fontWeight?: 'normal' | 'bold'; // 🆕 Pogrubienie
  fontStyle?: 'normal' | 'italic'; // 🆕 Kursywa
  textAlign?: 'left' | 'center' | 'right'; // 🆕 Wyrównanie
}

export interface FunctionPlot {
  id: string;
  type: 'function';
  expression: string;
  color: string;
  strokeWidth: number;
  xRange: number;
  yRange: number;
}

// 🆕 Nowy typ dla obrazków (przyszłość)
export interface ImageElement {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // URL lub base64
  alt?: string;
}

export type DrawingElement = DrawingPath | Shape | TextElement | FunctionPlot | ImageElement;

export interface MomentumState {
  velocityX: number;
  velocityY: number;
  isActive: boolean;
  lastTimestamp: number;
}