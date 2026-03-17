/**
 * notifications-api.ts
 *
 * Funkcje do komunikacji z backend/dashboard/notifications/routes.py
 *
 * Funkcje:
 *
 */

import { getToken } from '@/auth_api/api';
import { Notification, NotificationsListResponse } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// HELPERS
// ================================

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error('Musisz być zalogowany');

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// API FUNCTIONS
// ================================

/**
 * Pobiera powiadomienia zalogowanego usera.
 * 
 * @args None
 * @returns Lista powiadomień.
 */
export async function fetchNotifications(): Promise<NotificationsListResponse> {
  const res = await authFetch('/api/notifications');
  return handleResponse<NotificationsListResponse>(res);
}

/**
 * Oznacza powiadomienie jako przeczytane.
 * 
 * @args id - ID powiadomienia do oznaczenia jako przeczytane.
 * @returns Zaktualizowane powiadomienie.
 */
export async function markNotificationAsRead(id: number): Promise<Notification> {
  const res = await authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  return handleResponse<Notification>(res);
}

/**
 * Oznacza wszystkie powiadomienia jako przeczytane.
 * 
 * @args None
 * @returns Promise<void>
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const res = await authFetch('/api/notifications/read-all', { method: 'PATCH' });
  return handleResponse<void>(res);
}

/**
 * Usuwa powiadomienie.
 * 
 * @args id - ID powiadomienia do usunięcia.
 * @returns Promise<void>
 */
export async function deleteNotification(id: number): Promise<void> {
  const res = await authFetch(`/api/notifications/${id}`, { method: 'DELETE' });
  return handleResponse<void>(res);
}
