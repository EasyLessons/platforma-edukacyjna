/**
 * AuthContext.tsx - Zarządzanie stanem logowania w całej aplikacji
 *
 * Przeniesiony z src/app/context/AuthContext.tsx (lipiec 2026) — logicznie
 * należał do warstwy auth w src/_new, tylko był źle zaparkowany w routingu.
 * Zero zmian w działaniu, tylko lokalizacja i ścieżki importów.
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { setAccessToken, setStoredUser, clearSession } from './tokenStore';
import { getDirtyBoardCaches, sweepForeignBoardCaches } from '@/_new/lib/board-cache/board-cache';
import { refreshAccessToken } from './tokenService';
import { getCurrentUser, logoutUser } from './session-api';
import type { User } from '@/_new/shared/types/user';

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => boolean;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const userData = await getCurrentUser();
        setIsLoggedIn(true);
        setUser(userData);
        sweepForeignBoardCaches(userData.id);
      } catch {
        try {
          await refreshAccessToken();
          const userData = await getCurrentUser();
          setIsLoggedIn(true);
          setUser(userData);
          sweepForeignBoardCaches(userData.id);
        } catch {
          setIsLoggedIn(false);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = (token: string, userData: User) => {
    setAccessToken(token);
    setStoredUser(userData);
    setIsLoggedIn(true);
    setUser(userData);
    sweepForeignBoardCaches(userData.id);
  };

  const logout = () => {
    const dirty = user ? getDirtyBoardCaches(user.id) : [];
    if (
      dirty.length > 0 &&
      !window.confirm(
        `Masz niewysłane zmiany na ${dirty.length} ${dirty.length === 1 ? 'tablicy' : 'tablicach'}. ` +
          'Otwórz je z połączeniem z internetem, żeby je zapisać. Wylogować mimo to? Zmiany przepadną.'
      )
    ) {
      return false;
    }
    logoutUser().catch(() => {}); // powiadom backend (fire and forget)
    clearSession({ keepDirty: false });
    setIsLoggedIn(false);
    setUser(null);
    return true;
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    setStoredUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth musi być używany wewnątrz AuthProvider');
  return context;
}
