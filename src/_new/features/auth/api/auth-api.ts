/**
 * AUTH API
 * 
 * Zawiera funkcje do komunikacji z backendem w zakresie autoryzacji użytkowników.
 * Obejmuje rejestrację, logowanie, resetowanie hasła, weryfikację emaila 
 * i inne operacje związane z kontem.
 */

import type {
  LoginRequest,
  RegisterRequest,
  PasswordResetRequest,
  VerifyResetCodeRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  ResendCodeRequest,
  LoginResponse,
  RegisterResponse,
  PasswordResetResponse,
  VerifyCodeResponse,
  VerifyEmailResponse,
  ResendCodeResponse,
  User,
} from '../types';

// CONFIG
// ================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// HELPERS
// ================================

// Obsługa odpowiedzi z API
const handleResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data.detail || 'Wystąpił błąd.';
    throw new Error(errorMessage);
  }

  return data;
};

// LOCAL STORAGE
// ================================

// Zapisuje token do localStorage i cookies
export const saveToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', token);
    document.cookie = `access_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
  }
};

// Pobiera token z localStorage
export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
};

// Usuwa token z localStorage i cookies
export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    document.cookie = 'access_token=; path=/; max-age=0';
  }
};

// LOCAL STORAGE - USER
// ================================

// Zapisuje dane użytkownika do localStorage
export const saveUser = (user: User) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user));
  }
};

// Pobiera dane użytkownika z localStorage
export const getUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
  return null;
};

// Usuwa dane użytkownika z localStorage
export const removeUser = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
  }
};

// AUTH HELPERS
// ================================

// Sprawdza, czy użytkownik jest zalogowany
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

// Wylogowanie - usuwa token i dane użytkownika
export const logout = () => {
  removeToken();
  removeUser();
};

// API - REJESTRACJA
// ================================

// Rejestracja nowego użytkownika
export const registerUser = async (
    userData: RegisterRequest
): Promise<RegisterResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  return handleResponse(response);
};

// Weryfikacja emaila przez kod
export const verifyEmail = async (
    verifyData: VerifyEmailRequest
): Promise<VerifyEmailResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/verify-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyData),
  });
  return handleResponse(response);
};

// Ponowne wysłanie kodu weryfikacyjnego
export const resendVerificationCode = async (
    resendData: ResendCodeRequest
): Promise<ResendCodeResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/resend-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(resendData),
  });

  return handleResponse(response);
};

// API - LOGOWANIE
// ================================

// Logowanie użytkownika
export const loginUser = async (
    loginData: LoginRequest
): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(loginData),
  });

  return handleResponse(response);
};

// Sprawdza czy użytkownik istnieje i czy jest zweryfikowany
export const checkUser = async (
    email: string
): Promise<{ exists: boolean; verified: boolean; user_id?: number }> => {
  const response = await fetch(`${API_BASE_URL}/api/check-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  return handleResponse(response);
};

// API - RESET HASŁA
// ================================

// Żądanie resetu hasła
export const requestPasswordReset = async (
    data: PasswordResetRequest
): Promise<PasswordResetResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/request-password-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

// Weryfikacja kodu resetu
export const verifyResetCode = async (
  data: VerifyResetCodeRequest
): Promise<VerifyCodeResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/verify-reset-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

// Resetowanie hasła
export const resetPassword = async (
  data: ResetPasswordRequest
): Promise<PasswordResetResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

// API - USER SEARCH
// ================================

export interface UserSearchResult {
  id: number;
  username: string;
  email: string;
  full_name?: string;
}

// Wyszukuje użytkowników
export const searchUsers = async (
  query: string,
  limit: number = 10
): Promise<UserSearchResult[]> => {
  if (!query || query.length < 2) return [];

  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/users/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    let errorMessage = `Błąd ${response.status}: ${response.statusText}`;
    try {
      const error = await response.json();
      if (error.detail) errorMessage = error.detail;
    } catch {}
    throw new Error(errorMessage);
  }

  return response.json();
};

// Sprawdza czy użytkownik może być zaproszony do workspace
export const checkUserInviteStatus = async (
  workspaceId: number,
  userId: number
): Promise<{ is_member: boolean; has_pending_invite: boolean; can_invite: boolean }> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/members/check/${userId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Błąd sprawdzania statusu');
  }

  return response.json();
};
