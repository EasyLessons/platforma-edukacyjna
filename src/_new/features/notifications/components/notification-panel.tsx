/**
 * NotificationPanel
 *
 * Drawer wysuwany z prawej strony. Pokazuje listę powiadomień
 * z możliwością akceptacji / odrzucenia zaproszeń.
 *
 * Użycie:
 *   {showPanel && <NotificationPanel onClose={() => setShowPanel(false)} />}
 */

'use client';

import { X, Clock, Building, Check, Trash2, Bell } from 'lucide-react';
import { toast } from 'sonner';
import type { Notification, InviteNotification } from '../types';
import { Button } from '@/_new/shared/ui/button';

interface NotificationPanelProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onAccept: (notification: InviteNotification) => Promise<void>;
  onReject: (notification: InviteNotification) => Promise<void>;
  onWorkspacesRefresh: () => Promise<void>;
}

export function NotificationPanel({
  notifications,
  unreadCount,
  loading,
  onClose,
  onMarkAllAsRead,
  onAccept,
  onReject,
  onWorkspacesRefresh,
}: NotificationPanelProps) {
  // HANDLERS

  const handleAccept = async (notification: InviteNotification) => {
    try {
      await onAccept(notification);
      await onWorkspacesRefresh();
      toast.success(`Dołączyłeś do "${notification.payload.workspace_name}"`);
    } catch (error: any) {
      toast.error(error.message || 'Nie udało się zaakceptować zaproszenia');
    }
  };

  const handleReject = async (notification: InviteNotification) => {
    try {
      await onReject(notification);
      toast.success('Zaproszenie odrzucone');
    } catch (error: any) {
      toast.error(error.message || 'Nie udało się odrzucić zaproszenia');
    }
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) return 'przed chwilą';
    if (diffMins < 60) return `${diffMins} min temu`;
    if (diffHours < 24) return `${diffHours} godz. temu`;
    if (diffDays < 7) return `${diffDays} dni temu`;
    return date.toLocaleDateString('pl-PL');
  };

  // RENDER
  return (
    <>
      <div className="fixed inset-0 bg-black/15 backdrop-blur-sm z-[100]" onClick={onClose} />

      <div
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Powiadomienia</h2>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                {unreadCount} {unreadCount === 1 ? 'nieprzeczytane' : 'nieprzeczytanych'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onMarkAllAsRead}
                title="Oznacz wszystkie jako przeczytane"
              >
                <Check size={16} />
              </Button>
            )}
            <Button variant="secondary" size="icon" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Bell size={40} strokeWidth={1.5} />
              <p className="text-sm">Brak powiadomień</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                if (notification.type === 'invite') {
                  const n = notification as InviteNotification;
                  return (
                    <InviteItem
                      key={n.id}
                      notification={n}
                      formatDate={formatDate}
                      onAccept={() => handleAccept(n)}
                      onReject={() => handleReject(n)}
                    />
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// INVITE ITEM
// ================================

interface InviteItemProps {
  notification: InviteNotification;
  formatDate: (iso: string) => string;
  onAccept: () => void;
  onReject: () => void;
}

function InviteItem({ notification, formatDate, onAccept, onReject }: InviteItemProps) {
  const { payload, read } = notification;
 
  return (
    <div className={`px-6 py-4 transition-colors ${read ? 'bg-white' : 'bg-green-50/40'}`}>
      <div className="flex gap-3">
        <div
          className={`flex-shrink-0 w-11 h-11 ${payload.workspace_bg_color} rounded-lg flex items-center justify-center text-white`}
        >
          <Building size={22} />
        </div>
 
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Zaproszenie do workspace
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                <span className="font-medium">{payload.inviter_name}</span> zaprasza Cię
                do <span className="font-medium">{payload.workspace_name}</span>
              </p>
            </div>
            {!read && (
              <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-1.5" />
            )}
          </div>
 
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
            <Clock size={11} />
            <span>{formatDate(notification.received_at)}</span>
          </div>
 
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={onAccept} className="flex-1">
              <Check size={14} className="mr-1" />
              Akceptuj
            </Button>
            <Button variant="secondary" size="sm" onClick={onReject} className="flex-1">
              <Trash2 size={14} className="mr-1" />
              Odrzuć
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
