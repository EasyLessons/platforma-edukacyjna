import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@new/lib/api/client';
import {
  createInvite,
  getPendingInvites,
  acceptInvite,
  rejectInvite,
  checkUserInviteStatus,
  checkUsersInviteStatusBatch,
} from './inviteApi';
import { AppError } from '@new/lib/errors/AppError';
import {
  mockInviteResponse,
  mockPendingInvite,
  mockAcceptInviteResponse,
  mockInviteStatus,
} from '@/test/mocks/fixtures';

vi.mock('@new/lib/auth', () => ({
  getAccessToken: vi.fn(() => null),
  setAccessToken: vi.fn(),
  clearSession: vi.fn(),
  refreshAccessToken: vi.fn().mockRejectedValue(new Error('Refresh failed')),
  logoutAndRedirect: vi.fn(),
  removeAccessToken: vi.fn(),
  getStoredUser: vi.fn(() => null),
  setStoredUser: vi.fn(),
  removeStoredUser: vi.fn(),
}));

const mock = new MockAdapter(apiClient, { onNoMatch: 'throwException' });

beforeEach(() => mock.reset());
afterAll(() => mock.restore());

// ─── createInvite ──────────────────────────────────────────────────────────

describe('createInvite', () => {
  it('zwraca InviteResponse przy sukcesie', async () => {
    mock.onPost('/api/v1/workspaces/10/invite').reply(200, {
      success: true,
      data: mockInviteResponse,
    });
    const result = await createInvite(10, 2);
    expect(result.invite_token).toBe('abc-token-123');
    expect(result.workspace_id).toBe(10);
  });

  it('rzuca AppError przy 409 (zaproszenie już istnieje)', async () => {
    mock.onPost('/api/v1/workspaces/10/invite').reply(409, {
      success: false,
      error: 'Zaproszenie już istnieje',
    });
    await expect(createInvite(10, 2)).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isConflict()
    );
  });
});

// ─── getPendingInvites ─────────────────────────────────────────────────────

describe('getPendingInvites', () => {
  it('zwraca listę oczekujących zaproszeń', async () => {
    mock.onGet('/api/v1/workspaces/invites/pending').reply(200, {
      success: true,
      data: [mockPendingInvite],
    });
    const result = await getPendingInvites();
    expect(result).toHaveLength(1);
    expect(result[0].invite_token).toBe('abc-token-123');
  });

  it('zwraca pustą tablicę gdy brak zaproszeń', async () => {
    mock.onGet('/api/v1/workspaces/invites/pending').reply(200, {
      success: true,
      data: [],
    });
    const result = await getPendingInvites();
    expect(result).toHaveLength(0);
  });
});

// ─── acceptInvite ──────────────────────────────────────────────────────────

describe('acceptInvite', () => {
  it('zwraca AcceptInviteResponse przy sukcesie', async () => {
    mock.onPost('/api/v1/workspaces/invites/accept/abc-token-123').reply(200, {
      success: true,
      data: mockAcceptInviteResponse,
    });
    const result = await acceptInvite('abc-token-123');
    expect(result.workspace_id).toBe(10);
    expect(result.role).toBe('editor');
  });

  it('rzuca AppError przy 404 (token wygasł lub nie istnieje)', async () => {
    mock.onPost('/api/v1/workspaces/invites/accept/bad-token').reply(404, {
      success: false,
      error: 'Token nie istnieje',
    });
    await expect(acceptInvite('bad-token')).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isNotFound()
    );
  });
});

// ─── rejectInvite ──────────────────────────────────────────────────────────

describe('rejectInvite', () => {
  it('zwraca message przy odrzuceniu', async () => {
    mock.onDelete('/api/v1/workspaces/invites/abc-token-123').reply(200, {
      success: true,
      data: { message: 'Zaproszenie odrzucone' },
    });
    const result = await rejectInvite('abc-token-123');
    expect(result.message).toBe('Zaproszenie odrzucone');
  });
});

// ─── checkUserInviteStatus ─────────────────────────────────────────────────

describe('checkUserInviteStatus', () => {
  it('zwraca status zaproszenia użytkownika', async () => {
    mock.onGet('/api/v1/workspaces/10/members/check/2').reply(200, {
      success: true,
      data: mockInviteStatus,
    });
    const result = await checkUserInviteStatus(10, 2);
    expect(result.is_member).toBe(false);
    expect(result.can_invite).toBe(true);
  });
});

// ─── checkUsersInviteStatusBatch ───────────────────────────────────────────

describe('checkUsersInviteStatusBatch', () => {
  it('zwraca mapę statusów dla wielu użytkowników', async () => {
    const statusMap = {
      2: { is_member: false, has_pending_invite: false, can_invite: true },
      3: { is_member: true, has_pending_invite: false, can_invite: false },
    };
    mock.onPost('/api/v1/workspaces/10/members/check-batch').reply(200, {
      success: true,
      data: { statuses: statusMap },
    });
    const result = await checkUsersInviteStatusBatch(10, [2, 3]);
    expect(result[2].can_invite).toBe(true);
    expect(result[3].is_member).toBe(true);
  });
});
