'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Search, 
  Bell, 
  Gift, 
  Crown, 
  UserPlus,
  ChevronDown
} from 'lucide-react';

// Import popupów
import InvitePopup from './popups/InvitePopup';
import GiftPopup from './popups/GiftPopup';
import NotificationsPopup from './popups/NotificationsPopup';
import UserMenuPopup from './popups/UserMenuPopup';

export default function DashboardHeader() {
  const router = useRouter();
  
  // State dla popupów
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [showGiftPopup, setShowGiftPopup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Dane użytkownika (później z API)
  const user = {
    name: "Mateusz",
    email: "mateusz@easylesson.com",
    avatar: "M",
    isPremium: false
  };

  // Nazwa aktualnej przestrzeni (później dynamicznie)
  const currentSpace = "Klasa 5A";

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="w-full px-6 py-3">
          <div className="grid grid-cols-3 gap-4 items-center">
            
            {/* LEWA STRONA - Logo + Badge */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center cursor-pointer">
                <Image
                  src="/resources/LogoEasyLesson.webp"
                  alt="EasyLesson Logo"
                  width={140}
                  height={36}
                  className="h-9 w-auto"
                  priority
                />
              </Link>
              
              {/* Badge Free */}
              {!user.isPremium && (
                <div className="px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg">
                  FREE PLAN
                </div>
              )}
            </div>

            {/* ŚRODEK - SMART SEARCH */}
            <div className="flex justify-center">
              <button
                className="w-full max-w-md px-4 py-2.5 bg-white border-2 border-gray-200 hover:border-green-400 rounded-xl transition-all duration-200 flex items-center gap-3 group cursor-pointer hover:shadow-md"
              >
                <Search size={18} className="text-gray-400 group-hover:text-green-600 transition-colors" />
                
                <span className="flex-1 text-left text-sm text-gray-500 group-hover:text-gray-700 font-medium">
                  Wyszukaj wszystko...
                </span>
                
                <div className="flex items-center gap-1 opacity-60">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs text-gray-500 font-mono">
                    ⌘K
                  </kbd>
                </div>
              </button>
            </div>

            {/* PRAWA STRONA - Przyciski i ikony */}
            <div className="flex items-center justify-end gap-2">
              
              {/* Zaproś uczestników */}
              <button
                onClick={() => setShowInvitePopup(true)}
                className="px-4 py-2 text-gray-700 text-sm font-medium hover:bg-gray-50 border border-gray-200 rounded-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer hover:border-gray-300"
              >
                <UserPlus size={16} />
                <span>Zaproś uczestników</span>
              </button>

              {/* Premium Button */}
              {!user.isPremium && (
                <Link href="/#pricing">
                  <button className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 whitespace-nowrap cursor-pointer">
                    <Crown size={16} />
                    <span>Premium</span>
                  </button>
                </Link>
              )}

              {/* Separator */}
              <div className="w-px h-6 bg-gray-200 mx-1"></div>
              
              {/* Ikonka Prezentu */}
              <div className="relative">
                <button
                  onClick={() => setShowGiftPopup(true)}
                  className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 relative group cursor-pointer"
                  title="Dostań 10% zniżki"
                >
                  <Gift size={20} />
                  
                  {/* Tooltip */}
                  <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                    Dostań 10% zniżki
                  </div>
                </button>
              </div>

              {/* Dzwonek */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 relative cursor-pointer"
                >
                  <Bell size={20} />
                  
                  {/* Badge powiadomień */}
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                </button>
              </div>

              {/* Avatar */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-all duration-200 cursor-pointer"
                >
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center shadow-sm">
                    <span className="text-white font-semibold text-sm">
                      {user.avatar}
                    </span>
                  </div>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>

                {/* User Menu Popup */}
                {showUserMenu && (
                  <UserMenuPopup 
                    onClose={() => setShowUserMenu(false)} 
                    user={user}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* POPUPY */}
      {showInvitePopup && (
        <InvitePopup 
          onClose={() => setShowInvitePopup(false)}
          spaceName={currentSpace}
        />
      )}

      {showGiftPopup && (
        <GiftPopup onClose={() => setShowGiftPopup(false)} />
      )}

      {showNotifications && (
        <NotificationsPopup onClose={() => setShowNotifications(false)} />
      )}
    </>
  );
}