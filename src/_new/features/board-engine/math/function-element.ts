/**
 * Wykres funkcji jako element Excalidraw.
 *
 * Wybrana droga: SVG -> element `image` z plikiem w `files` + `customData`
 * ({ kind: 'function', spec }). Uzasadnienie vs alternatywy:
 *
 * - `embeddable` (iframe): wymaga URL-a do wyrenderowania (własna strona
 *   /plot?expr=...), nie eksportuje się do PNG/SVG (Excalidraw rysuje
 *   placeholder), nie działa offline i nie jest w pełni "elementem" (brak
 *   rotacji, inny hit-test). Odpada.
 * - `frame` z liniami (`line` elements z punktami wykresu): natywne elementy,
 *   ale 1 wykres = kilkaset punktów w kilku liniach + osie + siatka + tekst,
 *   edycja wzoru = usuń i wygeneruj od nowa, użytkownik może "rozbić" wykres
 *   przesuwając jedną linię. Ciężkie w Y.Doc. Odpada.
 * - `image` (SVG): jeden element, skaluje się bez strat, eksport PNG/SVG
 *   działa, rotacja/zaznaczanie/grupy działają jak dla każdego obrazu,
 *   plik (dataURL) jest deduplikowany po id (hash). Edycja = nowy plik +
 *   podmiana `fileId` na elemencie. Wybrane.
 */

import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { BinaryFileData, DataURL } from '@excalidraw/excalidraw/types';
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
} from '@excalidraw/excalidraw/element/types';
import { functionPlotSvg, svgToDataUrl, type FunctionSpec } from './function-plot';

export const FUNCTION_KIND = 'function' as const;

export interface FunctionCustomData {
  kind: typeof FUNCTION_KIND;
  spec: FunctionSpec;
}

export const PLOT_SIZE = 400;

/** Deterministyczne id pliku z treści (ta sama funkcja = ten sam plik, bez duplikatów). */
export function fileIdForSpec(spec: FunctionSpec): FileId {
  const key = JSON.stringify([
    spec.expression,
    spec.xRange,
    spec.yRange,
    spec.color,
    spec.strokeWidth,
    !!spec.dashed,
  ]);
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `fn-${h.toString(16)}` as FileId;
}

export function buildFunctionFile(spec: FunctionSpec): BinaryFileData {
  return {
    id: fileIdForSpec(spec),
    mimeType: 'image/svg+xml',
    dataURL: svgToDataUrl(
      functionPlotSvg(spec, { width: PLOT_SIZE, height: PLOT_SIZE })
    ) as DataURL,
    created: Date.now(),
  };
}

/** Nowy element `image` z wykresem umieszczony na (x, y) w układzie sceny. */
export function buildFunctionElement(
  spec: FunctionSpec,
  position: { x: number; y: number }
): { element: ExcalidrawElement; file: BinaryFileData } {
  const file = buildFunctionFile(spec);
  const [element] = convertToExcalidrawElements([
    {
      type: 'image',
      x: position.x,
      y: position.y,
      width: PLOT_SIZE,
      height: PLOT_SIZE,
      fileId: file.id,
      status: 'saved',
      customData: { kind: FUNCTION_KIND, spec } satisfies FunctionCustomData,
    },
  ]);
  return { element, file };
}

export function isFunctionElement(
  el: ExcalidrawElement | null | undefined
): el is ExcalidrawImageElement & { customData: FunctionCustomData } {
  return (
    !!el &&
    el.type === 'image' &&
    !el.isDeleted &&
    (el.customData as Partial<FunctionCustomData> | undefined)?.kind === FUNCTION_KIND
  );
}

/**
 * Zwraca nowy (niemutujący) element z podmienionym wzorem: nowy plik, nowy
 * fileId, wersja podbita - Excalidraw i Yjs widzą to jak zwykłą edycję.
 */
export function updateFunctionElement(
  el: ExcalidrawImageElement,
  spec: FunctionSpec
): { element: ExcalidrawImageElement; file: BinaryFileData } {
  const file = buildFunctionFile(spec);
  const element: ExcalidrawImageElement = {
    ...el,
    fileId: file.id,
    customData: { ...(el.customData ?? {}), kind: FUNCTION_KIND, spec },
    version: el.version + 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    updated: Date.now(),
  };
  return { element, file };
}
