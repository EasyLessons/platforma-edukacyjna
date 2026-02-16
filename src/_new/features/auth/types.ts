/**
 * AUTH TYPES
 * 
 * Typy i interfejsy związane z autoryzacją użytkowników.
 * Ułatwiają zarządzanie formularzami oraz komunikacją z API.
 *  
 * IDEA: typy zawarte w pliku są wspódzielone przez różne komponenty.
*/

import { User } from "@/_new/shared/types/user";

// FORM DATA TYPES
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  login: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// VALIDATION ERROR TYPES
export interface LoginErrors {
  email?: string;
  password?: string;
}

export interface RegisterErrors {
  login?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// API REQUEST TYPES
export interface LoginRequest {
  login: string;
  password: string;
  email?: string;
}

export interface RegisterRequest {
  login: string;
  email: string;
  password: string;
  confirmPassword: string;
  full_name?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  password: string;
  password_confirm: string;
}

export interface VerifyEmailRequest {
  user_id: number;
  code: string;
}

export interface ResendCodeRequest {
  user_id: number;
  email: string;
}

// API RESPONSE TYPES
export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface RegisterResponse {
  user_id: number;
  email: string;
  message: string;
}

export interface PasswordResetResponse {
  message: string;
}

export interface VerifyCodeResponse {
  message: string;
  valid: boolean;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface ResendCodeResponse {
  message: string;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

export type { User } from '@/_new/shared/types/user';
