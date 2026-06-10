/**
 * tools/image.properties.tsx — Panel właściwości narzędzia Obraz.
 *
 * Trzy akcje (wklej / wgraj obraz / wgraj PDF) wymagają imageToolRef z canvasu,
 * niedostępnego w toolbarze. Rozwiązanie pełnej spójności: akcje rejestruje
 * canvas w `tool-store` (slice `imageActions`), a panel czyta je przez selektor.
 */

'use client';

import { Clipboard as ClipboardIcon, Upload, FileText } from 'lucide-react';
import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';

export function ImageProperties() {
  const imageActions = useToolStore((s) => s.imageActions);

  return (
    <>
      {/* Wklej obraz ze schowka */}
      <button
        onClick={imageActions.paste}
        className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-gray-100"
        title="Wklej obraz ze schowka (Ctrl+V)"
      >
        <ClipboardIcon className="w-5 h-5" />
      </button>

      {/* Separator */}
      <div className="w-6 h-px bg-gray-200 my-1" />

      {/* Upload obraz */}
      <button
        onClick={imageActions.upload}
        className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-gray-100"
        title="Wybierz plik obrazu z dysku"
      >
        <Upload className="w-5 h-5" />
      </button>

      {/* Separator */}
      <div className="w-6 h-px bg-gray-200 my-1" />

      {/* Upload PDF */}
      <button
        onClick={imageActions.pdfUpload}
        className="p-1.5 rounded-md transition-all cursor-pointer text-gray-700 hover:bg-gray-100"
        title="Wybierz plik PDF z dysku"
      >
        <FileText className="w-5 h-5" />
      </button>
    </>
  );
}
