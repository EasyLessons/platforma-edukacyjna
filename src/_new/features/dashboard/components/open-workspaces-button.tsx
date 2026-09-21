'use client';

import { PanelLeftOpen } from 'lucide-react';

/** Telefon: otwiera wysuwana liste przestrzeni. Ukryty od md w gore. */
export function OpenWorkspacesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Przestrzenie"
      title="Przestrzenie"
      className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
    >
      <PanelLeftOpen size={22} strokeWidth={2.25} />
    </button>
  );
}
