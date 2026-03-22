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
import { acceptInvite, rejectInvite } from '../../workspace/api/inviteApi';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../api/notificationApi';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { Notification, InvitePayload, InviteNotification } from '../types';

export function useNotifications() {
  // STATE
  const { user, isLoggedIn } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zapobiega duplikatom gdy Broadcast i initial fetch dostarczą ten sam rekord
  const seenIds = useRef<Set<number>>(new Set());

  const { handleError } = useErrorHandler({ onError: setError });

  // INITIAL FETCH
  const loadInitialNotifications = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { notifications } = await fetchNotifications();
      notifications.forEach((n) => seenIds.current.add(n.id));
      setNotifications(notifications);
    } catch (err) {
      await handleError(err);
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

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('broadcast', { event: 'new_invite' }, ({ payload }) => {
        const p = payload as InvitePayload  & { notification_id: number };

        if (seenIds.current.has(p.notification_id)) return;
        seenIds.current.add(p.notification_id);

        const notification: InviteNotification = {
          id: p.notification_id,
          user_id: user.id!,
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
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await markNotificationAsRead(id);
    } catch (err) {
      // Cofnij optimistic update przy błędzie
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      );
      await handleError(err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      await loadInitialNotifications(); // reload przy błędzie
      await handleError(err);
    }
  }, [loadInitialNotifications]);

  const handleAcceptInvite = useCallback(async (notification: InviteNotification) => {
    await acceptInvite(notification.payload.invite_token);
    try {
      await deleteNotification(notification.id);
    } catch {
      // Best-effort
    }
    dismiss(notification.id);
  }, [dismiss]);

  const handleRejectInvite = useCallback(async (notification: InviteNotification) => {
    await rejectInvite(notification.payload.invite_token);
    try {
      await deleteNotification(notification.id);
    } catch {
      // Best-effort
    }
    dismiss(notification.id);
  }, [dismiss]);

  // RETURN
  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    dismiss,
    handleAcceptInvite,
    handleRejectInvite,
  };
}
