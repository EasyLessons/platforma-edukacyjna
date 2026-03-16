/**
 * NotificationBell
 *
 * Przycisk dzwonka w headerze. Czyta unreadCount z kontekstu
 * i pokazuje czerwony badge gdy są nieprzeczytane powiadomienia.
 *
 * Użycie:
 *   <NotificationBell onClick={() => setShowPanel(true)} />
 */

'use client';
 
import { Bell } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
 
interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
}
 
export function NotificationBell({ unreadCount, onClick }: NotificationBellProps) {
  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="iconSm"
        onClick={onClick}
        title="Powiadomienia"
        className="dashboard-btn-secondary rounded-full"
      >
        <Bell size={16} />
      </Button>
 
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center pointer-events-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  );
}
