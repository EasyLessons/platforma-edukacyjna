/**
 * PLAN USAGE BADGE
 *
 * Licznik zużycia planu, np. „2/3 tablice" obok przycisku „Nowa tablica".
 * Premium (albo brak limitu) → mała plakietka „Premium".
 * Przed załadowaniem danych nic nie renderuje.
 */
'use client';

import { usePlan } from '../hooks/use-plan';

type UsageKind = 'boards' | 'workspaces';

const LABELS: Record<UsageKind, string> = {
  boards: 'tablice',
  workspaces: "workspace'y",
};

interface PlanUsageBadgeProps {
  kind?: UsageKind;
  className?: string;
}

export function PlanUsageBadge({ kind = 'boards', className = '' }: PlanUsageBadgeProps) {
  const { isLoaded, isPremium, limits, usage } = usePlan();
  if (!isLoaded || !limits || !usage) return null;

  const used = kind === 'boards' ? usage.boards : usage.own_workspaces;
  const limit = kind === 'boards' ? limits.max_boards : limits.max_own_workspaces;

  const base =
    'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold';

  if (isPremium || limit === null) {
    return (
      <span
        data-testid="plan-usage-badge"
        title="Plan Premium — bez limitów"
        className={`${base} border-violet-200 bg-violet-50 text-violet-700 ${className}`}
      >
        Premium
      </span>
    );
  }

  const atLimit = used >= limit;
  const tone = atLimit
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-gray-200 bg-gray-50 text-gray-700';

  return (
    <span
      data-testid="plan-usage-badge"
      title={`Plan Free: ${used} z ${limit} (${LABELS[kind]})`}
      className={`${base} ${tone} ${className}`}
    >
      {used}/{limit} {LABELS[kind]}
    </span>
  );
}
