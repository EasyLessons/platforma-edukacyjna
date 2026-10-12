'use client';

/**
 * Przycisk "Rozmowa" (Daily). Poza `DailyCallProvider` (demo, gość, tryb `legacy`) nie
 * renderuje nic. W trakcie rozmowy zwija / rozwija okno.
 */

import { Phone } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { Tooltip } from '@/_new/shared/ui/tooltip';
import { useDailyCall } from '../call-context';

interface CallButtonProps {
  /** Sama ikona (wąski pasek, telefon). */
  compact?: boolean;
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
}

export function CallButton({ compact = false, tooltipPosition = 'bottom' }: CallButtonProps) {
  const call = useDailyCall();
  if (!call) return null;

  const isActive = call.status === 'active';
  const isLoading = call.status === 'loading';
  const label = isLoading ? 'Łączenie…' : isActive ? 'Rozmowa trwa' : 'Rozmowa';
  const hint = isActive ? (call.minimized ? 'Pokaż okno rozmowy' : 'Zwiń okno rozmowy') : label;

  return (
    <Tooltip position={tooltipPosition} content={hint}>
      <Button
        variant="secondary"
        size="sm"
        data-testid="call-button"
        aria-label={hint}
        aria-pressed={isActive}
        disabled={isLoading}
        onClick={isActive ? call.toggleMinimized : () => void call.start()}
        className={`font-semibold hover-shine h-10 rounded-lg ${isActive ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-gray-200 hover:bg-gray-200 text-gray-700'} ${compact ? 'px-0 w-10 min-w-10 justify-center' : 'px-3'} whitespace-nowrap transition-all duration-300 ease-in-out shrink-0`}
        leftIcon={<Phone className="w-4 h-4" />}
      >
        {!compact && label}
      </Button>
    </Tooltip>
  );
}
