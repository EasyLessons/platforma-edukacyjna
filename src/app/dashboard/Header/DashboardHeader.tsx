"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell, Gift, Crown, UserPlus, ChevronDown } from "lucide-react";

// Import funkcji API
import { getUser, isAuthenticated, type User } from "@/auth_api/api";
import { fetchPendingInvites } from "@/workspace_api/api";

// Import popupów
import InvitePopup from "./popups/InvitePopup";
import GiftPopup from "./popups/GiftPopup";
import NotificationsPopup from "./popups/NotificationsPopup";
import UserMenuPopup from "./popups/UserMenuPopup";

import { useWorkspaces } from "@/app/context/WorkspaceContext";

// Rozszerzony typ User z dodatkowymi polami dla UI
interface ExtendedUser extends User {
  name: string;
  avatar: string;
  isPremium: boolean;
}

export default function DashboardHeader() {
  const router = useRouter();

  // State dla popupów
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [showGiftPopup, setShowGiftPopup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
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
          router.push("/login");
          return;
        }

        // Pobierz dane użytkownika z localStorage
        const userData = getUser();

        if (!userData) {
          router.push("/login");
          return;
        }

        // Rozszerz dane użytkownika o dodatkowe pola
        setUser({
          ...userData,
          name: userData.full_name || userData.username,
          avatar: userData.username?.charAt(0).toUpperCase() || "U",
          isPremium: false, // Tutaj później sprawdzisz czy ma premium
        });
      } catch (error) {
        console.error("Błąd pobierania danych użytkownika:", error);
        router.push("/login");
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
        const invites = await fetchPendingInvites();
        setInviteCount(invites.length);
      } catch (error) {
        console.error("Błąd pobierania zaproszeń:", error);
      }
    };

    loadInviteCount();
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
  const currentSpace = "Klasa 5A";

  // Loading state
  if (loading) {
    return (
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="w-full px-6 py-3">
          <div className="grid grid-cols-3 gap-4 items-center">
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
        </div>
      </header>
    );
  }

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
              <button
                onClick={() => {
                  if (currentWorkspace) {
                    setShowInvitePopup(true);
                  } else {
                    alert("Najpierw wybierz workspace");
                  }
                }}
                className="px-4 py-2 border-2 border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer hover:border-gray-300"
              >
                <UserPlus size={16} />
                <span>Zaproś uczestników</span>
              </button>

              {/* Premium Button */}
              {user && !user.isPremium && (
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

                  {inviteCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                      {inviteCount > 9 ? "9+" : inviteCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Avatar */}
              {user && (
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
              )}
            </div>
          </div>
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

      {showNotifications && (
        <NotificationsPopup onClose={() => setShowNotifications(false)} />
      )}
    </>
  );
}
