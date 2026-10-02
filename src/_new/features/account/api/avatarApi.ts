/**
 * Upload awatara przez backend (SEC-03, docs/security/AUDYT-2026-09.md).
 *
 * Plik NIE idzie już z przeglądarki prosto do bucketu Supabase kluczem anon.
 * Backend (POST /api/v1/auth/users/me/avatar) sprawdza treść, przekodowuje obraz,
 * zapisuje go kluczem service_role i sam ustawia `avatar_url` użytkownika.
 */
import { apiClient } from '@/_new/lib/api';
import type { User } from '@/_new/shared/types/user';

/** Limit pliku wejściowego — ten sam co AVATAR_MAX_UPLOAD_BYTES w backend/api/v1/auth/avatar.py. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Typy przyjmowane przez backend (rozpoznawane tam po treści, nie po nagłówku). */
export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Wstępna walidacja po stronie przeglądarki — tylko dla wygody (szybki komunikat
 * bez wysyłania pliku). Prawdziwa walidacja jest na backendzie.
 * Zwraca komunikat błędu albo null, gdy plik wygląda poprawnie.
 */
export function validateAvatarFile(file: File): string | null {
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return 'Dozwolone formaty zdjęcia: JPG, PNG lub WEBP.';
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'Zdjęcie jest za duże (maksymalnie 5 MB).';
  }
  return null;
}

/** Wysyła plik do backendu; zwraca zaktualizowanego użytkownika (z nowym `avatar_url`). */
export const uploadAvatar = (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient
    .post<User>('/api/v1/auth/users/me/avatar', formData, {
      // Domyślny 'application/json' klienta trzeba zdjąć — przeglądarka sama ustawi
      // multipart/form-data z poprawnym boundary.
      headers: { 'Content-Type': undefined },
    })
    .then((res) => res.data);
};
