'use client';

/**
 * Import PDF (etap B2): ukryte pole pliku otwierane przyciskiem "PDF" + komunikat postępu / błędu.
 * Logika renderu i wstawiania: `pdf.ts`.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { createLogger } from '@/_new/lib/logger';
import { PDF_MAX_PAGES, PdfImportError, insertPdfPages, pagesLabel, renderPdfPages } from './pdf';

const log = createLogger('board-engine/pdf-import');

interface PdfImportProps {
  api: ExcalidrawImperativeAPI | null;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function PdfImport({ api, inputRef }: PdfImportProps) {
  const [status, setStatus] = useState<{ text: string; busy: boolean } | null>(null);

  useEffect(() => {
    if (!status || status.busy) return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  const onFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // ten sam plik drugi raz też ma wywołać zmianę
      if (!file || !api) return;
      setStatus({ text: 'Wczytywanie PDF...', busy: true });
      try {
        const { pages, totalPages } = await renderPdfPages(file, (done, total) =>
          setStatus({ text: `Wczytywanie PDF: strona ${done} z ${total}`, busy: true })
        );
        await insertPdfPages(api, pages, file.name);
        setStatus({
          text:
            totalPages > pages.length
              ? `Dodano ${pages.length} z ${totalPages} stron (limit ${PDF_MAX_PAGES})`
              : `Dodano PDF: ${pagesLabel(pages.length)}`,
          busy: false,
        });
      } catch (error) {
        if (!(error instanceof PdfImportError)) log.error('Import PDF nie powiódł się', error);
        setStatus({
          text: error instanceof PdfImportError ? error.message : 'Nie udało się wczytać PDF.',
          busy: false,
        });
      }
    },
    [api]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        data-testid="pdf-file-input"
        onChange={onFile}
      />
      {status && (
        <div
          role="status"
          data-testid="pdf-status"
          className="pointer-events-none absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-gray-900/85 px-4 py-2 text-sm text-white shadow"
        >
          {status.text}
        </div>
      )}
    </>
  );
}
