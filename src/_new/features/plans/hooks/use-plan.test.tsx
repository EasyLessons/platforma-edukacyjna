import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiMock, resetApiMock, restoreApiMock } from '@/test/mocks/apiClientMock';
import { usePlan, useEntitlements } from './use-plan';
import type { PlanMe } from '../types';

const FREE_LIMITS = {
  max_own_workspaces: 1,
  max_boards: 3,
  max_elements_per_board: 300,
  ai_chat_daily: null,
};

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function mockPlan(data: PlanMe) {
  apiMock.onGet('/api/v1/plans/me').reply(200, { success: true, data });
}

afterEach(() => resetApiMock());
afterAll(() => restoreApiMock());

describe('usePlan', () => {
  it('free 2/3 tablice: można tworzyć tablicę, nie można drugiego workspace', async () => {
    mockPlan({ plan: 'free', limits: FREE_LIMITS, usage: { own_workspaces: 1, boards: 2 } });
    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.plan).toBe('free');
    expect(result.current.isPremium).toBe(false);
    expect(result.current.limits).toEqual(FREE_LIMITS);
    expect(result.current.usage).toEqual({ own_workspaces: 1, boards: 2 });
    expect(result.current.canCreateBoard).toBe(true);
    expect(result.current.canCreateWorkspace).toBe(false);
  });

  it('free 3/3 tablice: canCreateBoard false', async () => {
    mockPlan({ plan: 'free', limits: FREE_LIMITS, usage: { own_workspaces: 1, boards: 3 } });
    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.canCreateBoard).toBe(false);
  });

  it('premium: bez limitów niezależnie od zużycia', async () => {
    mockPlan({
      plan: 'premium',
      limits: {
        max_own_workspaces: null,
        max_boards: null,
        max_elements_per_board: null,
        ai_chat_daily: null,
      },
      usage: { own_workspaces: 7, boards: 40 },
    });
    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.isPremium).toBe(true);
    expect(result.current.canCreateBoard).toBe(true);
    expect(result.current.canCreateWorkspace).toBe(true);
  });

  it('przed załadowaniem nie blokuje UI (canCreate* true, isLoaded false)', () => {
    mockPlan({ plan: 'free', limits: FREE_LIMITS, usage: { own_workspaces: 1, boards: 3 } });
    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.plan).toBe('free');
    expect(result.current.limits).toBeNull();
    expect(result.current.canCreateBoard).toBe(true);
    expect(result.current.canCreateWorkspace).toBe(true);
  });

  it('błąd API trafia do error, nie wywala hooka', async () => {
    apiMock.onGet('/api/v1/plans/me').reply(500, { success: false, error: 'Błąd serwera' });
    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.canCreateBoard).toBe(true);
  });

  it('useEntitlements to alias usePlan', () => {
    expect(useEntitlements).toBe(usePlan);
  });
});
