import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@new/lib/api/client';
import {
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
  getMyRole,
} from './memberApi';
import { AppError } from '@new/lib/errors/AppError';
import {
  mockWorkspaceMembersResponse,
  mockMyRoleResponse,
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

// ─── fetchWorkspaceMembers ─────────────────────────────────────────────────

describe('fetchWorkspaceMembers', () => {
  it('zwraca listę członków przy sukcesie', async () => {
    mock.onGet('/api/v1/workspaces/10/members').reply(200, {
      success: true,
      data: mockWorkspaceMembersResponse,
    });
    const result = await fetchWorkspaceMembers(10);
    expect(result.members).toHaveLength(1);
    expect(result.members[0].username).toBe('testuser');
    expect(result.members[0].is_owner).toBe(true);
  });

  it('rzuca AppError przy 404', async () => {
    mock.onGet('/api/v1/workspaces/99/members').reply(404, {
      success: false,
      error: 'Nie znaleziono',
    });
    await expect(fetchWorkspaceMembers(99)).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isNotFound()
    );
  });
});

// ─── removeWorkspaceMember ─────────────────────────────────────────────────

describe('removeWorkspaceMember', () => {
  it('zwraca message przy sukcesie', async () => {
    mock.onDelete('/api/v1/workspaces/10/members/2').reply(200, {
      success: true,
      data: { message: 'Członek usunięty' },
    });
    const result = await removeWorkspaceMember(10, 2);
    expect(result.message).toBe('Członek usunięty');
  });

  it('rzuca AppError przy 403 (brak uprawnień)', async () => {
    window.location.pathname = '/login';
    mock.onDelete('/api/v1/workspaces/10/members/2').reply(403, {
      success: false,
      error: 'Brak uprawnień',
    });
    await expect(removeWorkspaceMember(10, 2)).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isForbidden()
    );
  });
});

// ─── updateMemberRole ──────────────────────────────────────────────────────

describe('updateMemberRole', () => {
  it('zwraca nową rolę', async () => {
    mock.onPatch('/api/v1/workspaces/10/members/2/role').reply(200, {
      success: true,
      data: { message: 'Rola zmieniona', new_role: 'editor' },
    });
    const result = await updateMemberRole(10, 2, 'editor');
    expect(result.new_role).toBe('editor');
  });

  it('rzuca AppError przy próbie zmiany roli właściciela (403)', async () => {
    window.location.pathname = '/login';
    mock.onPatch('/api/v1/workspaces/10/members/1/role').reply(403, {
      success: false,
      error: 'Nie można zmienić roli właściciela',
    });
    await expect(updateMemberRole(10, 1, 'viewer')).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isForbidden()
    );
  });
});

// ─── getMyRole ─────────────────────────────────────────────────────────────

describe('getMyRole', () => {
  it('zwraca rolę użytkownika w workspace', async () => {
    mock.onGet('/api/v1/workspaces/10/my-role').reply(200, {
      success: true,
      data: mockMyRoleResponse,
    });
    const result = await getMyRole(10);
    expect(result.role).toBe('owner');
    expect(result.is_owner).toBe(true);
    expect(result.workspace_id).toBe(10);
  });
});
