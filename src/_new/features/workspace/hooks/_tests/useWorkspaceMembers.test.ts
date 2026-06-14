import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkspaceMembers } from '../useWorkspaceMember';
import {
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
} from '../../api/memberApi';
import { AppError, ErrorCode } from '@new/lib/errors/AppError';
import { mockWorkspaceMember, mockWorkspaceMembersResponse } from '@/test/mocks/fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../api/memberApi', () => ({
  fetchWorkspaceMembers: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  updateMemberRole: vi.fn(),
}));

describe('useWorkspaceMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWorkspaceMembers).mockResolvedValue(mockWorkspaceMembersResponse);
    vi.mocked(removeWorkspaceMember).mockResolvedValue({ message: 'Usunięto' });
    vi.mocked(updateMemberRole).mockResolvedValue({ message: 'Zmieniono', new_role: 'editor' });
  });

  const setup = (workspace_id: number | null = 10, autoLoad = true) =>
    renderHook(() => useWorkspaceMembers({ workspace_id, autoLoad }));

  // ─── inicjalizacja ─────────────────────────────────────────────────────────

  it('inicjalizuje pusty stan gdy workspace_id=null', () => {
    const { result } = renderHook(() =>
      useWorkspaceMembers({ workspace_id: null, autoLoad: true })
    );
    expect(result.current.members).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('wywołuje fetchWorkspaceMembers przy montowaniu gdy autoLoad=true', async () => {
    setup();
    await waitFor(() => {
      expect(fetchWorkspaceMembers).toHaveBeenCalledWith(10);
    });
  });

  it('nie wywołuje fetchWorkspaceMembers gdy autoLoad=false', async () => {
    setup(10, false);
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchWorkspaceMembers).not.toHaveBeenCalled();
  });

  // ─── loadMembers ───────────────────────────────────────────────────────────

  describe('loadMembers', () => {
    it('wczytuje członków i ustawia stan', async () => {
      const { result } = setup(10, false);
      await act(async () => { await result.current.loadMembers(); });
      expect(result.current.members).toEqual(mockWorkspaceMembersResponse.members);
      expect(result.current.loading).toBe(false);
    });

    it('nie robi nic gdy workspace_id=null', async () => {
      const { result } = setup(null, false);
      await act(async () => { await result.current.loadMembers(); });
      expect(fetchWorkspaceMembers).not.toHaveBeenCalled();
      expect(result.current.members).toEqual([]);
    });

    it('ustawia error gdy API zwraca błąd', async () => {
      vi.mocked(fetchWorkspaceMembers).mockRejectedValue(
        new AppError('Brak dostępu', ErrorCode.AUTH_ERROR, 403)
      );
      const { result } = setup(10, false);
      await act(async () => { await result.current.loadMembers(); });
      expect(result.current.error).toBeTruthy();
    });
  });

  // ─── removeMember ──────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('usuwa członka z lokalnej listy po sukcesie', async () => {
      const { result } = setup();
      await waitFor(() => {
        expect(result.current.members).toHaveLength(1);
      });
      await act(async () => { await result.current.removeMember(1); });
      expect(result.current.members).toHaveLength(0);
    });

    it('ustawia removingMemberId podczas operacji', async () => {
      let resolveFn!: (val: { message: string }) => void;
      vi.mocked(removeWorkspaceMember).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; })
      );
      const { result } = setup();
      await waitFor(() => {
        expect(result.current.members).toHaveLength(1);
      });

      let removePromise!: Promise<void>;
      act(() => { removePromise = result.current.removeMember(1); });
      expect(result.current.removingMemberId).toBe(1);

      act(() => resolveFn({ message: 'ok' }));
      await act(async () => { await removePromise; });
      expect(result.current.removingMemberId).toBeNull();
    });

    it('nie robi nic gdy workspace_id=null', async () => {
      const { result } = setup(null, false);
      await act(async () => { await result.current.removeMember(1); });
      expect(removeWorkspaceMember).not.toHaveBeenCalled();
    });
  });

  // ─── changeRole ────────────────────────────────────────────────────────────

  describe('changeRole', () => {
    it('aktualizuje rolę w lokalnej liście po sukcesie', async () => {
      const twoMembers = {
        members: [
          { ...mockWorkspaceMember, user_id: 1, role: 'owner', is_owner: true },
          { ...mockWorkspaceMember, id: 2, user_id: 2, role: 'viewer', is_owner: false },
        ],
        total: 2,
      };
      vi.mocked(fetchWorkspaceMembers).mockResolvedValue(twoMembers);
      vi.mocked(updateMemberRole).mockResolvedValue({ message: 'Zmieniono', new_role: 'editor' });

      const { result } = setup();
      await waitFor(() => {
        expect(result.current.members).toHaveLength(2);
      });

      await act(async () => { await result.current.changeRole(2, 'editor'); });
      const updated = result.current.members.find((m) => m.user_id === 2);
      expect(updated?.role).toBe('editor');
    });
  });

  // ─── helper functions ──────────────────────────────────────────────────────

  describe('getMemberById', () => {
    it('zwraca członka o podanym userId', async () => {
      const { result } = setup();
      await waitFor(() => {
        expect(result.current.members).toHaveLength(1);
      });
      const member = result.current.getMemberById(1);
      expect(member?.username).toBe('testuser');
    });

    it('zwraca undefined gdy nie znaleziono', async () => {
      const { result } = setup();
      await waitFor(() => {
        expect(result.current.members).toHaveLength(1);
      });
      expect(result.current.getMemberById(99)).toBeUndefined();
    });
  });

  describe('getOwner', () => {
    it('zwraca właściciela workspace', async () => {
      const { result } = setup();
      await waitFor(() => {
        expect(result.current.members).toHaveLength(1);
      });
      const owner = result.current.getOwner();
      expect(owner?.is_owner).toBe(true);
    });
  });

  describe('getMembersByRole', () => {
    it('zwraca tylko członków z podaną rolą', async () => {
      const { result } = setup();
      await waitFor(() => {
        expect(result.current.members).toHaveLength(1);
      });
      const owners = result.current.getMembersByRole('owner');
      expect(owners).toHaveLength(1);
      const viewers = result.current.getMembersByRole('viewer');
      expect(viewers).toHaveLength(0);
    });
  });

  describe('memberCount / hasMembers', () => {
    it('zwraca poprawną liczbę członków', async () => {
      const { result } = setup();
      await waitFor(() => {
        expect(result.current.memberCount).toBe(1);
        expect(result.current.hasMembers).toBe(true);
      });
    });
  });
});
