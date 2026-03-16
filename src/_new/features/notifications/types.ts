/**
 * Typy systemu powiadomień.
 *
 * Celowo rozszerzalne — "type" pozwoli w przyszłości dodać
 * 'comment' | 'mention' | 'system' bez refaktoryzacji kontekstu.
 */

export type NotificationType = 'invite';

// Payload dla zaproszenia do workspace
export interface InvitePayload {
  id: number;
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

export interface Notification<T extends NotificationType = NotificationType> {
  id: string
  type: T
  payload: PayloadMap[T]
  read: boolean
  received_at: string
}

// Pomocnicze typy

export type InviteNotification = Notification<'invite'>;
