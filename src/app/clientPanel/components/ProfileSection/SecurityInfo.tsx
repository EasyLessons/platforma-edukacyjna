'use client';

import { useState } from 'react';
import { Edit2, User2, Key, ExternalLink } from 'lucide-react';

// Przykładowe dane
const mockSecurityData = {
  username: 'WhiteslopeStudio',
  loginMethod: 'password',
  externalPlatforms: [],
};

export default function SecurityInfo() {
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [username, setUsername] = useState(mockSecurityData.username);

  const handleSaveUsername = () => {
    // TODO: Zapisz w bazie danych
    console.log('Saving username:', username);
    setIsEditingUsername(false);
  };

  const handleCancelUsername = () => {
    setUsername(mockSecurityData.username);
    setIsEditingUsername(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Informacje o bezpieczeństwie</h2>
      </div>

      <div className="space-y-6">
        {/* Nazwa użytkownika */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">Nazwa użytkownika</h3>
            {!isEditingUsername && (
              <button
                onClick={() => setIsEditingUsername(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit2 size={16} />
                Edytuj
              </button>
            )}
          </div>

          {isEditingUsername ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nazwa użytkownika
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  placeholder="Wprowadź nazwę użytkownika"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveUsername}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Zapisz
                </button>
                <button
                  onClick={handleCancelUsername}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Anuluj
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <User2 size={20} className="text-purple-600" />
              </div>
              <span className="text-gray-900 font-medium">{mockSecurityData.username}</span>
            </div>
          )}
        </div>

        {/* Metoda logowania */}
        <div className="border-t border-gray-100 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">Metoda logowania</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
              Zarządzaj
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Hasło</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Key size={20} className="text-orange-600" />
                </div>
                <span className="text-gray-900 font-medium">Aktualnie używasz hasła</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
