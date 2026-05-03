'use client';

import { useState, useRef } from 'react';
import { Edit2, User, Mail, Upload, Calendar } from 'lucide-react';
import type { User as UserType } from '@/_new/shared/types/user';
import { useAuth } from '@/app/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/_new/lib/api';

interface BasicInfoProps {
  user: UserType | null;
}

export default function BasicInfo({ user }: BasicInfoProps) {
  const { updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    firstName: user?.username?.split(' ')[0] || '',
    lastName: user?.username?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
  });

  const handleSave = () => {
    // TODO: Zapisywanie firstName, lastName, email (wymaga odpowiedniego endpointu)
    console.log('Saving user data:', formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.username?.split(' ')[0] || '',
      lastName: user?.username?.split(' ').slice(1).join(' ') || '',
      email: user?.email || '',
    });
    setIsEditing(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploading(true);

      // Usunięto podwójne /avatars/, ładujemy bezpośrednio do bucketu "avatars"
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Pobieranie publicznego URLa
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(uploadData.path);

      const avatarUrl = publicUrlData.publicUrl;

      // Aktualizacja na backendzie FastAPI
      await apiClient.put('/api/v1/auth/users/me', {
        avatar_url: avatarUrl
      });

      // Błyskawiczna zmiana w aplikacji (bez przeładowania)
      updateUser({ avatar_url: avatarUrl });

    } catch (error) {
      console.error('Błąd podczas zapisywania awatara:', error);
      alert('Nie udało się zapisać awatara');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Informacje o profilu</h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit2 size={16} />
            Edytuj
          </button>
        )}
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
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleAvatarUpload} 
            className="hidden" 
            id="avatar-upload"
          />
          <label 
            htmlFor="avatar-upload"
            className="cursor-pointer px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? 'Wgrywam...' : 'Zmień zdjęcie'}
          </label>
          <p className="text-xs text-gray-500 mt-2">Zalecane wymiary: 1:1, max. 2MB</p>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-2">
          Podstawowe informacje
        </h3>

        {isEditing ? (
          <div className="space-y-4">
            {/* Edycja - Imię i nazwisko */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Imię</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nazwisko</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                />
              </div>
            </div>

            {/* Edycja - Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Główny e-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
              />
            </div>

            {/* Przyciski */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Zapisz zmiany
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Wyświetlanie - Imię i nazwisko */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Imię i nazwisko
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
        )}
      </div>
    </div>
  );
}
