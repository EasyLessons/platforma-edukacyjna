import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@new/lib/api/client';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from './notificationApi';
import { AppError } from '@new/lib/errors/AppError';
import { mockNotification, mockNotificationsListResponse } from '@/test/mocks/fixtures';

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

// ─── fetchNotifications ────────────────────────────────────────────────────

describe('fetchNotifications', () => {
  it('zwraca listę powiadomień przy sukcesie', async () => {
    mock.onGet('/api/v1/notifications').reply(200, {
      success: true,
      data: mockNotificationsListResponse,
    });
    const result = await fetchNotifications();
    expect(result.notifications).toHaveLength(1);
    expect(result.unread_count).toBe(1);
    expect(result.notifications[0].id).toBe(1);
  });

  it('zwraca pustą listę gdy brak powiadomień', async () => {
    mock.onGet('/api/v1/notifications').reply(200, {
      success: true,
      data: { notifications: [], unread_count: 0 },
    });
    const result = await fetchNotifications();
    expect(result.notifications).toHaveLength(0);
    expect(result.unread_count).toBe(0);
  });

  it('rzuca AppError przy błędzie serwera', async () => {
    mock.onGet('/api/v1/notifications').reply(500, { success: false, error: 'Błąd serwera' });
    await expect(fetchNotifications()).rejects.toBeInstanceOf(AppError);
  });
});

// ─── markNotificationAsRead ────────────────────────────────────────────────

describe('markNotificationAsRead', () => {
  it('zwraca zaktualizowane powiadomienie z is_read=true', async () => {
    const readNotification = { ...mockNotification, is_read: true, read_at: '2024-06-01T13:00:00Z' };
    mock.onPatch('/api/v1/notifications/1/read').reply(200, {
      success: true,
      data: readNotification,
    });
    const result = await markNotificationAsRead(1);
    expect(result.is_read).toBe(true);
    expect(result.read_at).not.toBeNull();
  });

  it('rzuca AppError przy 404', async () => {
    mock.onPatch('/api/v1/notifications/99/read').reply(404, {
      success: false,
      error: 'Nie znaleziono',
    });
    await expect(markNotificationAsRead(99)).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isNotFound()
    );
  });
});

// ─── markAllNotificationsAsRead ────────────────────────────────────────────

describe('markAllNotificationsAsRead', () => {
  it('zwraca liczbę zaktualizowanych powiadomień', async () => {
    mock.onPatch('/api/v1/notifications/read-all').reply(200, {
      success: true,
      data: { updated: 3 },
    });
    const result = await markAllNotificationsAsRead();
    expect(result.updated).toBe(3);
  });

  it('zwraca updated=0 gdy nie ma nieprzeczytanych', async () => {
    mock.onPatch('/api/v1/notifications/read-all').reply(200, {
      success: true,
      data: { updated: 0 },
    });
    const result = await markAllNotificationsAsRead();
    expect(result.updated).toBe(0);
  });
});

// ─── deleteNotification ────────────────────────────────────────────────────

describe('deleteNotification', () => {
  it('kończy się bez błędu przy sukcesie', async () => {
    mock.onDelete('/api/v1/notifications/1').reply(200, { success: true, data: null });
    await expect(deleteNotification(1)).resolves.toBeUndefined();
  });

  it('rzuca AppError przy 404', async () => {
    mock.onDelete('/api/v1/notifications/99').reply(404, {
      success: false,
      error: 'Nie znaleziono',
    });
    await expect(deleteNotification(99)).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.isNotFound()
    );
  });
});
