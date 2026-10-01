/**
 * Wybór silnika tablicy: `NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw` włącza Excalidraw,
 * każda inna wartość (albo brak zmiennej) zostawia stary silnik.
 *
 * Zmienna `NEXT_PUBLIC_*` jest wklejana przez Next.js w czasie builda, więc zmiana
 * wymaga przebudowania (na Vercelu: nowy deploy po zmianie zmiennej).
 * Stary silnik znika dopiero w etapie F (docs/architecture/ADR-silnik-tablicy.md).
 */

export type WhiteboardEngine = 'legacy' | 'excalidraw';

export function resolveWhiteboardEngine(value: string | undefined): WhiteboardEngine {
  return value?.trim().toLowerCase() === 'excalidraw' ? 'excalidraw' : 'legacy';
}

export const WHITEBOARD_ENGINE: WhiteboardEngine = resolveWhiteboardEngine(
  process.env.NEXT_PUBLIC_WHITEBOARD_ENGINE
);

export const isExcalidrawEngine = WHITEBOARD_ENGINE === 'excalidraw';
