import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@new/lib/api/client';
import {
  fetchWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  leaveWorkspace,
  toggleWorkspaceFavourite,
  setActiveWorkspace,
} from './workspaceApi';
import { AppError } from '@new/lib/errors/AppError';
import { mockWorkspace, mockWorkspaceListResponse } from '@/test/mocks/fixtures';

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

// ─── fetchWorkspaces ───────────────────────────────────────────────────────

describe('fetchWorkspaces', () => {
  it('zwraca WorkspaceListResponse przy sukcesie', async () => {
    mock.onGet('/api/v1/workspaces').reply(200, {
      success: true,
      data: mockWorkspaceListResponse,
    });
    const result = await fetchWorkspaces();
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0].id).toBe(10);
  });

  it('rzuca AppError przy błędzie sieciowym', async () => {
    mock.onGet('/api/v1/workspaces').networkError();
    await expect(fetchWorkspaces()).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isNetworkError()
    );
  });
});

// ─── createWorkspace ───────────────────────────────────────────────────────

describe('createWorkspace', () => {
  it('zwraca nowy workspace przy sukcesie', async () => {
    mock.onPost('/api/v1/workspaces').reply(200, { success: true, data: mockWorkspace });
    const result = await createWorkspace({ name: 'Test Workspace' });
    expect(result).toEqual(mockWorkspace);
    expect(result.name).toBe('Test Workspace');
  });

  it('rzuca AppError przy 409 (nazwa zajęta)', async () => {
    mock.onPost('/api/v1/workspaces').reply(409, {
      success: false,
      error: 'Workspace o tej nazwie już istnieje',
    });
    await expect(createWorkspace({ name: 'Zajęta' })).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isConflict()
    );
  });
});

// ─── updateWorkspace ───────────────────────────────────────────────────────

describe('updateWorkspace', () => {
  it('zwraca zaktualizowany workspace', async () => {
    const updated = { ...mockWorkspace, name: 'Nowa nazwa' };
    mock.onPut('/api/v1/workspaces/10').reply(200, { success: true, data: updated });
    const result = await updateWorkspace(10, { name: 'Nowa nazwa' });
    expect(result.name).toBe('Nowa nazwa');
  });

  it('rzuca AppError przy 403', async () => {
    window.location.pathname = '/login';
    mock.onPut('/api/v1/workspaces/10').reply(403, { success: false, error: 'Brak dostępu' });
    await expect(updateWorkspace(10, { name: 'X' })).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isForbidden()
    );
  });
});

// ─── deleteWorkspace ───────────────────────────────────────────────────────

describe('deleteWorkspace', () => {
  it('kończy się bez błędu przy sukcesie', async () => {
    mock.onDelete('/api/v1/workspaces/10').reply(200, { success: true, data: null });
    await expect(deleteWorkspace(10)).resolves.toBeUndefined();
  });
});

// ─── leaveWorkspace ────────────────────────────────────────────────────────

describe('leaveWorkspace', () => {
  it('zwraca message przy sukcesie', async () => {
    mock.onDelete('/api/v1/workspaces/10/leave').reply(200, {
      success: true,
      data: { message: 'Opuściłeś workspace' },
    });
    const result = await leaveWorkspace(10);
    expect(result.message).toBe('Opuściłeś workspace');
  });
});

// ─── toggleWorkspaceFavourite ──────────────────────────────────────────────

describe('toggleWorkspaceFavourite', () => {
  it('kończy się bez błędu przy sukcesie', async () => {
    mock.onPatch('/api/v1/workspaces/10/favourite').reply(200, { success: true, data: null });
    await expect(toggleWorkspaceFavourite(10, true)).resolves.toBeUndefined();
  });
});

// ─── setActiveWorkspace ────────────────────────────────────────────────────

describe('setActiveWorkspace', () => {
  it('kończy się bez błędu przy sukcesie', async () => {
    mock.onPatch('/api/v1/workspaces/10/set-active').reply(200, { success: true, data: null });
    await expect(setActiveWorkspace(10)).resolves.toBeUndefined();
  });
});
