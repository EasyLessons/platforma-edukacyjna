'use client';

/**
 * Przycisk "Rozmowa" (Daily). Poza `DailyCallProvider` (demo, gość, tryb `legacy`) nie
 * renderuje nic. W trakcie rozmowy zwija / rozwija okno.
 */

import { Phone } from 'lucide-react';
import { Tooltip } from '@/_new/shared/ui/tooltip';
import { useDailyCall } from '../call-context';

interface CallButtonProps {
  /** Sama ikona (wąski pasek, telefon). */
  compact?: boolean;
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function CallButton({
  compact = false,
  tooltipPosition = 'bottom',
  className = '',
}: CallButtonProps) {
  const call = useDailyCall();
  if (!call) return null;

  const isActive = call.status === 'active';
  const isLoading = call.status === 'loading';
  const label = isLoading ? 'Łączenie…' : isActive ? 'Rozmowa trwa' : 'Rozmowa';
  const hint = isActive ? (call.minimized ? 'Pokaż okno rozmowy' : 'Zwiń okno rozmowy') : label;

  const stateStyles = isActive
    ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-400/40'
    : isLoading
      ? 'bg-emerald-700/80 text-white/90 cursor-wait'
      : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm';

  return (
    <Tooltip position={tooltipPosition} content={hint}>
      <button
        type="button"
        data-testid="call-button"
        aria-label={hint}
        aria-pressed={isActive}
        disabled={isLoading}
        onClick={isActive ? call.toggleMinimized : () => void call.start()}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 shrink-0 cursor-pointer ${
          compact ? 'h-9 w-9 min-w-9 p-0 rounded-lg' : 'h-9 px-3 gap-2 rounded-lg text-sm'
        } ${stateStyles} ${className}`}
      >
        <Phone className={`w-4 h-4 shrink-0 ${isActive ? 'animate-pulse' : ''}`} />
        {!compact && <span className="font-medium whitespace-nowrap">{label}</span>}
      </button>
    </Tooltip>
  );
}
