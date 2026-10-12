/**
 * board-engine - tablica na Excalidraw (ADR: docs/architecture/ADR-silnik-tablicy.md).
 *
 * Działa za flagą `NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw` (config/engine-flag.ts);
 * domyślnie aplikacja używa starego silnika z `features/whiteboard`.
 *
 * Ten barrel eksportuje tylko moduły bezpieczne dla SSR. `ExcalidrawBoard` importuj
 * bezpośrednio z `./components/excalidraw-board` wewnątrz `next/dynamic(..., { ssr: false })`.
 */

export * from './config/engine-flag';
export * from './math/function-plot';
export * from './yjs/excalidraw-binding';
export * from './yjs/awareness-collaborators';
export type { BoardAwareness } from './yjs/types';
export type { ExcalidrawBoardProps, BoardUser, TopRightExtra } from './components/excalidraw-board';
