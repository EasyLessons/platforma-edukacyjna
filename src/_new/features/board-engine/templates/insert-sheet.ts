/**
 * Wstawienie arkusza CKE na tablicę: strony jako obrazy Excalidraw ułożone strona pod stroną (jak PDF z B2),
 * zgrupowane. Pliki stron to WSPÓLNE pliki (`tpl:` - files/shared-files.ts): bez uploadu do Storage
 * tablicy i bez wpływu na quota; inni pobierają je z CDN.
 *
 * Runtime `@excalidraw/excalidraw` tylko przez dynamiczny import (moduł trafia do strony z SSR).
 */

import type {
  BinaryFileData,
  DataURL,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types';
import { blobToDataURL } from '../files/data-url';
import { fetchSharedFile, sharedFileId, sharedFileUrl } from '../files/shared-files';
import { layoutPages } from '../elements/pdf';
import { viewportCenter } from '../panels/insert-resources';
import { sheetPagePath, type SheetTemplate } from './catalog';

export const TEMPLATE_PAGE_KIND = 'template-page' as const;

/** Czy arkusz jest już na tablicy (wstawienie z `?arkusz=` ma być jednorazowe). */
export function hasSheet(elements: readonly ExcalidrawElement[], templateId: string): boolean {
  return elements.some(
    (el) =>
      !el.isDeleted &&
      (el.customData as { kind?: string; templateId?: string } | undefined)?.kind ===
        TEMPLATE_PAGE_KIND &&
      (el.customData as { templateId?: string }).templateId === templateId
  );
}

/** Wstawia wszystkie strony arkusza na środek widoku, dopasowuje widok. Zwraca id elementów. */
export async function insertSheet(
  api: ExcalidrawImperativeAPI,
  template: SheetTemplate,
  fetchPage: (url: string) => Promise<Blob> = fetchSharedFile
): Promise<string[]> {
  const pages = Array.from({ length: template.pages }, (_, i) => sheetPagePath(template, i + 1));
  const files: BinaryFileData[] = await Promise.all(
    pages.map(async (path) => {
      const blob = await fetchPage(sharedFileUrl(path));
      return {
        id: sharedFileId(path) as FileId,
        mimeType: 'image/webp' as const,
        dataURL: (await blobToDataURL(blob)) as DataURL,
        created: Date.now(),
      };
    })
  );

  const { convertToExcalidrawElements, CaptureUpdateAction } =
    await import('@excalidraw/excalidraw');
  const groupId = `tpl-${template.id}-${Date.now().toString(36)}`;
  const slots = layoutPages(
    pages.map(() => template.pageSize),
    viewportCenter(api.getAppState())
  );
  const elements: ExcalidrawElement[] = convertToExcalidrawElements(
    slots.map((slot, i) => ({
      type: 'image' as const,
      ...slot,
      fileId: files[i].id,
      status: 'saved' as const,
      customData: { kind: TEMPLATE_PAGE_KIND, templateId: template.id, page: i + 1 },
    }))
  ).map((el) => ({ ...el, groupIds: [groupId] }) as ExcalidrawElement);

  api.addFiles(files);
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  // Pokaż początek arkusza (pierwsza strona), nie cały 30-stronicowy słup
  api.scrollToContent(elements[0], { fitToContent: true, animate: false });
  return elements.map((e) => e.id);
}
