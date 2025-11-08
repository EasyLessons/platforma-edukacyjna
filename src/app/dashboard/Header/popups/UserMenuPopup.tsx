'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Settings, Crown, LogOut } from 'lucide-react';
// 🔥 DODAJ TEN IMPORT - 3 poziomy w górę do app/, potem context/
import { useAuth } from '../../../context/AuthContext';

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
    <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
      
      {/* Info użytkownika */}
      <div className="px-4 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-green-600 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold text-base">
              {user.avatar}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-800 text-sm truncate">
              {user.name}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {user.email}
            </div>
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
        <button
          onClick={() => handleNavigation('/dashboard/profile')}
          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors cursor-pointer group"
        >
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-green-100 transition-colors">
            <User size={16} className="text-gray-600 group-hover:text-green-600" />
          </div>
          <span className="text-gray-700 font-medium text-sm">Profil</span>
        </button>
        
        <button
          onClick={() => handleNavigation('/dashboard/settings')}
          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors cursor-pointer group"
        >
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
            <Settings size={16} className="text-gray-600" />
          </div>
          <span className="text-gray-700 font-medium text-sm">Ustawienia</span>
        </button>

        {/* Przejdź na Premium */}
        {!user.isPremium && (
          <>
            <div className="my-2 border-t border-gray-100"></div>
            <Link href="/#pricing">
              <button
                onClick={onClose}
                className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 flex items-center gap-3 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
                  <Crown size={16} className="text-yellow-600" />
                </div>
                <div className="flex-1">
                  <div className="text-yellow-700 font-semibold text-sm">
                    Przejdź na Premium
                  </div>
                  <div className="text-xs text-yellow-600">
                    Więcej funkcji
                  </div>
                </div>
              </button>
            </Link>
          </>
        )}

        <div className="my-2 border-t border-gray-100"></div>
        
        {/* Wyloguj */}
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-3 transition-colors cursor-pointer group"
        >
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
            <LogOut size={16} className="text-red-600" />
          </div>
          <span className="text-red-600 font-medium text-sm">Wyloguj się</span>
        </button>
      </div>
    </div>
  );
}