'use client';

import { X, Check, Clock, AlertCircle, Info } from 'lucide-react';

interface NotificationsPopupProps {
  onClose: () => void;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export default function NotificationsPopup({ onClose }: NotificationsPopupProps) {
  const notifications: Notification[] = [
    {
      id: '1',
      type: 'success',
      title: 'Lekcja zapisana',
      message: 'Twoja lekcja "Matematyka - Równania" została zapisana pomyślnie.',
      time: '5 min temu',
      read: false
    },
    {
      id: '2',
      type: 'info',
      title: 'Nowy uczeń dołączył',
      message: 'Jan Kowalski dołączył do przestrzeni "Klasa 5A".',
      time: '2 godz. temu',
      read: false
    },
    {
      id: '3',
      type: 'warning',
      title: 'Limit zbliża się do końca',
      message: 'Zostało Ci 5 darmowych lekcji w tym miesiącu.',
      time: 'wczoraj',
      read: true
    }
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Check size={20} className="text-green-600" />;
      case 'warning':
        return <AlertCircle size={20} className="text-yellow-600" />;
      default:
        return <Info size={20} className="text-blue-600" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100';
      case 'warning':
        return 'bg-yellow-100';
      default:
        return 'bg-blue-100';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/15 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />

      {/* Panel wysuwany z prawej */}
      <div 
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[101] overflow-hidden flex flex-col animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Powiadomienia
            </h2>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600 mt-0.5">
                Masz {unreadCount} {unreadCount === 1 ? 'nowe' : 'nowych'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Lista powiadomień */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-green-50/30' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Ikona */}
                    <div className={`flex-shrink-0 w-10 h-10 ${getIconBg(notification.type)} rounded-lg flex items-center justify-center`}>
                      {getIcon(notification.type)}
                    </div>

                    {/* Treść */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800 text-sm">
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-1.5"></span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={12} />
                        <span>{notification.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Brak powiadomień
              </h3>
              <p className="text-sm text-gray-500">
                Wszystkie powiadomienia są przeczytane
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            className="w-full px-4 py-2 text-sm text-green-600 font-medium hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
          >
            Oznacz wszystkie jako przeczytane
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}