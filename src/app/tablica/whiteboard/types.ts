/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/types.ts
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - (brak zewnętrznych importów)
 * 
 * EKSPORTUJE:
 * - Point (interface) - punkt w przestrzeni 2D
 * - ViewportTransform (interface) - transformacja viewport (x, y, scale)
 * - DrawingPath (interface) - ścieżka rysowana piórem
 * - Shape (interface) - kształty geometryczne (prostokąt, koło, trójkąt, linia, strzałka)
 * - TextElement (interface) - element tekstowy
 * - FunctionPlot (interface) - wykres funkcji matematycznej
 * - DrawingElement (type) - union wszystkich typów elementów
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główny canvas)
 * - rendering.ts (renderowanie elementów)
 * - viewport.ts (transformacje współrzędnych)
 * - utils.ts (pomocnicze funkcje)
 * - Grid.tsx (rysowanie siatki)
 * 
 * PRZEZNACZENIE:
 * Definicje TypeScript dla wszystkich struktur danych używanych w tablicy.
 * Centralizuje typy dla elementów rysunkowych, viewport i współrzędnych.
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
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  strokeWidth: number;
  fill: boolean;
}

export interface TextElement {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
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

export type DrawingElement = DrawingPath | Shape | TextElement | FunctionPlot;
