/**
 * Grupa "przycisk glowny + chevron z rozwijanym menu" (mikrofon / sluchawki).
 * Markup 1:1 z voice-chat.tsx, sparametryzowany.
 */
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  icon: ReactNode;
  title: string;
  onClick: () => void;
  disabled: boolean;
  /** Klasy stanu aktywnego (np. czerwony przy mute) - inaczej neutralne. */
  activeClassName?: string;
  menuTitle: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuDisabled: boolean;
  menu: ReactNode;
}

export function VoiceControlGroup({
  icon,
  title,
  onClick,
  disabled,
  activeClassName,
  menuTitle,
  menuOpen,
  onToggleMenu,
  menuDisabled,
  menu,
}: Props) {
  return (
    <div className="relative flex items-center gap-0">
      <div className="flex items-center rounded-lg border border-gray-300 bg-gray-100/90 overflow-hidden h-9 transition-all duration-300 ease-in-out">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`w-8 h-9 flex items-center justify-center transition-colors ${
            activeClassName ?? 'text-gray-700 hover:bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={title}
        >
          {icon}
        </button>

        <button
          type="button"
          onClick={onToggleMenu}
          disabled={menuDisabled}
          className="w-7 h-9 flex items-center justify-center text-gray-700 hover:bg-gray-200 border-l border-gray-300 transition-colors ease-in-out"
          title={menuTitle}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {menuOpen && menu}
    </div>
  );
}
