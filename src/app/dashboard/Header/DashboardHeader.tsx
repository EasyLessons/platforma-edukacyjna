'use client';

import { useState, useEffect, useMemo } from 'react';
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

  const user = useMemo<ExtendedUser | null>(() => {
    if (!isLoggedIn || !authUser) return null;
    return {
      ...authUser,
      name: authUser.full_name || authUser.username,
      isPremium: false,
    };
  }, [authUser, isLoggedIn]);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn || !authUser) {
      router.push('/login');
    }
  }, [authUser, isLoggedIn, authLoading, router]);

  // Loading state
  if (authLoading) {
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
      <header className="bg-[var(--dash-panel)] border-b border-[var(--dash-border)] sticky top-0 z-50">
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
                    {(user as any).avatar_url ? (
                      <img 
                        src={(user as any).avatar_url} 
                        alt="Avatar"
                        className="h-7 w-7 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white ${getAvatarColorClass(user.id)}`}
                      >
                        {getInitials(user.name)}
                      </span>
                    )}
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
                        avatar_url: (user as any).avatar_url,
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
            <div className="flex items-center gap-2">
              <NotificationBell
                unreadCount={unreadCount}
                onClick={() => setShowNotifications(!showNotifications)}
              />
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
              </Button>
            </div>
          </div>

          {/* MOBILE MENU DROPDOWN (Stylized exactly like desktop UserMenuPopup) */}
          {showMobileMenu && user && (
            <div className="absolute top-[100%] left-0 w-full min-[1640px]:hidden z-40 bg-transparent animate-in slide-in-from-top-2">
              <div className="dashboard-popup-surface w-full overflow-hidden mx-auto rounded-t-none border-t-0 border-x-0 sm:border-x shadow-2xl">
                
                {/* Info użytkownika */}
                <div className="border-b border-[var(--dash-border)] bg-[var(--dash-panel)] px-4 py-4">
                  <div className="flex items-center gap-3">
                    {(user as any).avatar_url ? (
                      <img 
                        src={(user as any).avatar_url} 
                        alt="Avatar"
                        className="w-11 h-11 rounded-full object-cover border border-[var(--dash-border)] shadow-sm"
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm ${getAvatarColorClass(user.id)}`}
                      >
                        <span className="text-white font-semibold text-base">{getInitials(user.name)}</span>
                      </div>
                    )}
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
                        <span className="text-xs font-semibold text-gray-700">FREE PLAN</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Menu opcje */}
                <div className="space-y-1.5 p-2 bg-white">
                  <DashboardButton
                    variant="secondary"
                    leftIcon={<UserIcon size={16} />}
                    onClick={() => {
                      router.push('/clientPanel');
                      setShowMobileMenu(false);
                    }}
                    className="w-full justify-start"
                  >
                    Profil
                  </DashboardButton>

                  {!user.isPremium && (
                    <DashboardButton
                      variant="secondary"
                      leftIcon={<Crown size={16} />}
                      onClick={() => {
                        router.push('/#pricing');
                        setShowMobileMenu(false);
                      }}
                      className="w-full justify-start"
                    >
                      Przejdź na Premium
                    </DashboardButton>
                  )}

                  <DashboardButton
                    variant="secondary"
                    leftIcon={<Gift size={16} />}
                    onClick={() => {
                      setShowGiftPopup(true);
                      setShowMobileMenu(false);
                    }}
                    className="w-full justify-start text-blue-600 border-blue-100 hover:bg-blue-50"
                  >
                    Odbierz 10% zniżki
                  </DashboardButton>

                  <div className="my-2 border-t border-[var(--dash-border)]"></div>

                  {/* Wyloguj */}
                  <DashboardButton
                    variant="primary"
                    leftIcon={<LogOut size={16} />}
                    onClick={() => {
                      logout();
                      setShowMobileMenu(false);
                      router.push('/');
                    }}
                    className="w-full justify-center"
                  >
                    Wyloguj się
                  </DashboardButton>
                </div>
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
