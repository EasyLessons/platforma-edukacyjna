/**
 * WORKSPACE ICON PICKER
 *
 * Komponent pozwalający użytkownikowi wybrać ikonę dla workspace'a.
 * Wyświetla grid z dostępnymi ikonami.
 *
 */

'use client';

import { WORKSPACE_ICONS, WORKSPACE_ICON_NAMES } from '../utils/constants';

interface WorkspaceIconPickerProps {
  selected: string;
  onChange: (iconName: string) => void;
  disabled?: boolean;
}

export function WorkspaceIconPicker({
  selected,
  onChange,
  disabled = false,
}: WorkspaceIconPickerProps) {
  return (
    <div>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">Ikona</label>

      {/* Icon Grid */}
      <div className="grid grid-cols-8 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {WORKSPACE_ICON_NAMES.map((iconName) => {
          const Icon = WORKSPACE_ICONS[iconName];
          const isSelected = selected === iconName;

          return (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              disabled={disabled}
              className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                transition-all duration-200
                ${
                  isSelected
                    ? 'bg-green-600 text-white ring-2 ring-green-600 ring-offset-2'
                    : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={iconName}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Helper text */}
      <p className="text-xs text-gray-500 mt-2">
        Wybierz ikonę która najlepiej opisuje Twoją przestrzeń
      </p>
    </div>
  );
}
