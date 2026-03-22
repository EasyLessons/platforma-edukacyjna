/**
 * notifications-api.ts
 *
 * Funkcje do komunikacji z backend/dashboard/notifications/routes.py
 *
 * Funkcje:
 *
 */
import { apiClient } from '@/_new/lib/api';
import { Notification, NotificationsListResponse, ReadAllResponse } from '../types';

export const fetchNotifications = (): Promise<NotificationsListResponse> =>
  apiClient.get<NotificationsListResponse>('/api/v1/notifications').then(res => res.data);
 
export const markNotificationAsRead = (id: number): Promise<Notification> =>
  apiClient.patch<Notification>(`/api/v1/notifications/${id}/read`).then(res => res.data);

export const markAllNotificationsAsRead = (): Promise<ReadAllResponse> =>
  apiClient.patch<ReadAllResponse>('/api/v1/notifications/read-all').then(res => res.data)

export const deleteNotification = (id: number): Promise<void> =>
  apiClient.delete(`/api/v1/notifications/${id}`).then(() => undefined);
