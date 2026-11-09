/**
 * board-engine - tablica na Excalidraw (ADR: docs/architecture/ADR-silnik-tablicy.md).
 *
 * Jedyny silnik tablicy od etapu F (stary silnik canvasowy usunięty); panele, sidebar,
 * ustawienia i warstwa Yjs/REST współdzielone z `features/whiteboard`.
 *
 * Ten barrel eksportuje tylko moduły bezpieczne dla SSR. `ExcalidrawBoard` importuj
 * bezpośrednio z `./components/excalidraw-board` wewnątrz `next/dynamic(..., { ssr: false })`.
 */

export * from './math/function-plot';
export * from './yjs/excalidraw-binding';
export * from './yjs/awareness-collaborators';
export type { BoardAwareness } from './yjs/types';
export type { ExcalidrawBoardProps, BoardUser, TopRightExtra } from './components/excalidraw-board';
