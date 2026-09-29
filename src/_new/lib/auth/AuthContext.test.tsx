import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('./session-api', () => ({
  getCurrentUser: vi.fn(),
  logoutUser: vi.fn(() => Promise.resolve()),
}));
vi.mock('./tokenService', () => ({ refreshAccessToken: vi.fn() }));
vi.mock('./tokenStore', () => ({
  setAccessToken: vi.fn(),
  setStoredUser: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/_new/lib/board-cache/board-cache', () => ({
  getDirtyBoardCaches: vi.fn(() => []),
  sweepForeignBoardCaches: vi.fn(),
}));

import { AuthProvider, useAuth } from './AuthContext';
import { getCurrentUser } from './session-api';
import { clearSession } from './tokenStore';
import { getDirtyBoardCaches, sweepForeignBoardCaches } from '@/_new/lib/board-cache/board-cache';

const USER = { id: 11, username: 'ala', email: 'a@b.c', is_active: true, created_at: '2026-01-01' };

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

async function renderLoggedIn() {
  vi.mocked(getCurrentUser).mockResolvedValue(USER as never);
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.user).not.toBeNull());
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDirtyBoardCaches).mockReturnValue([]);
});

describe('AuthProvider - lokalne kopie tablic', () => {
  it('po bootstrapie usuwa kopie innych użytkowników', async () => {
    await renderLoggedIn();

    expect(sweepForeignBoardCaches).toHaveBeenCalledWith(11);
  });

  it('login innego konta usuwa kopie poprzedniego', async () => {
    const { result } = await renderLoggedIn();

    act(() => result.current.login('tok', { ...USER, id: 12 } as never));

    expect(sweepForeignBoardCaches).toHaveBeenLastCalledWith(12);
  });

  it('logout bez niewysłanych zmian: bez pytania, usuwa wszystkie kopie', async () => {
    const { result } = await renderLoggedIn();
    const confirmSpy = vi.spyOn(window, 'confirm');

    let loggedOut = false;
    act(() => {
      loggedOut = result.current.logout();
    });

    expect(loggedOut).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalledWith({ keepDirty: false });
    expect(result.current.user).toBeNull();
    confirmSpy.mockRestore();
  });

  it('logout z niewysłanymi zmianami i "Anuluj": nic nie usuwa, zwraca false', async () => {
    const { result } = await renderLoggedIn();
    vi.mocked(getDirtyBoardCaches).mockReturnValue(['easylesson-wb-v1-u11-b159']);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    let loggedOut = true;
    act(() => {
      loggedOut = result.current.logout();
    });

    expect(loggedOut).toBe(false);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
    expect(result.current.user).not.toBeNull();
    confirmSpy.mockRestore();
  });

  it('logout z niewysłanymi zmianami i "OK": usuwa wszystkie kopie', async () => {
    const { result } = await renderLoggedIn();
    vi.mocked(getDirtyBoardCaches).mockReturnValue(['easylesson-wb-v1-u11-b159']);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let loggedOut = false;
    act(() => {
      loggedOut = result.current.logout();
    });

    expect(loggedOut).toBe(true);
    expect(clearSession).toHaveBeenCalledWith({ keepDirty: false });
    confirmSpy.mockRestore();
  });
});
