/**
 * AuthContext.tsx - Zarządzanie stanem logowania w całej aplikacji
 * 
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

import {
  setAccessToken,
  removeAccessToken,
  setStoredUser,
  removeStoredUser,
  refreshAccessToken,
} from '@/_new/lib/auth';
import { getCurrentUser, logoutUser } from '@/_new/features/auth/api/authApi';
import type { User } from '@/_new/shared/types/user';

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
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
      } catch {
        try {
          await refreshAccessToken();
          const userData = await getCurrentUser();
          setIsLoggedIn(true);
          setUser(userData);
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
  };

  const logout = () => {
    logoutUser().catch(() => {}); // powiadom backend (fire and forget)
    removeAccessToken();
    removeStoredUser();
    setIsLoggedIn(false);
    setUser(null);
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
