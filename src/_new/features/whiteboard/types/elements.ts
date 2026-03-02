/**
 * ============================================================================
 * TYPY ELEMENTÓW TABLICY
 * ============================================================================
 * Każdy typ to jeden rodzaj obiektu który można narysować/wstawić na tablicę.
 * DrawingElement = union wszystkich typów (jeden element to jedno z poniższych).
 *
 * UŻYWANE PRZEZ:
 * - elements/use-elements.ts    (zarządzanie stanem tablicy)
 * - elements/rendering/         (rysowanie na canvas)
 * - selection/use-selection.ts  (zaznaczanie)
 * - api/elements-api.ts         (zapis/odczyt z bazy)
 * - realtime/use-realtime.ts    (synchronizacja)
 * ============================================================================
 */

// ─── PODSTAWOWE ──────────────────────────────────────────────────────────────

/** Punkt na nieskończonej tablicy (w układzie współrzędnych tablicy, nie ekranu) */
export interface Point {
  x: number;
  y: number;
}

// ─── TYPY ELEMENTÓW ──────────────────────────────────────────────────────────

/** Linia rysowana odręcznie (narzędzie: pióro) */
export interface DrawingPath {
  id: string;
  type: 'path';
  points: Point[];
  color: string;
  width: number;
  widths?: number[];  // grubość dla każdego punktu osobno (pressure-sensitive)
  opacity?: number;   // 0–1, domyślnie 1
}

/** Kształt geometryczny (narzędzie: shape) */
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
  sides?: number;     // tylko dla polygon (min. 3)
  rotation?: number;  // radiany
}

/** Tekst edytowalny (narzędzie: text) */
export interface TextElement {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: string;                    // domyślnie 'Arial, sans-serif'
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  rotation?: number;
}

/** Wykres funkcji matematycznej (narzędzie: function) */
export interface FunctionPlot {
  id: string;
  type: 'function';
  expression: string;
  color: string;
  strokeWidth: number;
  xRange: number;
  yRange: number;
  strokeDasharray?: string;  // np. '5 5' dla linii przerywanej
}

/** Obraz/zdjęcie wstawione na tablicę (narzędzie: image) */
export interface ImageElement {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;    // URL lub base64
  alt?: string;
  rotation?: number;
}

/** Dokument PDF wstawiony na tablicę (narzędzie: pdf) */
export interface PDFElement {
  id: string;
  type: 'pdf';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;          // URL lub base64
  fileName?: string;
  currentPage?: number;
  totalPages?: number;
  rotation?: number;
}

/** Notatka w formacie Markdown (narzędzie: markdown / chatbot) */
export interface MarkdownNote {
  id: string;
  type: 'markdown';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;              // treść w Markdown
  backgroundColor?: string;
  borderColor?: string;
  isFromChatbot?: boolean;      // czy wygenerowane przez AI
  contentScale?: number;
}

/** Edytowalna tabela (narzędzie: table) */
export interface TableElement {
  id: string;
  type: 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  rows: number;
  cols: number;
  cells: string[][];            // tablica 2D treści komórek
  headerRow?: boolean;
  headerCol?: boolean;
  borderColor?: string;
  headerBgColor?: string;
}

/** Strzałka łącząca elementy (narzędzie: arrow) */
export interface ArrowElement {
  id: string;
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Przyczep do innego elementu — start */
  startAttachment?: {
    elementId: string;
    side: 'top' | 'right' | 'bottom' | 'left' | 'center';
  };
  /** Przyczep do innego elementu — koniec */
  endAttachment?: {
    elementId: string;
    side: 'top' | 'right' | 'bottom' | 'left' | 'center';
  };
  color: string;
  strokeWidth: number;
  arrowType: 'smooth' | 'rectangular';
  controlPoints?: Point[];
  arrowHead?: 'none' | 'end' | 'both';
}

// ─── UNION TYPE ──────────────────────────────────────────────────────────────

/**
 * Jeden element na tablicy to zawsze jeden z powyższych typów.
 * TypeScript automatycznie rozróżnia je po polu `type`.
 *
 * Przykład:
 *   if (element.type === 'path') { element.points ... }
 *   if (element.type === 'text') { element.text ... }
 */
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
