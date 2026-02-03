'use client';

import { useState } from 'react';
import { Edit2, User, Mail } from 'lucide-react';
import { User as UserType } from '../../../../auth_api/api';

interface BasicInfoProps {
  user: UserType | null;
}

export default function BasicInfo({ user }: BasicInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.username?.split(' ')[0] || '',
    lastName: user?.username?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
  });

  const handleSave = () => {
    // TODO: Zapisz w bazie danych
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
