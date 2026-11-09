'use client';

import { useState, useRef } from 'react';
import { User, Mail, Upload, Calendar } from 'lucide-react';
import type { User as UserType } from '@/_new/shared/types/user';
import { useAuth } from '@/_new/lib/auth';
import { AppError } from '@/_new/lib/errors';
import { createLogger } from '@/_new/lib/logger';
import { AVATAR_ACCEPTED_TYPES, uploadAvatar, validateAvatarFile } from '../../api/avatarApi';

const log = createLogger('account/BasicInfo');

interface BasicInfoProps {
  user: UserType | null;
}

/** Komunikat dla użytkownika na podstawie błędu z backendu. */
function avatarErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    if (error.status === 413) return 'Zdjęcie jest za duże (maksymalnie 5 MB).';
    if (error.status === 429) return 'Zbyt wiele prób. Spróbuj ponownie za kilka minut.';
    if (error.isNetworkError()) return 'Brak połączenia z serwerem. Spróbuj ponownie.';
    // 400 z backendu niesie gotowy komunikat po polsku (zły format, za duże wymiary).
    if (error.status === 400 && error.message) return error.message;
  }
  return 'Nie udało się zapisać awatara. Spróbuj ponownie.';
}

export default function BasicInfo({ user }: BasicInfoProps) {
  const { updateUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edycja nazwy/e-maila: backend nie ma jeszcze endpointu (PUT /users/me przyjmuje tylko
  // avatar_url), więc formularz "Edytuj / Zapisz zmiany" był atrapą - usunięty do czasu
  // dodania endpointu. Zmiana awatara działa (poniżej).

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const resetInput = () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    if (!file || !user || uploading) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      resetInput();
      return;
    }

    try {
      setUploading(true);
      setAvatarError(null);

      // Plik idzie do backendu (walidacja + przekodowanie + zapis w Storage);
      // backend sam ustawia avatar_url i zwraca zaktualizowanego użytkownika.
      const updated = await uploadAvatar(file);

      // Błyskawiczna zmiana w aplikacji (bez przeładowania)
      updateUser({ avatar_url: updated.avatar_url });
    } catch (error) {
      log.error(
        'Zapis awatara nieudany',
        error instanceof AppError ? { code: error.code, status: error.status } : 'nieznany błąd'
      );
      setAvatarError(avatarErrorMessage(error));
    } finally {
      setUploading(false);
      resetInput();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Informacje o profilu</h2>
      </div>

      {/* Awatar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 relative">
          {(user as any)?.avatar_url ? (
            <img
              src={(user as any).avatar_url}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={32} className="text-green-600" />
          )}
        </div>
        <div>
          <input
            type="file"
            accept={AVATAR_ACCEPTED_TYPES.join(',')}
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            disabled={uploading}
            className="hidden"
            id="avatar-upload"
          />
          <label
            htmlFor="avatar-upload"
            aria-busy={uploading}
            className={`px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 flex items-center justify-center gap-2 transition-colors ${
              uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'
            }`}
          >
            <Upload size={16} />
            {uploading ? 'Wgrywam...' : 'Zmień zdjęcie'}
          </label>
          <p className="text-xs text-gray-500 mt-2">
            JPG, PNG lub WEBP, zalecane proporcje 1:1, max. 5 MB
          </p>
          {avatarError && (
            <p role="alert" className="text-xs text-red-600 mt-1">
              {avatarError}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-2">
          Podstawowe informacje
        </h3>

        <div className="space-y-4">
          {/* Wyświetlanie - Imię i nazwisko */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Nazwa użytkownika
            </label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <User size={20} className="text-green-600" />
              </div>
              <span className="text-gray-900 font-medium">{user?.username || 'Brak danych'}</span>
            </div>
          </div>

          {/* Wyświetlanie - Email */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Główny e-mail</label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail size={20} className="text-blue-600" />
              </div>
              <span className="text-gray-900 font-medium">{user?.email || 'Brak danych'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
