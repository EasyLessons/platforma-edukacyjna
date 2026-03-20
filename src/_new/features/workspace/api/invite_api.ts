/**
 * invite-api.ts
 *
 * Funkcje do komunikacji z backend/dashboard/workspaces/invite_routes.py
 *
 * Endpointy:
 *   POST   /api/workspaces/{workspace_id}/invite         — wyślij zaproszenie
 *   POST   /api/workspaces/invites/accept/{token}        — akceptuj
 *   DELETE /api/workspaces/invites/{token}               — odrzuć
 *   GET    /api/workspaces/{workspace_id}/members/check/{user_id} — sprawdź status
 */

import { getToken } from '../api/workspace-api';
import { InviteResponse, InviteStatusResponse } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// HELPERS
// ================================

const handleResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {

    const errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || 'Wystąpił błąd');

    throw new Error(errorMessage);
  }
  return data;
};

// API
// ================================

// Wysyła zaproszenie do workspace'a
export const createInvite = async (
  workspaceId:   number,
  invitedUserId: number,
): Promise<InviteResponse> => {
  const token = getToken();
  if (!token) throw new Error('Musisz być zalogowany');
 
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/invite`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        invited_user_id: invitedUserId, 
        workspace_id: workspaceId,
      }),
    },
  );
 
  return handleResponse(response);
};

// Akceptuje zaproszenie po tokenie
export const acceptInvite = async (inviteToken: string): Promise<{
  message:        string;
  workspace_id:   number;
  workspace_name: string;
  role:           string;
}> => {
  const token = getToken();
  if (!token) throw new Error('Musisz być zalogowany');
 
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/invites/accept/${inviteToken}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
 
  return handleResponse(response);
};

// Odrzuca zaproszenie po tokenie
export const rejectInvite = async (inviteToken: string): Promise<{ message: string }> => {
  const token = getToken();
  if (!token) throw new Error('Musisz być zalogowany');
 
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/invites/${inviteToken}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
 
  return handleResponse(response);
};

// Sprawdza, czy user jest członkiem lub ma aktywne zaproszenie
export const checkUserInviteStatus = async (
  workspaceId: number,
  userId:      number,
): Promise<InviteStatusResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/members/check/${userId}`,
  );
 
  return handleResponse(response);
};
