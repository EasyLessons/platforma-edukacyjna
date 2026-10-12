'use client';

/**
 * Przyciski wstawiania elementów EasyLesson (etap B2) w slocie `topRightExtra` Excalidraw -
 * obok przełączników paneli. Tylko dla ról z prawem edycji (rodzic ich nie renderuje dla viewera).
 */

import type { ComponentType } from 'react';
import { NotebookPen, Table2 } from 'lucide-react';

export interface ElementButton {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}

export const NOTE_BUTTON = { id: 'note', label: 'Notatka', icon: NotebookPen } as const;
export const TABLE_BUTTON = { id: 'table', label: 'Tabela', icon: Table2 } as const;

interface ElementButtonsProps {
  buttons: readonly ElementButton[];
  placement: 'top-right' | 'mobile';
}

export function ElementButtons({ buttons, placement }: ElementButtonsProps) {
  const compact = placement === 'mobile';
  return (
    <>
      {buttons.map(({ id, label, icon: Icon, onClick }) => (
        <button
          key={id}
          type="button"
          onClick={onClick}
          aria-label={label}
          title={label}
          data-testid={`element-insert-${id}`}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 ${
            compact ? 'h-10 w-10 justify-center px-0' : ''
          }`}
        >
          <Icon className="h-4 w-4" />
          {!compact && <span>{label}</span>}
        </button>
      ))}
    </>
  );
}
