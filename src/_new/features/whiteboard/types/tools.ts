/**
 * ============================================================================
 * TYPY NARZĘDZI TABLICY
 * ============================================================================
 * Tool = które narzędzie jest aktualnie aktywne na pasku (toolbar).
 * ShapeType = jaki kształt jest wybrany gdy aktywne jest narzędzie 'shape'.
 *
 * UŻYWANE PRZEZ:
 * - toolbar/toolbar.tsx             (pasek narzędzi, aktywne narzędzie)
 * - canvas/whiteboard-canvas.tsx    (który tryb obsługi eventów)
 * - selection/use-selection.ts      (select tool)
 * - navigation/use-pan.ts           (pan tool)
 * ============================================================================
 */

/**
 * Aktywne narzędzie — decyduje co się dzieje gdy user klika/rysuje na tablicy.
 *
 * 'select'     → zaznaczanie, przesuwanie, resize elementów
 * 'pan'        → przesuwanie widoku (chwytanie tablicy i ciągnięcie)
 * 'pen'        → rysowanie odręczne
 * 'text'       → wstawianie tekstu
 * 'shape'      → rysowanie kształtów (zależy od ShapeType)
 * 'function'   → wykres funkcji matematycznej
 * 'image'      → wstawianie obrazu
 * 'pdf'        → wstawianie dokumentu PDF
 * 'eraser'     → gumka (usuwa elementy lub fragmenty ścieżki)
 * 'markdown'   → wstawianie notatki Markdown
 * 'table'      → wstawianie tabeli
 * 'calculator' → otwiera panel kalkulatora
 */
export type Tool =
  | 'select'
  | 'pan'
  | 'pen'
  | 'text'
  | 'shape'
  | 'function'
  | 'image'
  | 'pdf'
  | 'eraser'
  | 'markdown'
  | 'table'
  | 'calculator';

/**
 * Rodzaj kształtu — aktywny gdy Tool === 'shape'.
 *
 * 'rectangle'  → prostokąt
 * 'circle'     → koło/elipsa
 * 'triangle'   → trójkąt
 * 'line'       → linia prosta
 * 'arrow'      → strzałka prosta (kształt, nie ArrowElement)
 * 'polygon'    → wielokąt foremny (liczba boków konfigurowana osobno)
 */
export type ShapeType =
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'arrow'
  | 'polygon';
