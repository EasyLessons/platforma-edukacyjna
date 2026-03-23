/**
 * BOARD COLOR PICKER
 *
 * Komponent pozwalający użytkownikowi wybrać kolor tła dla tablicy.
 * Wyświetla palette z dostępnymi kolorami.
 *
 */

'use client';

import { Check } from 'lucide-react';
import { BOARD_COLORS, COLOR_MAP } from '../utils/constants';

interface BoardColorPickerProps {
  selected: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function BoardColorPicker({
  selected,
  onChange,
  disabled = false,
}: BoardColorPickerProps) {
  return (
    <div>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">Kolor</label>

      {/* Color Grid */}
      <div className="grid grid-cols-6 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {BOARD_COLORS.map((color) => {
          const colorClass = COLOR_MAP[color];
          const isSelected = selected === color;

          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              disabled={disabled}
              className={`
                relative w-10 h-10 rounded-lg
                transition-all duration-200
                ${colorClass}
                ${isSelected ? 'ring-2 ring-gray-900 ring-offset-2 scale-110' : 'hover:scale-105'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={color}
            >
              {/* Checkmark for selected color */}
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-5 h-5 text-white drop-shadow-md" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Helper text */}
      <p className="text-xs text-gray-500 mt-2">
        Wybierz kolor który pomoże Ci rozpoznać tablicę
      </p>
    </div>
  );
}
