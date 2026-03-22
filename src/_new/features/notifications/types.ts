/**
 * Typy systemu powiadomień.
 *
 * Celowo rozszerzalne — "type" pozwoli w przyszłości dodać
 * 'comment' | 'mention' | 'system' bez refaktoryzacji kontekstu.
 */

export type NotificationType = 'invite';

// PAYLOADS

export interface InvitePayload {
  workspace_id: number;
  workspace_name: string;
  workspace_icon: string;
  workspace_bg_color: string;
  inviter_name: string;
  invite_token: string;
  expires_at: string;
  created_at: string;
}

// Generyczny typ powiadomienia
type PayloadMap = {
  invite: InvitePayload;
  // W przyszłości można dodać inne typy powiadomień
};

// NOTIFICATION
export interface Notification<T extends NotificationType = NotificationType> {
  id: number;
  user_id: number;
  type: T;
  payload: PayloadMap[T];
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

// Pomocnicze typy

export type InviteNotification = Notification<'invite'>;

// API TYPES

export interface NotificationsListResponse {
  notifications: Notification[];
  unread_count: number;
}

export interface ReadAllResponse {
  updated: number;
}
