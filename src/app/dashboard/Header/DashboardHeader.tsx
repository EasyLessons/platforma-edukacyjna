'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Bell, Gift, Crown, Settings, Menu, X, LogOut, User as UserIcon } from 'lucide-react';

import { useAuth } from '@/app/context/AuthContext';
import { useNotifications } from '@/_new/features/notifications/hooks/useNotifications';

import GiftPopup from './popups/GiftPopup';
import UserMenuPopup from './popups/UserMenuPopup';
import { NotificationBell } from '@/_new/features/notifications/components/notification-bell';
import { NotificationPanel } from '@/_new/features/notifications/components/notification-panel';

import { Button } from '@/_new/shared/ui/button';
import { DashboardButton } from '../Components/DashboardButton';
import { useUserAvatar } from '@/_new/shared/hooks/use-user-avatar';

import type { User } from '@/_new/shared/types/user';

// Rozszerzony typ User z dodatkowymi polami dla UI
interface ExtendedUser extends User {
  name: string;
  isPremium: boolean;
}

interface DashboardHeaderProps {
  refreshWorkspaces: () => Promise<void>;
}

export default function DashboardHeader({ refreshWorkspaces }: DashboardHeaderProps) {
  const router = useRouter();
  const { logout, user: authUser, isLoggedIn, loading: authLoading } = useAuth();
  const { getAvatarColorClass, getInitials } = useUserAvatar();

  // Hook do powiadomień
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    markAllAsRead,
    handleAcceptInvite,
    handleRejectInvite,
  } = useNotifications();

  // State dla popupów
  const [showGiftPopup, setShowGiftPopup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // State dla danych użytkownika
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn || !authUser) {
      router.push('/login');
      return;
    }

    setUser({
      ...authUser,
      name: authUser.full_name || authUser.username,
      isPremium: false,
    });
    setLoading(false);
  }, [authUser, isLoggedIn, authLoading, router]);

  // Loading state
  if (loading) {
    return (
      <header className="bg-[var(--dash-panel)] border-b border-[var(--dash-border)] sticky top-0 z-50">
        <div className="w-full px-4 lg:px-6 py-3">
          <div className="hidden min-[1640px]:flex items-center justify-between gap-4">
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
            <div className="flex items-center justify-end gap-2">
              <div className="w-8 h-8 bg-gray-200 animate-pulse rounded-lg" />
            </div>
          </div>
          <div className="min-[1640px]:hidden flex items-center justify-between">
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
            <div className="w-6 h-6 bg-gray-200 animate-pulse rounded" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="bg-[var(--dash-panel)] sticky top-0 z-50">
        <div className="w-full px-4 lg:px-6 py-3">
          {/* DESKTOP */}
          <div className="hidden min-[1640px]:flex items-center justify-between gap-4">
            {/* LEWA STRONA */}
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
              {user && !user.isPremium && (
                <div className="dashboard-btn-secondary rounded-full border border-[var(--dash-border)] px-3 py-1.5 text-xs font-semibold text-gray-700">
                  FREE PLAN
                </div>
              )}
            </div>

            {/* PRAWA STRONA */}
            <div className="flex items-center justify-end gap-2 font-bold">
              {user && !user.isPremium && (
                <Link href="/#pricing">
                  <DashboardButton variant="secondary" leftIcon={<Crown size={16} />}>
                    Premium
                  </DashboardButton>
                </Link>
              )}

              <div className="w-px h-6 bg-gray-200 mx-1" />

              <Button
                variant="secondary"
                size="iconSm"
                onClick={() => setShowGiftPopup(true)}
                title="Dostań 10% zniżki"
                className="dashboard-btn-secondary rounded-full"
              >
                <Gift size={16} />
              </Button>

              <NotificationBell
                unreadCount={unreadCount}
                onClick={() => setShowNotifications(!showNotifications)}
              />

              {user && (
                <div className="relative">
                  <div
                    className="dashboard-btn-secondary flex min-h-[40px] cursor-pointer items-center rounded-full px-2.5 py-1 pr-3"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setShowUserMenu(!showUserMenu);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Otwórz ustawienia konta"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${getAvatarColorClass(user.id)}`}
                    >
                      {getInitials(user.name)}
                    </span>
                    <span className="ml-2 flex flex-col items-start leading-none">
                      <span className="max-w-[120px] truncate text-xs font-medium text-gray-800">
                        {user.name}
                      </span>
                      <span className="max-w-[120px] truncate text-[11px] text-gray-500">
                        {user.email}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowUserMenu(!showUserMenu);
                      }}
                      className="ml-3 -mr-2 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--dash-border)] bg-white/80 text-gray-600 transition-colors hover:cursor-pointer hover:bg-white hover:text-gray-800"
                      title="Ustawienia konta"
                      aria-label="Ustawienia konta"
                    >
                      <Settings size={14} />
                    </button>
                  </div>
                  {showUserMenu && (
                    <UserMenuPopup
                      onClose={() => setShowUserMenu(false)}
                      user={{
                        ...user,
                        avatar: getInitials(user.name),
                        avatarColorClass: getAvatarColorClass(user.id),
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MOBILE */}
          <div className="min-[1640px]:hidden flex items-center justify-between">
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
            <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
                <span className="font-semibold text-gray-800">Menu</span>
                <Button variant="secondary" size="icon" onClick={() => setShowMobileMenu(false)}>
                  <X size={20} />
                </Button>
              </div>

              <div className="p-4 space-y-3">
                {user && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${getAvatarColorClass(user.id)}`}
                    >
                      <span className="text-white font-semibold text-base">
                        {getInitials(user.name)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {user && !user.isPremium && (
                    <Link href="/#pricing">
                      <DashboardButton
                        variant="secondary"
                        leftIcon={<Crown size={20} />}
                        onClick={() => setShowMobileMenu(false)}
                        className="w-full justify-start py-8"
                      >
                        Przejdź na Premium
                      </DashboardButton>
                    </Link>
                  )}

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
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
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

                  <div className="border-t border-gray-200 my-2" />

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

                {user && !user.isPremium && (
                  <div className="mt-4 px-4">
                    <div className="px-3 py-2 bg-gray-100 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg text-center">
                      FREE PLAN
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {showGiftPopup && <GiftPopup onClose={() => setShowGiftPopup(false)} />}

      {showNotifications && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          loading={notificationsLoading}
          onClose={() => setShowNotifications(false)}
          onMarkAllAsRead={markAllAsRead}
          onAccept={handleAcceptInvite}
          onReject={handleRejectInvite}
          onWorkspacesRefresh={refreshWorkspaces}
        />
      )}
    </>
  );
}
