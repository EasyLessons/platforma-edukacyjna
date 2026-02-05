'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { User, Settings, Crown, LogOut } from 'lucide-react';
// 🔥 DODAJ TEN IMPORT - 3 poziomy w górę do app/, potem context/
import { useAuth } from '../../../context/AuthContext';
import { Button } from '@/_new/shared/ui/button';

interface UserMenuPopupProps {
  onClose: () => void;
  user: {
    name: string;
    email: string;
    avatar: string;
    isPremium: boolean;
  };
}

export default function UserMenuPopup({ onClose, user }: UserMenuPopupProps) {
  const router = useRouter();
  // 🔥 DODAJ TO - pobierz funkcję logout z contextu
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

  // 🔥 POPRAWIONY LOGOUT - tak jak w AuthHeader
  const handleLogout = () => {
    console.log('🚪 Wylogowywanie...');
    logout(); // ✅ Używa prawdziwego logout z AuthContext
    console.log('✅ Wylogowano!');
    onClose(); // Zamknij popup
    router.push('/'); // Przekieruj na stronę główną
  };

  return (
    <div
      ref={popupRef}
      className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
    >
      {/* Info użytkownika */}
      <div className="px-4 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-green-600 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold text-base">{user.avatar}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-800 text-sm truncate">{user.name}</div>
            <div className="text-xs text-gray-500 truncate">{user.email}</div>
          </div>
        </div>

        {/* Badge Premium lub Free */}
        <div className="mt-3">
          {user.isPremium ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
              <Crown size={14} className="text-yellow-600" />
              <span className="text-xs font-semibold text-yellow-700">Premium</span>
            </div>
          ) : (
            <div className="inline-flex items-center px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg">
              <span className="text-xs font-semibold text-gray-600">FREE</span>
            </div>
          )}
        </div>
      </div>

      {/* Menu opcje */}
      <div className="py-2">
        <Button
          variant="secondary"
          leftIcon={<User size={16} />}
          onClick={() => handleNavigation('/clientPanel')}
          className="w-full justify-start rounded-sm"
        >
          Profil
        </Button>

        {!user.isPremium && (
              <Button
                variant="secondary"
                leftIcon={<Crown size={16} />}
                onClick={() => handleNavigation('/#pricing')}
                className="w-full justify-start bg-yellow-100 py-7 hover:bg-yellow-200 text-yellow-800 rounded-sm"
              >
              Przejdź na Premium
              </Button>
        )}

        <div className="my-2 border-t border-gray-100"></div>

        {/* Wyloguj */}
        <Button
          variant="destructive"
          leftIcon={<LogOut size={16} />}
          onClick={handleLogout}
          className="w-full justify-center rounded-sm">
          Wyloguj się
        </Button>
      </div>
    </div>
  );
}
