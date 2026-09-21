import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../hooks/use-plan', () => ({ usePlan: vi.fn() }));

import { usePlan } from '../hooks/use-plan';
import { PlanUsageBadge } from './plan-usage-badge';

const mockedUsePlan = vi.mocked(usePlan);

function planState(overrides: Partial<ReturnType<typeof usePlan>>) {
  return {
    plan: 'free',
    limits: {
      max_own_workspaces: 1,
      max_boards: 3,
      max_elements_per_board: 300,
      ai_chat_daily: null,
    },
    usage: { own_workspaces: 1, boards: 2 },
    isPremium: false,
    isLoaded: true,
    loading: false,
    error: null,
    canCreateBoard: true,
    canCreateWorkspace: false,
    refresh: vi.fn(),
    ...overrides,
  } as ReturnType<typeof usePlan>;
}

beforeEach(() => {
  mockedUsePlan.mockReset();
});

describe('PlanUsageBadge', () => {
  it('pokazuje „2/3 tablice" dla planu free', () => {
    mockedUsePlan.mockReturnValue(planState({}));
    render(<PlanUsageBadge kind="boards" />);
    expect(screen.getByTestId('plan-usage-badge')).toHaveTextContent('2/3 tablice');
  });

  it('domyślnie liczy tablice', () => {
    mockedUsePlan.mockReturnValue(planState({}));
    render(<PlanUsageBadge />);
    expect(screen.getByTestId('plan-usage-badge')).toHaveTextContent('2/3 tablice');
  });

  it('pokazuje zużycie workspace’ów dla kind="workspaces"', () => {
    mockedUsePlan.mockReturnValue(planState({}));
    render(<PlanUsageBadge kind="workspaces" />);
    expect(screen.getByTestId('plan-usage-badge')).toHaveTextContent("1/1 workspace'y");
  });

  it('przy osiągniętym limicie ma czerwony wariant', () => {
    mockedUsePlan.mockReturnValue(planState({ usage: { own_workspaces: 1, boards: 3 } }));
    render(<PlanUsageBadge />);
    const badge = screen.getByTestId('plan-usage-badge');
    expect(badge).toHaveTextContent('3/3 tablice');
    expect(badge.className).toContain('text-red-700');
  });

  it('premium → plakietka „Premium"', () => {
    mockedUsePlan.mockReturnValue(
      planState({
        plan: 'premium',
        isPremium: true,
        limits: {
          max_own_workspaces: null,
          max_boards: null,
          max_elements_per_board: null,
          ai_chat_daily: null,
        },
      })
    );
    render(<PlanUsageBadge />);
    expect(screen.getByTestId('plan-usage-badge')).toHaveTextContent('Premium');
  });

  it('przed załadowaniem nic nie renderuje', () => {
    mockedUsePlan.mockReturnValue(planState({ isLoaded: false, limits: null, usage: null }));
    const { container } = render(<PlanUsageBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
