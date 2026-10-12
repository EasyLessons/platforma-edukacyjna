/**
 * PDF na tablicy Excalidraw (etap B2): strony renderowane w przeglądarce (pdfjs-dist) do obrazów JPEG
 * i wstawiane jako elementy `image`, ułożone pionowo i zgrupowane (przesuwanie całości = grupa).
 * Pliki idą przez `api.addFiles` - dalej robi to samo co wklejony obraz (#106: `board-file-sync`
 * -> Storage, w Y.Doc tylko odwołanie), więc sync i F5 działają jak dla obrazów.
 *
 * Limity (opis: ADR silnika tablicy, sekcja B2):
 *   - plik do PDF_MAX_BYTES; większy - odmowa z komunikatem,
 *   - najwyżej PDF_MAX_PAGES stron; dłuższy - wstawiane pierwsze strony + komunikat,
 *   - strona renderowana tak, by dłuższy bok miał najwyżej PAGE_MAX_SIDE px (backend przyjmuje do 1600 px,
 *     Excalidraw sam zmniejsza obrazy do 1440), JPEG jakości PAGE_JPEG_QUALITY.
 * Tablica ma też limity backendu (300 plików / 100 MB) - przekroczenie zgłasza `board-file-sync`.
 *
 * Worker pdfjs z naszego bundla (`new URL(..., import.meta.url)`), nie z CDN - szkoły bywają offline.
 * Runtime `@excalidraw/excalidraw` i `pdfjs-dist` tylko przez dynamiczny import (moduł trafia do strony z SSR).
 */

import type {
  BinaryFileData,
  DataURL,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types';
import { blobToDataURL } from '../files/data-url';
import { viewportCenter } from '../panels/insert-resources';

export const PDF_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_MAX_PAGES = 20;
export const PAGE_MAX_SIDE = 1440;
export const PAGE_JPEG_QUALITY = 0.85;
/** Szerokość strony na tablicy (jednostki sceny). */
export const PAGE_SCENE_WIDTH = 600;
export const PAGE_GAP = 24;
export const PDF_PAGE_KIND = 'pdf-page' as const;

export class PdfImportError extends Error {}

export interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
}

/** Skala renderu strony, żeby dłuższy bok miał najwyżej `maxSide` px (bez powiększania ponad 2x). */
export function pageScale(width: number, height: number, maxSide = PAGE_MAX_SIDE): number {
  const longer = Math.max(width, height);
  if (longer <= 0) return 1;
  return Math.min(2, maxSide / longer);
}

/** Układ stron: kolumna wyśrodkowana na `center`, szerokość PAGE_SCENE_WIDTH, wysokość wg proporcji. */
export function layoutPages(
  pages: readonly Pick<RenderedPage, 'width' | 'height'>[],
  center: { x: number; y: number }
): { x: number; y: number; width: number; height: number }[] {
  const heights = pages.map((p) =>
    Math.round((PAGE_SCENE_WIDTH * (p.height || 1)) / (p.width || 1))
  );
  const total = heights.reduce((a, b) => a + b, 0) + Math.max(0, pages.length - 1) * PAGE_GAP;
  let y = center.y - total / 2;
  return heights.map((height) => {
    const slot = { x: center.x - PAGE_SCENE_WIDTH / 2, y, width: PAGE_SCENE_WIDTH, height };
    y += height + PAGE_GAP;
    return slot;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PdfImportError('Nie udało się zapisać strony'))),
      'image/jpeg',
      PAGE_JPEG_QUALITY
    )
  );
}

/**
 * Renderuje strony PDF do JPEG. Zwraca strony i łączną liczbę stron dokumentu.
 * `onProgress(done, total)` po każdej stronie.
 */
export async function renderPdfPages(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<{ pages: RenderedPage[]; totalPages: number }> {
  if (file.size > PDF_MAX_BYTES) {
    throw new PdfImportError(
      `Plik PDF jest za duży (najwyżej ${Math.round(PDF_MAX_BYTES / 1024 / 1024)} MB).`
    );
  }
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch {
    throw new PdfImportError(
      'Nie udało się otworzyć pliku PDF (uszkodzony albo zabezpieczony hasłem).'
    );
  }
  try {
    const count = Math.min(pdf.numPages, PDF_MAX_PAGES);
    const pages: RenderedPage[] = [];
    for (let n = 1; n <= count; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: pageScale(base.width, base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new PdfImportError('Przeglądarka nie pozwala rysować stron PDF.');
      // białe tło: JPEG nie ma przezroczystości, a strony PDF bywają przezroczyste
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      pages.push({ blob: await canvasToBlob(canvas), width: canvas.width, height: canvas.height });
      page.cleanup();
      onProgress?.(n, count);
    }
    return { pages, totalPages: pdf.numPages };
  } finally {
    void pdf.destroy();
  }
}

/** "1 strona", "2 strony", "5 stron", "22 strony" - polska odmiana liczebnika. */
export function pagesLabel(n: number): string {
  if (n === 1) return '1 strona';
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? `${n} strony` : `${n} stron`;
}

const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Wstawia wyrenderowane strony jako zgrupowane obrazy na środku widoku i zaznacza je. */
export async function insertPdfPages(
  api: ExcalidrawImperativeAPI,
  pages: readonly RenderedPage[],
  name: string
): Promise<string[]> {
  if (pages.length === 0) return [];
  const { convertToExcalidrawElements, CaptureUpdateAction } =
    await import('@excalidraw/excalidraw');
  const groupId = `pdf-${randomId()}`;
  const files: BinaryFileData[] = await Promise.all(
    pages.map(async (page, i) => ({
      id: `${groupId}-${i + 1}` as FileId,
      mimeType: 'image/jpeg' as const,
      dataURL: (await blobToDataURL(page.blob)) as DataURL,
      created: Date.now(),
    }))
  );
  const slots = layoutPages(pages, viewportCenter(api.getAppState()));
  const elements: ExcalidrawElement[] = convertToExcalidrawElements(
    slots.map((slot, i) => ({
      type: 'image' as const,
      ...slot,
      fileId: files[i].id,
      status: 'saved' as const,
      customData: { kind: PDF_PAGE_KIND, name, page: i + 1, pages: pages.length },
    }))
  ).map((el) => ({ ...el, groupIds: [groupId] }) as ExcalidrawElement);

  api.addFiles(files);
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
    appState: {
      selectedElementIds: Object.fromEntries(elements.map((e) => [e.id, true as const])),
      selectedGroupIds: { [groupId]: true },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  // Strona A4 nie mieści się w kadrze przy 100% - pokaż cały wstawiony dokument
  api.scrollToContent(elements, { fitToContent: true, animate: true });
  return elements.map((e) => e.id);
}
