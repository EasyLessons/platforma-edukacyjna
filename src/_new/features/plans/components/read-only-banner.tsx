/**
 * READ ONLY BANNER
 *
 * „Tablica przekroczyła limit 300 elementów planu Free — tryb tylko do odczytu."
 * Pokazywany na stronie tablicy, gdy GET /api/v1/boards/{id} zwróci
 * read_only=true (read_only_reason=PLAN_LIMIT_ELEMENTS).
 *
 * `limit` przychodzi z usePlan().limits.max_elements_per_board — gdy null/undefined
 * (np. oglądający ma Premium, a właściciel workspace'u Free), tekst jest bez liczby.
 */
'use client';

import { Lock } from 'lucide-react';

interface ReadOnlyBannerProps {
  limit?: number | null;
  onUpgradeClick?: () => void;
  className?: string;
}

export function ReadOnlyBanner({ limit, onUpgradeClick, className = '' }: ReadOnlyBannerProps) {
  const limitText = limit ? `limit ${limit} elementów` : 'limit elementów';

  return (
    <div
      role="status"
      data-testid="read-only-banner"
      className={`fixed left-1/2 top-4 z-[95] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-md ${className}`}
    >
      <Lock size={16} className="shrink-0" />
      <span>Tablica przekroczyła {limitText} planu Free — tryb tylko do odczytu.</span>
      {onUpgradeClick && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="shrink-0 rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
        >
          Przejdź na Premium
        </button>
      )}
    </div>
  );
}
