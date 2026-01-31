// API Service - komunikacja z FastAPI backendem

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Typy danych
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  full_name?: string;
}

export interface LoginData {
  login: string;
  password: string;
}

export interface VerifyEmailData {
  user_id: number;
  code: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterResponse {
  user: User;
  message: string;
}

export interface UserSearchResult {
  id: number;
  username: string;
  email: string;
  full_name?: string;
}

// Password reset types
export interface RequestPasswordResetData {
  email: string;
}

export interface VerifyResetCodeData {
  email: string;
  code: string;
}

export interface ResetPasswordData {
  email: string;
  code: string;
  password: string;
  password_confirm: string;
}

// Helper do obsługi błędów
const handleResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const errorMessage = data.detail || 'Wystąpił błąd';
    throw new Error(errorMessage);
  }
  
  return data;
};

// API funkcje

/**
 * Rejestracja nowego użytkownika
 */
export const registerUser = async (userData: RegisterData): Promise<RegisterResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
  
  return handleResponse(response);
};

/**
 * Weryfikacja email przez kod
 */
export const verifyEmail = async (verifyData: VerifyEmailData): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/verify-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyData),
  });
  
  return handleResponse(response);
};

/**
 * Logowanie użytkownika
 */
export const loginUser = async (loginData: LoginData): Promise<AuthResponse> => {
     console.log('API_BASE_URL:', API_BASE_URL);
     console.log('Full URL:', `${API_BASE_URL}/api/login`);
     console.log('Login data:', loginData);
     
     const response = await fetch(`${API_BASE_URL}/api/login`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify(loginData),
     });
     
     return handleResponse(response);
   };

/**
 * Ponowne wysłanie kodu weryfikacyjnego
 */
export const resendVerificationCode = async (userId: number): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/resend-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  
  return handleResponse(response);
};

// Local Storage + Cookies helpers dla tokenu
// Zapisujemy w OBA miejsca:
// - localStorage: dla łatwego dostępu w komponentach
// - cookies: dla middleware (ochrona tras)
export const saveToken = (token: string) => {
  if (typeof window !== 'undefined') {
    // Zapisz w localStorage
    localStorage.setItem('access_token', token);
    
    // Zapisz w cookies (ważne przez 7 dni)
    document.cookie = `access_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
  }
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
};

export const removeToken = () => {
  if (typeof window !== 'undefined') {
    // Usuń z localStorage
    localStorage.removeItem('access_token');
    
    // Usuń z cookies
    document.cookie = 'access_token=; path=/; max-age=0';
  }
};

export const saveUser = (user: User) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user));
  }
};

export const getUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
  return null;
};

export const removeUser = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
  }
};

// Helper do sprawdzenia czy użytkownik jest zalogowany
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

// Wylogowanie
export const logout = () => {
  removeToken();
  removeUser();
};

/**
 * Sprawdza czy użytkownik istnieje i czy jest zweryfikowany
 */
export const checkUser = async (email: string): Promise<{ exists: boolean; verified: boolean; user_id?: number }> => {
  const response = await fetch(`${API_BASE_URL}/api/check-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  
  return handleResponse(response);
};

/**
 * Wyszukuje użytkowników
 */
export const searchUsers = async (query: string, limit: number = 10): Promise<UserSearchResult[]> => {
  if (!query || query.length < 2) return []; // minimalna długość
  const token = getToken();

  console.log(query);
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/users/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
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
  } catch (error) {
    console.error('Search users exception:', error);
    throw error;
  }
};


/**
 * Sprawdza czy użytkownik może być zaproszony
 */
export const checkUserInviteStatus = async (
  workspaceId: number, 
  userId: number
): Promise<{is_member: boolean; has_pending_invite: boolean; can_invite: boolean}> => {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/workspaces/${workspaceId}/members/check/${userId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Błąd sprawdzania statusu');
  }
  
  return response.json();
};


// === PASSWORD RESET API ===

/**
 * Wysyła żądanie resetu hasła - kod na email
 */
export const requestPasswordReset = async (data: RequestPasswordResetData): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/request-password-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  return handleResponse(response);
};

/**
 * Weryfikuje kod resetowania hasła
 */
export const verifyResetCode = async (data: VerifyResetCodeData): Promise<{ message: string; valid: boolean }> => {
  const response = await fetch(`${API_BASE_URL}/api/verify-reset-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  return handleResponse(response);
};

/**
 * Resetuje hasło użytkownika
 */
export const resetPassword = async (data: ResetPasswordData): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  return handleResponse(response);
};