/**
 * apiClient — skonfigurowana instancja Axios dla całego projektu.
 *
 * Request interceptor:
 *   Dodaje Authorization: Bearer <token> do każdego requestu.
 *
 * Response interceptor:
 *   - Rozpakowuje { success: true, data: T } → zwraca T bezpośrednio
 *   - Obsługuje 401: próbuje refresh (gdy dostępny) lub robi logout
 *   - Mapuje błędy Axios → AppError
 *
 * Dzięki temu pliki API są czyste:
 *   export const fetchBoards = (wsId: number) =>
 *     apiClient.get<BoardListResponse>('/api/v1/boards', { params: { workspace_id: wsId } });
 */
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import {
  getAccessToken,
  setAccessToken,
  clearSession,
  refreshAccessToken,
  logoutAndRedirect,
} from '../auth';
import { mapAxiosError } from '../errors';
import type { ApiSuccessResponse } from './types';

// KONFIGURACJA BAZOWA

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 60_000;

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // HttpOnly cookie potrzebne dla refresh
  timeout: REQUEST_TIMEOUT_MS,
});

// REQUEST INTERCEPTOR

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE INTERCEPTOR

// Współdzielony promise refresha — równoczesne 401 dołączają do tego samego refresh
// zamiast być odrzucane. null = refresh nie trwa.
let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  // Success: rozpakuj ApiResponse<T> -> T
  (response: AxiosResponse) => {
    const data = response.data;

    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success === true) {
        return { ...response, data: data.data };
      }
      // success: false
      return Promise.reject({ response });
    }

    // Odpowiedź bez wrappera (np. 204 No Content) — zwróć jak jest
    return response;
  },

  // Błąd: obsłuż 401, zmapuj na AppError
  async (error) => {
    const status = error?.response?.status;

    const isAuthError =
      status === 401 ||
      (status === 403 && error?.response?.data?.detail === 'Not authenticated');

    const originalRequest = error.config as AxiosRequestConfig & { _retried?: boolean };

    // Na endpointach auth (login, register) 401 zawsze znaczy złe dane — nie próbuj refresha
    const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register');

    if (isAuthError && !originalRequest._retried && !isAuthEndpoint) {
      originalRequest._retried = true;

      try {
        // Jeśli refresh już trwa — dołącz do niego zamiast tworzyć nowy.
        // Wszystkie równoczesne 401 (np. /me, /join, /elements przy starcie tablicy)
        // dostaną ten sam nowy token i ponowią swoje requesty.
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        setAccessToken(newToken);

        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] =
            `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch {
        // Refresh nie powiódł się — wyloguj
        clearSession();
        logoutAndRedirect();
        // Gdy logoutAndRedirect nie przekieruje (jesteśmy już na /login),
        // przepuść oryginalny błąd żeby UI mogło go wyświetlić
        if (typeof window !== 'undefined' && window.location.pathname === '/login') {
          return Promise.reject(mapAxiosError(error));
        }
        return new Promise(() => {});
      }
    }

    // Zamień błąd Axios na AppError
    return Promise.reject(mapAxiosError(error));
  }
);
