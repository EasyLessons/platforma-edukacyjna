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

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { acceptInvite, rejectInvite } from '../../workspace/api/invite_api';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../api/notification-api';
import type { Notification, InvitePayload, InviteNotification } from '../types';

export function useNotifications() {
  // STATE
  const { user, isLoggedIn } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Zapobiega duplikatom gdy Broadcast i initial fetch dostarczą ten sam rekord
  const seenIds = useRef<Set<number>>(new Set());

  // INITIAL FETCH
  const loadInitialNotifications = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { notifications } = await fetchNotifications();
      notifications.forEach((n) => seenIds.current.add(n.id));
      setNotifications(notifications);
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
        const p = payload as InvitePayload;

        if (seenIds.current.has(p.id)) return;
        seenIds.current.add(p.id);

        const notification: InviteNotification = {
          id: p.id,
          type: 'invite',
          payload: p,
          is_read: false,
          created_at: new Date().toISOString(),
          read_at: null,
        };

        setNotifications((prev) => [notification, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, user?.id]);

  // HANDLERS
  const dismiss = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    seenIds.current.delete(id);
  }, []);

  const markAsRead = useCallback(async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await markNotificationAsRead(id).catch((e) =>
      console.error('useNotifications: błąd markAsRead:', e)
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsAsRead().catch((e) =>
      console.error('useNotifications: błąd markAllAsRead:', e)
    );
  }, []);

  const handleAcceptInvite = useCallback(async (notification: InviteNotification) => {
    await acceptInvite(notification.payload.invite_token);
    await deleteNotification(notification.id).catch((e) =>
      console.error('useNotifications: błąd deleteNotification:', e)
    );
    dismiss(notification.id);
  }, [dismiss]);

  const handleRejectInvite = useCallback(
    async (notification: InviteNotification) => {
      await rejectInvite(notification.payload.invite_token);
      await deleteNotification(notification.id).catch((e) =>
        console.error('useNotifications: błąd deleteNotification:', e)
      );
      dismiss(notification.id);
    },
    [dismiss]
  );

  // RETURN
  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
    loading,
    markAsRead,
    markAllAsRead,
    dismiss,
    handleAcceptInvite,
    handleRejectInvite,
  };
}
