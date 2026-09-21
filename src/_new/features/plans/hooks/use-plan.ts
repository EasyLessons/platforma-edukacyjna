/**
 * USE PLAN (alias: useEntitlements)
 *
 * Plan bieżącego użytkownika z GET /api/v1/plans/me na TanStack Query.
 *
 * Zwraca:
 * - plan, limits, usage, isPremium, isLoaded, loading, error
 * - canCreateBoard / canCreateWorkspace — podpowiedź dla UI (źródłem prawdy
 *   jest backend: 403 PLAN_LIMIT_*). Przed załadowaniem danych = true, żeby nie
 *   blokować przycisków na podstawie braku informacji.
 * - refresh() — inwalidacja po mutacjach (utworzenie/usunięcie tablicy, workspace'u)
 */
'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMyPlan } from '../api/plans-api';
import type { PlanLimits, PlanMe, PlanName, PlanUsage } from '../types';

export const planKeys = {
  me: ['plans', 'me'] as const,
};

function withinLimit(used: number | undefined, limit: number | null | undefined): boolean {
  if (used === undefined || limit === undefined) return true; // brak danych — nie blokuj
  if (limit === null) return true; // bez limitu
  return used < limit;
}

export function usePlan() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery<PlanMe>({
    queryKey: planKeys.me,
    queryFn: fetchMyPlan,
    staleTime: 30_000,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: planKeys.me });
  }, [queryClient]);

  return useMemo(() => {
    const plan: PlanName = data?.plan ?? 'free';
    const limits: PlanLimits | null = data?.limits ?? null;
    const usage: PlanUsage | null = data?.usage ?? null;
    const error: string | null = queryError
      ? queryError instanceof Error
        ? queryError.message
        : String(queryError)
      : null;

    return {
      plan,
      limits,
      usage,
      isPremium: plan === 'premium',
      isLoaded: !!data,
      loading,
      error,
      canCreateBoard: withinLimit(usage?.boards, limits?.max_boards),
      canCreateWorkspace: withinLimit(usage?.own_workspaces, limits?.max_own_workspaces),
      refresh,
    };
  }, [data, loading, queryError, refresh]);
}

export const useEntitlements = usePlan;
