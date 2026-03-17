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
import { DashboardButton } from '@/app/dashboard/Components/DashboardButton';
import { useState } from 'react';

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
  const [processingId, setProcessingId] = useState<number | null>(null);

  // HANDLERS

  const handleAccept = async (notification: InviteNotification) => {
    try {
      setProcessingId(notification.id);
      await onAccept(notification);
      await onWorkspacesRefresh();
      toast.success(`Dołączyłeś do "${notification.payload.workspace_name}"`);
    } catch (error: any) {
      toast.error(error.message || 'Nie udało się zaakceptować zaproszenia');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (notification: InviteNotification) => {
    try {
      setProcessingId(notification.id);
      await onReject(notification);
      toast.success('Zaproszenie odrzucone');
    } catch (error: any) {
      toast.error(error.message || 'Nie udało się odrzucić zaproszenia');
    } finally {
      setProcessingId(null);
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
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                if (notification.type === 'invite') {
                  const n = notification as InviteNotification;
                  return (
                    <InviteItem
                      key={`${n.type}-${n.id}`}
                      notification={n}
                      processing={processingId === n.id}
                      formatDate={formatDate}
                      onAccept={() => handleAccept(n)}
                      onReject={() => handleReject(n)}
                    />
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Brak zaproszeń</h3>
              <p className="text-sm text-gray-500">
                Nie masz żadnych oczekujących zaproszeń do workspace'ów
              </p>
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
  processing: boolean;
  formatDate: (iso: string) => string;
  onAccept: () => void;
  onReject: () => void;
}

function InviteItem({ notification, processing, formatDate, onAccept, onReject }: InviteItemProps) {
  const { payload, is_read } = notification;
 
  return (
    <div className={`px-6 py-4 transition-colors hover:bg-[var(--dash-panel)] ${!is_read ? 'bg-green-50/30' : ''}`}>
      <div className="flex gap-3">
        <div
          className={`flex-shrink-0 w-12 h-12 ${payload.workspace_bg_color} rounded-lg flex items-center justify-center text-white`}
        >
          <Building size={24} />
        </div>
 
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm mb-1">
                Zaproszenie do workspace
              </h3>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{payload.inviter_name}</span> zaprasza Cię
                do <span className="font-medium">{payload.workspace_name}</span>
              </p>
            </div>
            {!is_read && (
              <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-1.5" />
            )}
          </div>
 
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
            <Clock size={12} />
            <span>{formatDate(notification.created_at)}</span>
          </div>
 
          <div className="flex gap-2">
            <DashboardButton
              variant="primary"
              onClick={onAccept}
              disabled={processing}
              className="flex-1"
            >
              {processing ? 'Akceptuję...' : 'Akceptuj'}
            </DashboardButton>
            <DashboardButton
              variant="secondary"
              onClick={onReject}
              disabled={processing}
              className="flex-1"
            >
              Odrzuć
            </DashboardButton>
          </div>
        </div>
      </div>
    </div>
  );
}
