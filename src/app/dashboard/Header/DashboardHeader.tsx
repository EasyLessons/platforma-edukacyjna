'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search,
  Bell,
  Gift,
  Crown,
  UserPlus,
  ChevronDown,
  Menu,
  X,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

// Import funkcji API
import { getUser, isAuthenticated, type User } from '@/auth_api/api';
import { fetchPendingInvites } from '@/workspace_api/api';
import { useAuth } from '@/app/context/AuthContext';

// Import popupów
import InvitePopup from './popups/InvitePopup';
import GiftPopup from './popups/GiftPopup';
import NotificationsPopup from './popups/NotificationsPopup';
import UserMenuPopup from './popups/UserMenuPopup';

import { useWorkspaces } from '@/app/context/WorkspaceContext';
import { Button } from '@/_new/shared/ui/button';

// Rozszerzony typ User z dodatkowymi polami dla UI
interface ExtendedUser extends User {
  name: string;
  avatar: string;
  isPremium: boolean;
}

export default function DashboardHeader() {
  const router = useRouter();
  const { logout } = useAuth();

  // State dla popupów
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [showGiftPopup, setShowGiftPopup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);

  // State dla danych użytkownika
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentWorkspace, setCurrentWorkspace] = useState<any>(null);
  const { activeWorkspace } = useWorkspaces();

  // Pobieranie danych użytkownika
  useEffect(() => {
    const fetchUser = () => {
      try {
        // Sprawdź czy użytkownik jest zalogowany
        if (!isAuthenticated()) {
          router.push('/login');
          return;
        }

        // Pobierz dane użytkownika z localStorage
        const userData = getUser();

        if (!userData) {
          router.push('/login');
          return;
        }

        // Rozszerz dane użytkownika o dodatkowe pola
        setUser({
          ...userData,
          name: userData.full_name || userData.username,
          avatar: userData.username?.charAt(0).toUpperCase() || 'U',
          isPremium: false, // Tutaj później sprawdzisz czy ma premium
        });
      } catch (error) {
        console.error('Błąd pobierania danych użytkownika:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  // Pobieranie liczby zaproszeń co 30 sekund
  useEffect(() => {
    const loadInviteCount = async () => {
      try {
        console.log('🔍 DashboardHeader: Pobieram zaproszenia...');
        const token = localStorage.getItem('access_token');
        console.log('🔍 DashboardHeader: Token w localStorage:', token ? '✅ Jest' : '❌ Brak');
        
        const invites = await fetchPendingInvites();
        setInviteCount(invites.length);
        console.log('✅ DashboardHeader: Zaproszenia pobrane:', invites.length);
      } catch (error) {
        console.error('❌ DashboardHeader: Błąd pobierania zaproszeń:', error);
        // Nie pokazuj błędu użytkownikowi - może być niezalogowany podczas przekierowania
      }
    };

    // Opóźnienie 500ms przed pierwszym request (daj czas na załadowanie tokenu)
    setTimeout(loadInviteCount, 500);
    
    const interval = setInterval(loadInviteCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Ustawienie crurrentWorkspace
  useEffect(() => {
    if (activeWorkspace) {
      setCurrentWorkspace(activeWorkspace);
    }
  }, [activeWorkspace]);

  // Nazwa aktualnej przestrzeni (później dynamicznie)
  const currentSpace = 'Klasa 5A';

  // Loading state
  if (loading) {
    return (
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="w-full px-4 lg:px-6 py-3">
          {/* DESKTOP LOADING */}
          <div className="hidden min-[1550px]:grid grid-cols-3 gap-4 items-center">
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
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-md h-10 bg-gray-100 animate-pulse rounded-xl"></div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <div className="w-8 h-8 bg-gray-200 animate-pulse rounded-lg"></div>
            </div>
          </div>

          {/* MOBILE LOADING */}
          <div className="min-[1550px]:hidden flex items-center justify-between">
            <Link href="/" className="flex items-center cursor-pointer">
              <Image
                src="/resources/LogoEasyLesson.webp"
                alt="EasyLesson Logo"
                width={120}
                height={31}
                className="h-8 w-auto"
                priority
              />
            </Link>
            <div className="w-6 h-6 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="w-full px-4 lg:px-6 py-3">
          {/* DESKTOP VERSION */}
          <div className="hidden min-[1550px]:grid grid-cols-3 gap-4 items-center">
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
              {user && !user.isPremium && (
                <div className="px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg">
                  FREE PLAN
                </div>
              )}
            </div>

            {/* ŚRODEK - SMART SEARCH */}
            <div className="flex justify-center">
              <button className="w-full max-w-md px-4 py-2.5 bg-white border-2 border-gray-200 hover:border-green-400 rounded-xl transition-all duration-200 flex items-center gap-3 group cursor-pointer hover:shadow-md">
                <Search
                  size={18}
                  className="text-gray-400 group-hover:text-green-600 transition-colors"
                />

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
              <Button
                variant="secondary"
                leftIcon={<UserPlus size={16} />}
                onClick={() => {
                  if (currentWorkspace) {
                    setShowInvitePopup(true);
                  } else {
                    alert('Najpierw wybierz workspace');
                  }
                }}
                className="border-2 border-gray-200"
              >
                Zaproś uczestników
              </Button>

              {/* Premium Button */}
              {user && !user.isPremium && (
                <Link href="/#pricing">
                  <Button variant="primary" leftIcon={<Crown size={16} />}>
                    Premium
                  </Button>
                </Link>
              )}

              {/* Separator */}
              <div className="w-px h-6 bg-gray-200 mx-1"></div>

              {/* Ikonka Prezentu */}

              <Button
                variant="secondary"
                onClick={() => setShowGiftPopup(true)}
                title="Dostań 10% zniżki"
              >
                <Gift size={20} />
              </Button>

              {/* Dzwonek */}
              <div className="relative">
                <Button
                  variant="secondary"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <Bell size={20} />
                </Button>
                {inviteCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {inviteCount > 9 ? '9+' : inviteCount}
                  </span>
                )}
              </div>

              {/* Avatar */}
              {user && (
                <div className="relative">
                  <Button
                    variant="primary"
                    size="icon"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                  >
                    <span>{user.avatar}</span>
                  </Button>

                  {/* User Menu Popup */}
                  {showUserMenu && (
                    <UserMenuPopup onClose={() => setShowUserMenu(false)} user={user} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MOBILE VERSION */}
          <div className="min-[1550px]:hidden flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center cursor-pointer">
              <Image
                src="/resources/LogoEasyLesson.webp"
                alt="EasyLesson Logo"
                width={120}
                height={31}
                className="h-8 w-auto"
                priority
              />
            </Link>

            {/* Hamburger Menu */}
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              <Menu size={24} />
            </Button>
          </div>

          {/* MOBILE MENU DRAWER */}
          {showMobileMenu && (
            <>
              {/* Drawer */}
              <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200">
                {/* Header drawera */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
                  <span className="font-semibold text-gray-800">Menu</span>
                  <Button variant="secondary" size="icon" onClick={() => setShowMobileMenu(false)}>
                    <X size={20} />
                  </Button>
                </div>

                <div className="p-4 space-y-3">
                  {/* User Info Mobile */}
                  {user && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-white font-semibold text-base">{user.avatar}</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  )}

                  {/* Menu Items Mobile */}
                  <div className="space-y-2">
                    <Button
                      variant="secondary"
                      leftIcon={<UserPlus size={20} />}
                      onClick={() => {
                        if (currentWorkspace) {
                          setShowInvitePopup(true);
                          setShowMobileMenu(false);
                        } else {
                          alert('Najpierw wybierz workspace');
                        }
                      }}
                      className="w-full justify-start py-8"
                    >
                      Zaproś uczestników
                    </Button>

                    {/* Premium Mobile */}
                    {user && !user.isPremium && (
                      <Link href="/#pricing">
                        <Button
                          variant="secondary"
                          leftIcon={<Crown size={20} />}
                          onClick={() => setShowMobileMenu(false)}
                          className="w-full justify-start bg-green-50 text-green-700 py-8"
                        >
                          Przejdź na Premium
                        </Button>
                      </Link>
                    )}

                    {/* Powiadomienia */}
                    <Button
                      variant="secondary"
                      leftIcon={<Bell size={20} />}
                      onClick={() => {
                        setShowNotifications(true);
                        setShowMobileMenu(false);
                      }}
                      className="w-full justify-start py-8"
                    >
                      <span>Powiadomienia</span>
                      {inviteCount > 0 && (
                        <span className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {inviteCount > 9 ? '9+' : inviteCount}
                        </span>
                      )}
                    </Button>

                    <Button
                      variant="secondary"
                      leftIcon={<UserIcon size={20} />}
                      onClick={() => {
                        router.push('/clientPanel');
                        setShowMobileMenu(false);
                      }}
                      className="w-full justify-start py-8"
                    >
                      Profil
                    </Button>

                    {/* Separator */}
                    <div className="border-t border-gray-200 my-2"></div>

                    {/* Wyloguj */}
                    <Button
                      variant="destructive"
                      leftIcon={<LogOut size={20} />}
                      onClick={() => {
                        logout();
                        setShowMobileMenu(false);
                        router.push('/');
                      }}
                      className="w-full py-8"
                    >
                      Wyloguj się
                    </Button>
                  </div>

                  {/* Badge Free Mobile */}
                  {user && !user.isPremium && (
                    <div className="mt-4 px-4">
                      <div className="px-3 py-2 bg-gray-100 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg text-center">
                        FREE PLAN
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* POPUPY */}
      {showInvitePopup && currentWorkspace && (
        <InvitePopup
          onClose={() => setShowInvitePopup(false)}
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
        />
      )}

      {showGiftPopup && <GiftPopup onClose={() => setShowGiftPopup(false)} />}

      {showNotifications && <NotificationsPopup onClose={() => setShowNotifications(false)} />}
    </>
  );
}
