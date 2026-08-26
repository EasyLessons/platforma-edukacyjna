import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@new/lib/api/client';
import {
  createShareLink,
  refreshShareLink,
  revokeShareLink,
  previewShareLink,
  joinShareLink,
} from './shareLinkApi';
import { AppError } from '@new/lib/errors/AppError';
import {
  mockShareLinkResponse,
  mockShareLinkPreview,
  mockJoinShareLinkResponse,
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

// ─── createShareLink ───────────────────────────────────────────────────────

describe('createShareLink', () => {
  it('zwraca ShareLinkResponse przy sukcesie', async () => {
    mock.onPost('/api/v1/workspaces/10/share-link').reply(200, {
      success: true,
      data: mockShareLinkResponse,
    });
    const result = await createShareLink(10);
    expect(result.token).toBe('share-token-123');
    expect(result.workspace_id).toBe(10);
  });

  it('rzuca AppError przy 403 (viewer)', async () => {
    mock.onPost('/api/v1/workspaces/10/share-link').reply(403, {
      success: false,
      error: 'Musisz być edytorem lub właścicielem',
    });
    await expect(createShareLink(10)).rejects.toBeInstanceOf(AppError);
  });
});

// ─── refreshShareLink ──────────────────────────────────────────────────────

describe('refreshShareLink', () => {
  it('zwraca nowy ShareLinkResponse przy sukcesie', async () => {
    const refreshed = { ...mockShareLinkResponse, token: 'share-token-456' };
    mock.onPost('/api/v1/workspaces/10/share-link/refresh').reply(200, {
      success: true,
      data: refreshed,
    });
    const result = await refreshShareLink(10);
    expect(result.token).toBe('share-token-456');
  });
});

// ─── revokeShareLink ───────────────────────────────────────────────────────

describe('revokeShareLink', () => {
  it('zwraca message przy unieważnieniu', async () => {
    mock.onDelete('/api/v1/workspaces/10/share-link/share-token-123').reply(200, {
      success: true,
      data: { message: 'Link został unieważniony' },
    });
    const result = await revokeShareLink(10, 'share-token-123');
    expect(result.message).toBe('Link został unieważniony');
  });
});

// ─── previewShareLink ──────────────────────────────────────────────────────

describe('previewShareLink', () => {
  it('zwraca ShareLinkPreview przy sukcesie', async () => {
    mock.onGet('/api/v1/workspaces/share-link/share-token-123').reply(200, {
      success: true,
      data: mockShareLinkPreview,
    });
    const result = await previewShareLink('share-token-123');
    expect(result.workspace_name).toBe('Test Workspace');
    expect(result.already_member).toBe(false);
  });

  it('rzuca AppError przy 410 (link wygasł/unieważniony)', async () => {
    mock.onGet('/api/v1/workspaces/share-link/bad-token').reply(410, {
      success: false,
      error: 'Link wygasł',
    });
    await expect(previewShareLink('bad-token')).rejects.toBeInstanceOf(AppError);
  });

  it('rzuca AppError przy 404 (token nie istnieje)', async () => {
    mock.onGet('/api/v1/workspaces/share-link/unknown-token').reply(404, {
      success: false,
      error: 'Link nie istnieje',
    });
    await expect(previewShareLink('unknown-token')).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isNotFound()
    );
  });
});

// ─── joinShareLink ─────────────────────────────────────────────────────────

describe('joinShareLink', () => {
  it('zwraca JoinShareLinkResponse przy sukcesie', async () => {
    mock.onPost('/api/v1/workspaces/share-link/share-token-123/join').reply(200, {
      success: true,
      data: mockJoinShareLinkResponse,
    });
    const result = await joinShareLink('share-token-123');
    expect(result.role).toBe('editor');
    expect(result.already_member).toBe(false);
  });
});
