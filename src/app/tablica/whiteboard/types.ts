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