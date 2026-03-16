'use client';

/**
 * use-notifications.ts
 *
 * Trzyma stan powiadomień, robi initial fetch
 * i subskrybuje Supabase Broadcast.
 *
 * Używany bezpośrednio w DashboardHeader, który przekazuje
 * potrzebne dane jako propsy do NotificationBell i NotificationPanel.
 *
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import {
  fetchPendingInvites,
  acceptInvite,
  rejectInvite,
  PendingInvite,
} from '@/workspace_api/api';
import type { Notification, InvitePayload, InviteNotification } from '../types';

// HELPERS
// ================================

function pendingInviteToNotification(invite: PendingInvite): InviteNotification {
  return {
    id: `invite-${invite.id}`,
    type: 'invite',
    payload: {
      id: invite.id,
      workspace_id: invite.workspace_id,
      workspace_name: invite.workspace_name,
      workspace_icon: invite.workspace_icon,
      workspace_bg_color: invite.workspace_bg_color,
      inviter_name: invite.inviter_name,
      invite_token: invite.invite_token,
      expires_at: invite.expires_at,
      created_at: invite.created_at,
    },
    read: false,
    received_at: invite.created_at,
  };
}

function broadcastPayloadToNotification(payload: InvitePayload): InviteNotification {
  return {
    id: `invite-${payload.id}`,
    type: 'invite',
    payload,
    read: false,
    received_at: new Date().toISOString(),
  };
}

// HOOK
// ================================

export function useNotifications() {
  // STATE
  const { user, isLoggedIn } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Zapobiega duplikatom gdy Broadcast i initial fetch dostarczą ten sam rekord
  const seenIds = useRef<Set<string>>(new Set());

  // INITIAL FETCH
  const loadInitialNotifications = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const invites = await fetchPendingInvites();
      const converted = invites.map(pendingInviteToNotification);
      converted.forEach((n) => seenIds.current.add(n.id));
      setNotifications(converted);
    } catch (error) {
      console.error('useNotifications: błąd initial fetch:', error);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    loadInitialNotifications();
  }, [loadInitialNotifications]);

  // SUPABASE BROADCAST
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;

    const channelName = `notifications:${user.id}`;

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'new_invite' }, ({ payload }) => {
        const notification = broadcastPayloadToNotification(payload as InvitePayload);

        if (seenIds.current.has(notification.id)) return;
        seenIds.current.add(notification.id);

        setNotifications((prev) => [notification, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, user?.id]);

  // HANDLERS
  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    seenIds.current.delete(id);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleAcceptInvite = useCallback(
    async (notification: InviteNotification) => {
      await acceptInvite(notification.payload.invite_token);
      dismiss(notification.id);
    },
    [dismiss]
  );

  const handleRejectInvite = useCallback(
    async (notification: InviteNotification) => {
      await rejectInvite(notification.payload.invite_token);
      dismiss(notification.id);
    },
    [dismiss]
  );

  // RETURN
  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    loading,
    markAsRead,
    markAllAsRead,
    dismiss,
    handleAcceptInvite,
    handleRejectInvite,
  };
}
