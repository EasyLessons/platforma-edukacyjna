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

// Flaga zapobiegająca pętli redirect gdy refresh też zwróci 401
let isHandling401 = false;

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

    // 401/403 - próba odświeżenia tokenu (403 gdy brak headera Authorization)
    const isAuthError = status === 401 || (status === 403 && error?.response?.data?.detail === 'Not authenticated');
    if (isAuthError && !isHandling401) {
      isHandling401 = true;
      try {
        const newToken = await refreshAccessToken();
        setAccessToken(newToken);

        // Ponów oryginalny request
        const originalRequest = error.config as AxiosRequestConfig & {
          _retried?: boolean;
        };
        if (!originalRequest._retried) {
          originalRequest._retried = true;
          if (originalRequest.headers) {
            (originalRequest.headers as Record<string, string>)['Authorization'] =
              `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        }
      } catch {
        // Refresh nie powiódł się - wyloguj
        clearSession();
        logoutAndRedirect();
      } finally {
        isHandling401 = false;
      }
    }

    // Zamień błąd Axios na AppError
    return Promise.reject(mapAxiosError(error));
  }
);
