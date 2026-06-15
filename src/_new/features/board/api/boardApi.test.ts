import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@new/lib/api/client';
import {
  fetchBoards,
  fetchBoardById,
  createBoard,
  updateBoard,
  deleteBoard,
  toggleBoardFavourite,
  fetchBoardMembers,
  updateBoardMemberRole,
  updateBoardSettings,
  joinBoardWorkspace,
} from './boardApi';
import { AppError } from '@new/lib/errors/AppError';
import { mockBoard, mockBoardListResponse, mockBoardMembersResponse } from '@/test/mocks/fixtures';

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

// ─── fetchBoards ───────────────────────────────────────────────────────────

describe('fetchBoards', () => {
  it('zwraca BoardListResponse przy sukcesie', async () => {
    mock.onGet('/api/v1/boards').reply(200, { success: true, data: mockBoardListResponse });
    const result = await fetchBoards(10);
    expect(result).toEqual(mockBoardListResponse);
  });

  it('rzuca AppError przy 403', async () => {
    window.location.pathname = '/login';
    mock.onGet('/api/v1/boards').reply(403, { success: false, error: 'Brak dostępu' });
    await expect(fetchBoards(10)).rejects.toBeInstanceOf(AppError);
  });
});

// ─── fetchBoardById ────────────────────────────────────────────────────────

describe('fetchBoardById', () => {
  it('zwraca Board przy sukcesie', async () => {
    mock.onGet('/api/v1/boards/1').reply(200, { success: true, data: mockBoard });
    const result = await fetchBoardById(1);
    expect(result).toEqual(mockBoard);
  });

  it('rzuca AppError.isNotFound() przy 404', async () => {
    mock.onGet('/api/v1/boards/99').reply(404, { success: false, error: 'Nie znaleziono' });
    await expect(fetchBoardById(99)).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isNotFound()
    );
  });
});

// ─── createBoard ───────────────────────────────────────────────────────────

describe('createBoard', () => {
  it('zwraca nową tablicę przy sukcesie', async () => {
    mock.onPost('/api/v1/boards').reply(200, { success: true, data: mockBoard });
    const result = await createBoard({ name: 'Test Board', workspace_id: 10 });
    expect(result).toEqual(mockBoard);
  });

  it('rzuca AppError przy błędzie walidacji (400)', async () => {
    mock.onPost('/api/v1/boards').reply(400, { success: false, error: 'Nazwa jest wymagana' });
    await expect(createBoard({ name: '', workspace_id: 10 })).rejects.toBeInstanceOf(AppError);
  });
});

// ─── updateBoard ───────────────────────────────────────────────────────────

describe('updateBoard', () => {
  it('zwraca zaktualizowaną tablicę', async () => {
    const updated = { ...mockBoard, name: 'Nowa nazwa' };
    mock.onPut('/api/v1/boards/1').reply(200, { success: true, data: updated });
    const result = await updateBoard(1, { name: 'Nowa nazwa' });
    expect(result.name).toBe('Nowa nazwa');
  });
});

// ─── deleteBoard ───────────────────────────────────────────────────────────

describe('deleteBoard', () => {
  it('kończy się bez błędu przy sukcesie', async () => {
    mock.onDelete('/api/v1/boards/1').reply(200, { success: true, data: null });
    await expect(deleteBoard(1)).resolves.toBeUndefined();
  });
});

// ─── toggleBoardFavourite ──────────────────────────────────────────────────

describe('toggleBoardFavourite', () => {
  it('zwraca zaktualizowany status ulubione', async () => {
    const response = { is_favourite: true, message: 'Dodano do ulubionych' };
    mock.onPost('/api/v1/boards/1/toggle-favourite').reply(200, { success: true, data: response });
    const result = await toggleBoardFavourite(1, true);
    expect(result.is_favourite).toBe(true);
  });
});

// ─── fetchBoardMembers ─────────────────────────────────────────────────────

describe('fetchBoardMembers', () => {
  it('zwraca listę członków tablicy', async () => {
    mock.onGet('/api/v1/boards/1/members').reply(200, { success: true, data: mockBoardMembersResponse });
    const result = await fetchBoardMembers(1);
    expect(result.members).toHaveLength(1);
    expect(result.members[0].username).toBe('testuser');
  });
});

// ─── updateBoardMemberRole ─────────────────────────────────────────────────

describe('updateBoardMemberRole', () => {
  it('zwraca nową rolę', async () => {
    const response = { message: 'Rola zmieniona', new_role: 'editor' };
    mock.onPatch('/api/v1/boards/1/members/2/role').reply(200, { success: true, data: response });
    const result = await updateBoardMemberRole(1, 2, 'editor');
    expect(result.new_role).toBe('editor');
  });
});

// ─── updateBoardSettings ───────────────────────────────────────────────────

describe('updateBoardSettings', () => {
  it('zwraca zaktualizowane ustawienia', async () => {
    const settings = { ai_enabled: true, grid_visible: false, smartsearch_visible: true, toolbar_visible: true };
    const response = { success: true, settings };
    mock.onPut('/api/v1/boards/1/settings').reply(200, { success: true, data: response });
    const result = await updateBoardSettings(1, settings);
    expect(result.settings.ai_enabled).toBe(true);
  });
});

// ─── joinBoardWorkspace ────────────────────────────────────────────────────

describe('joinBoardWorkspace', () => {
  it('zwraca JoinBoardResponse przy sukcesie', async () => {
    const response = {
      success: true, already_member: false, workspace_id: 10,
      board_id: 1, owner_id: 1, is_owner: false, user_role: 'editor',
    };
    mock.onPost('/api/v1/boards/1/join').reply(200, { success: true, data: response });
    const result = await joinBoardWorkspace(1);
    expect(result.success).toBe(true);
    expect(result.user_role).toBe('editor');
  });
});
