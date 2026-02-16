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
  widths?: number[]; // Opcjonalna tablica grubości dla każdego punktu (pressure-sensitive)
  opacity?: number; // Opcjonalna przezroczystość (0-1), domyślnie 1
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
  rotation?: number; // Kąt obrotu w radianach
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
  rotation?: number; // Kąt obrotu w radianach
}

export interface FunctionPlot {
  id: string;
  type: 'function';
  expression: string;
  color: string;
  strokeWidth: number;
  xRange: number;
  yRange: number;
  strokeDasharray?: string; // np. '5 5' dla linii przerywanej
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
  rotation?: number; // Kąt obrotu w radianach
}

// 🆕 PDF Document - dla dokumentów PDF
export interface PDFElement {
  id: string;
  type: 'pdf';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // URL lub base64 PDF
  fileName?: string;
  currentPage?: number; // Aktualnie wyświetlana strona
  totalPages?: number; // Łączna liczba stron
  rotation?: number; // Kąt obrotu w radianach
}

// 🆕 Notatka Markdown - dla chatbota i notatek użytkownika
export interface MarkdownNote {
  id: string;
  type: 'markdown';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // Treść w formacie Markdown
  backgroundColor?: string; // Domyślnie biały
  borderColor?: string; // Kolor ramki
  isFromChatbot?: boolean; // Czy wygenerowane przez chatbota
  contentScale?: number; // Skala zawartości (np. 1 = 100%)
}

// 🆕 Tabelka - edytowalna tabela
export interface TableElement {
  id: string;
  type: 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  rows: number;
  cols: number;
  cells: string[][]; // Tablica 2D z treścią komórek
  headerRow?: boolean; // Czy pierwszy wiersz to nagłówek
  headerCol?: boolean; // Czy pierwsza kolumna to nagłówek
  borderColor?: string;
  headerBgColor?: string;
}

// 🆕 Strzałka - połączenie między elementami
export interface ArrowElement {
  id: string;
  type: 'arrow';
  // Pozycja początkowa
  startX: number;
  startY: number;
  // Pozycja końcowa
  endX: number;
  endY: number;
  // Attachmenty - przypiecie do innych elementów
  startAttachment?: {
    elementId: string;
    side: 'top' | 'right' | 'bottom' | 'left' | 'center';
  };
  endAttachment?: {
    elementId: string;
    side: 'top' | 'right' | 'bottom' | 'left' | 'center';
  };
  // Styl
  color: string;
  strokeWidth: number;
  arrowType: 'smooth' | 'rectangular'; // Gładka (Bezier) lub prostokątna
  // Punkty kontrolne dla smooth lub punkty załamania dla rectangular
  controlPoints?: Point[];
  // Opcje grotu strzałki
  arrowHead?: 'none' | 'end' | 'both'; // Gdzie pokazać grot
}

export type DrawingElement =
  | DrawingPath
  | Shape
  | TextElement
  | FunctionPlot
  | ImageElement
  | PDFElement
  | MarkdownNote
  | TableElement
  | ArrowElement;

export interface MomentumState {
  velocityX: number;
  velocityY: number;
  isActive: boolean;
  lastTimestamp: number;
}
