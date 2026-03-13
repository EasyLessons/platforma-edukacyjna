'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { User, Settings, Crown, LogOut } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardButton } from '@/app/dashboard/Components/DashboardButton';

interface UserMenuPopupProps {
  onClose: () => void;
  user: {
    name: string;
    email: string;
    avatar: string;
    avatarColorClass?: string;
    isPremium: boolean;
  };
}

export default function UserMenuPopup({ onClose, user }: UserMenuPopupProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const popupRef = useRef<HTMLDivElement>(null);

  // Zamknij popup gdy klikniemy poza nim
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  const handleLogout = () => {
    logout();
    onClose();
    router.push('/');
  };

  return (
    <div
      ref={popupRef}
      className="dashboard-popup-surface absolute right-0 z-50 mt-2 w-64 overflow-hidden"
    >
      {/* Info użytkownika */}
      <div className="border-b border-[var(--dash-border)] bg-[var(--dash-panel)] px-4 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm ${user.avatarColorClass || 'bg-gray-700'}`}
          >
            <span className="text-white font-semibold text-base">{user.avatar}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-800 text-sm truncate">{user.name}</div>
            <div className="text-xs text-gray-500 truncate">{user.email}</div>
          </div>
        </div>

        {/* Badge Premium lub Free */}
        <div className="mt-3">
          {user.isPremium ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-white px-2.5 py-1">
              <Crown size={14} className="text-yellow-600" />
              <span className="text-xs font-semibold text-yellow-700">Premium</span>
            </div>
          ) : (
            <div className="inline-flex items-center rounded-lg border border-[var(--dash-border)] bg-white px-2.5 py-1">
              <span className="text-xs font-semibold text-gray-700">FREE</span>
            </div>
          )}
        </div>
      </div>

      {/* Menu opcje */}
      <div className="space-y-1.5 p-2">
        <DashboardButton
          variant="secondary"
          leftIcon={<User size={16} />}
          onClick={() => handleNavigation('/clientPanel')}
          className="w-full justify-start"
        >
          Profil
        </DashboardButton>

        {!user.isPremium && (
          <DashboardButton
            variant="secondary"
            leftIcon={<Crown size={16} />}
            onClick={() => handleNavigation('/#pricing')}
            className="w-full justify-start"
          >
            Przejdź na Premium
          </DashboardButton>
        )}

        <div className="my-2 border-t border-[var(--dash-border)]"></div>

        {/* Wyloguj */}
        <DashboardButton
          variant="primary"
          leftIcon={<LogOut size={16} />}
          onClick={handleLogout}
          className="w-full justify-center"
        >
          Wyloguj się
        </DashboardButton>
      </div>
    </div>
  );
}
