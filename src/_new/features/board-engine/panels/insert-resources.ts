/**
 * Wstawianie wzorów z SmartSearch / kart wzorów na tablicę Excalidraw jako obrazy.
 *
 * Wzory z manifestu to WSPÓLNE pliki statyczne (WebP w `public/resources/`): id pliku `tpl:<ścieżka>`
 * (files/shared-files.ts), więc `board-file-sync` zapisuje tylko odwołanie - bez kopii w Storage tablicy
 * i bez wpływu na quota. Ścieżka spoza wspólnych katalogów (awaryjnie) idzie jak wklejony obraz (upload).
 *
 * `@excalidraw/excalidraw` jest importowany dynamicznie: ten moduł trafia do strony
 * renderowanej na serwerze, a Excalidraw czyta `window` przy imporcie (issue excalidraw#9907).
 */

import type { AppState, BinaryFileData, DataURL } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { blobToDataURL } from '../files/data-url';
import { fetchSharedFile, isSharedPath, sharedFileId, sharedFileUrl } from '../files/shared-files';

/** Wzór z manifestu `/resources/manifest.json` (podzbiór `FormulaResource`). */
export interface InsertableResource {
  path: string;
  title: string;
  dimensions: { width: number; height: number };
}

/** Szerokość wstawionego wzoru w jednostkach sceny (wysokość wg proporcji obrazu). */
export const RESOURCE_WIDTH = 500;
export const RESOURCE_GAP = 40;
export const RESOURCE_COLUMNS = 2;

/**
 * Id pliku wzoru: wspólny plik `tpl:<ścieżka>`; inna ścieżka - deterministyczny hash (upload jak obraz).
 * Ten sam wzór wstawiony drugi raz nie dubluje pliku.
 */
export function resourceFileId(path: string): FileId {
  if (isSharedPath(path.replace(/^\/+/, ''))) return sharedFileId(path) as FileId;
  let h = 2166136261;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `res-${h.toString(16)}` as FileId;
}

/** Środek widocznej części sceny. */
export function viewportCenter(
  appState: Pick<AppState, 'scrollX' | 'scrollY' | 'width' | 'height' | 'zoom'>
): { x: number; y: number } {
  return {
    x: -appState.scrollX + appState.width / 2 / appState.zoom.value,
    y: -appState.scrollY + appState.height / 2 / appState.zoom.value,
  };
}

export interface ResourceSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Układ wzorów wokół środka widoku: jeden = na środku, kilka = siatka po RESOURCE_COLUMNS
 * kolumny (wysokość wiersza = najwyższy wzór w wierszu), cała siatka wyśrodkowana.
 */
export function layoutResources(
  resources: readonly Pick<InsertableResource, 'dimensions'>[],
  center: { x: number; y: number }
): ResourceSlot[] {
  if (resources.length === 0) return [];
  const sizes = resources.map(({ dimensions }) => {
    const ratio = dimensions.width > 0 ? dimensions.height / dimensions.width : 1;
    return { width: RESOURCE_WIDTH, height: Math.round(RESOURCE_WIDTH * (ratio || 1)) };
  });
  const columns = Math.min(RESOURCE_COLUMNS, resources.length);
  const rowHeights: number[] = [];
  sizes.forEach((size, i) => {
    const row = Math.floor(i / columns);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, size.height);
  });
  const totalWidth = columns * RESOURCE_WIDTH + (columns - 1) * RESOURCE_GAP;
  const totalHeight =
    rowHeights.reduce((sum, h) => sum + h, 0) + (rowHeights.length - 1) * RESOURCE_GAP;
  const left = center.x - totalWidth / 2;
  let top = center.y - totalHeight / 2;
  const rowTops = rowHeights.map((h) => {
    const t = top;
    top += h + RESOURCE_GAP;
    return t;
  });
  return sizes.map((size, i) => ({
    x: left + (i % columns) * (RESOURCE_WIDTH + RESOURCE_GAP),
    y: rowTops[Math.floor(i / columns)],
    ...size,
  }));
}

async function loadResourceFile(path: string): Promise<BinaryFileData> {
  const clean = path.replace(/^\/+/, '');
  const blob = await fetchSharedFile(isSharedPath(clean) ? sharedFileUrl(clean) : path);
  return {
    id: resourceFileId(path),
    mimeType: (blob.type || 'image/webp') as BinaryFileData['mimeType'],
    dataURL: (await blobToDataURL(blob)) as DataURL,
    created: Date.now(),
  };
}

/**
 * Wstawia wzory na środek widoku i zaznacza je. Wzór, którego obrazu nie udało się pobrać,
 * jest pomijany. Zwraca liczbę wstawionych.
 */
export async function insertResources(
  api: ExcalidrawImperativeAPI,
  resources: readonly InsertableResource[]
): Promise<number> {
  const loaded = await Promise.allSettled(resources.map((r) => loadResourceFile(r.path)));
  const ok = resources
    .map((resource, i) => ({ resource, result: loaded[i] }))
    .filter(
      (x): x is { resource: InsertableResource; result: PromiseFulfilledResult<BinaryFileData> } =>
        x.result.status === 'fulfilled'
    );
  if (ok.length === 0) return 0;

  const { convertToExcalidrawElements, CaptureUpdateAction } =
    await import('@excalidraw/excalidraw');
  const slots = layoutResources(
    ok.map((x) => x.resource),
    viewportCenter(api.getAppState())
  );
  const elements: ExcalidrawElement[] = convertToExcalidrawElements(
    ok.map(({ resource, result }, i) => ({
      type: 'image' as const,
      ...slots[i],
      fileId: result.value.id,
      status: 'saved' as const,
      customData: { kind: 'resource', title: resource.title },
    }))
  );

  api.addFiles(ok.map((x) => x.result.value));
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
    appState: {
      selectedElementIds: Object.fromEntries(elements.map((e) => [e.id, true as const])),
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return elements.length;
}
