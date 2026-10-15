/**
 * PLAN USAGE BADGE
 *
 * Licznik zużycia planu: „2/3 tablice" (dla `kind="boards"` + `workspaceId` własnej
 * przestrzeni) albo „1/2 przestrzenie" (`kind="workspaces"`).
 * Premium (albo brak limitu) → mała plakietka „Premium".
 * Przed załadowaniem danych albo dla cudzej przestrzeni nic nie renderuje.
 */
'use client';

import { usePlan } from '../hooks/use-plan';

type UsageKind = 'boards' | 'workspaces';

const LABELS: Record<UsageKind, string> = {
  boards: 'tablice',
  workspaces: 'przestrzenie',
};

interface PlanUsageBadgeProps {
  kind?: UsageKind;
  /** Wymagane dla kind="boards": id przestrzeni, której dotyczy licznik. */
  workspaceId?: number;
  className?: string;
}

export function PlanUsageBadge({
  kind = 'boards',
  workspaceId,
  className = '',
}: PlanUsageBadgeProps) {
  const { isLoaded, isPremium, limits, usage, boardsIn } = usePlan();
  if (!isLoaded || !limits || !usage) return null;

  let used: number | undefined;
  if (kind === 'boards') {
    if (workspaceId === undefined) return null;
    used = boardsIn(workspaceId);
  } else {
    used = usage.own_workspaces;
  }
  if (used === undefined) return null; // nie moja przestrzeń - limit liczy się u właściciela

  const limit = kind === 'boards' ? limits.max_boards_per_workspace : limits.max_own_workspaces;

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
  const scope = kind === 'boards' ? ' w tej przestrzeni' : '';

  return (
    <span
      data-testid="plan-usage-badge"
      title={`Plan Free: ${used} z ${limit} (${LABELS[kind]}${scope})`}
      className={`${base} ${tone} ${className}`}
    >
      {used}/{limit} {LABELS[kind]}
    </span>
  );
}
