/**
 * PROTOTYP: tablica na Excalidraw + Yjs (docs/architecture/PROTOTYP-EXCALIDRAW.md).
 *
 * Uwaga: `ExcalidrawBoard` importuje `@excalidraw/excalidraw` statycznie -
 * strony ładują go przez `next/dynamic` z `ssr: false`. Ten barrel eksportuje
 * tylko rzeczy bezpieczne dla SSR (czyste moduły); komponent importuj bezpośrednio
 * z `./components/excalidraw-board` wewnątrz `dynamic(() => import(...))`.
 */

export * from './math/function-plot';
export * from './yjs/excalidraw-binding';
export * from './yjs/awareness-collaborators';
export { connectProtoBoard, getProtoYjsUrl, DEFAULT_PROTO_YJS_URL } from './yjs/provider';
export type { ExcalidrawBoardProps } from './components/excalidraw-board';
