/**
 * AUTH API
 *
 * Komunikacja z backendem w zakresie autoryzacji.
 * Używa apiClient — zero fetch, zero getToken, zero handleResponse.
 *
 * Token management → src/lib/auth/tokenStore.ts
 * Error handling   → src/lib/errors/AppError.ts (przez interceptor)
 */
import { apiClient } from '@/_new/lib/api';
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

// REJESTRACJA

export const registerUser = (data: RegisterRequest): Promise<RegisterResponse> =>
  apiClient.post<RegisterResponse>('/api/v1/auth/register', data).then((res) => res.data);

export const verifyEmail = (data: VerifyEmailRequest): Promise<VerifyEmailResponse> =>
  apiClient.post<VerifyEmailResponse>('/api/v1/auth/verify-email', data).then((res) => res.data);

export const resendVerificationCode = (data: ResendCodeRequest): Promise<ResendCodeResponse> =>
  apiClient.post<ResendCodeResponse>('/api/v1/auth/resend-code', data).then((res) => res.data);

// LOGOWANIE

export const loginUser = (data: LoginRequest): Promise<LoginResponse> =>
  apiClient.post<LoginResponse>('/api/v1/auth/login', data).then((res) => res.data);

export const checkUser = (
  email: string
): Promise<{
  exists: boolean;
  verified: boolean;
  user_id?: number;
  message?: string;
}> => apiClient.post('/api/v1/auth/check-user', { email }).then((res) => res.data);

// RESET HASŁA

export const requestPasswordReset = (data: PasswordResetRequest): Promise<PasswordResetResponse> =>
  apiClient
    .post<PasswordResetResponse>('/api/v1/auth/request-password-reset', data)
    .then((res) => res.data);

export const verifyResetCode = (data: VerifyResetCodeRequest): Promise<VerifyCodeResponse> =>
  apiClient
    .post<VerifyCodeResponse>('/api/v1/auth/verify-reset-code', data)
    .then((res) => res.data);

export const resetPassword = (data: ResetPasswordRequest): Promise<PasswordResetResponse> =>
  apiClient
    .post<PasswordResetResponse>('/api/v1/auth/reset-password', data)
    .then((res) => res.data);

// WYSZUKIWANIE UŻYTKOWNIKÓW

export type UserSearchResult = Pick<User, 'id' | 'username' | 'email'> & {
  full_name?: string;
};

export const searchUsers = (query: string, limit = 10): Promise<UserSearchResult[]> =>
  apiClient
    .get<UserSearchResult[]>('/api/v1/auth/users/search', {
      params: { query, limit },
    })
    .then((res) => res.data);
