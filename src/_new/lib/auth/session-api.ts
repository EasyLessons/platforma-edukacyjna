/**
 * session-api.ts - dwa wywolania API, ktorych potrzebuje AuthProvider do
 * bootstrapu i wylogowania sesji.
 *
 * Zyja w lib/auth (a nie w features/auth/api), bo AuthProvider jest warstwa
 * infrastruktury (montowany w root layout, uzywany przez wszystkie feature'y),
 * a warstwa lib nie moze zalezec od features (regula no-shared-lib-to-features
 * w .dependency-cruiser.cjs). features/auth/api/authApi.ts re-eksportuje je,
 * wiec publiczne API feature'a auth sie nie zmienia.
 */
import { apiClient } from '@/_new/lib/api';
import type { User } from '@/_new/shared/types/user';

/** GET /api/v1/auth/me - dane zalogowanego usera (403 gdy brak/wygasly token). */
export const getCurrentUser = (): Promise<User> =>
  apiClient.get<{ user: User }>('/api/v1/auth/me').then((res) => res.data.user);

/** POST /api/v1/auth/logout - uniewaznienie refresh tokenu po stronie backendu. */
export const logoutUser = (): Promise<void> =>
  apiClient.post('/api/v1/auth/logout').then((res) => res.data);
