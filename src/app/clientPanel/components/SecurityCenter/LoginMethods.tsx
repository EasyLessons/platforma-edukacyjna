'use client';

import { useState } from 'react';
import { Smartphone, Mail, Chrome, Shield, Plus, Trash2 } from 'lucide-react';

// Przykładowe dane aktywnych sesji
const mockActiveSessions = [
  {
    id: 1,
    device: 'Chrome na Windows',
    location: 'Białystok, Polska',
    lastActive: '2 minuty temu',
    current: true,
  },
  {
    id: 2,
    device: 'Safari na iPhone',
    location: 'Białystok, Polska',
    lastActive: '1 dzień temu',
    current: false,
  },
];

// Przykładowe dane metod uwierzytelniania dwuskładnikowego - tylko email
const mockTwoFactorMethods = [
  {
    id: 1,
    type: 'email',
    identifier: 'w***@gmail.com',
    enabled: false,
    primary: true,
  },
];

export default function LoginMethods() {
  const [activeSessions, setActiveSessions] = useState(mockActiveSessions);
  const [twoFactorMethods, setTwoFactorMethods] = useState(mockTwoFactorMethods);
  const [showAddTwoFactor, setShowAddTwoFactor] = useState(false);

  const handleEndSession = (sessionId: number) => {
    if (confirm('Czy na pewno chcesz zakończyć tę sesję?')) {
      setActiveSessions((prev) => prev.filter((session) => session.id !== sessionId));
    }
  };

  const handleToggleTwoFactor = (methodId: number) => {
    setTwoFactorMethods((prev) =>
      prev.map((method) =>
        method.id === methodId ? { ...method, enabled: !method.enabled } : method
      )
    );
  };

  const getDeviceIcon = (device: string) => {
    if (device.includes('iPhone') || device.includes('Android')) {
      return <Smartphone size={20} className="text-blue-600" />;
    }
    return <Chrome size={20} className="text-green-600" />;
  };

  const getTwoFactorIcon = (type: string) => {
    if (type === 'sms') return <Smartphone size={16} className="text-blue-600" />;
    if (type === 'email') return <Mail size={16} className="text-green-600" />;
    return <Shield size={16} className="text-purple-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Aktywne sesje */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Aktywne sesje</h2>
          <span className="text-sm text-gray-500">
            {activeSessions.length} {activeSessions.length === 1 ? 'sesja' : 'sesji'}
          </span>
        </div>

        <div className="space-y-4">
          {activeSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  {getDeviceIcon(session.device)}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    {session.device}
                    {session.current && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Bieżąca sesja
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {session.location} • {session.lastActive}
                  </p>
                </div>
              </div>

              {!session.current && (
                <button
                  onClick={() => handleEndSession(session.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Zakończ sesję"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700 mb-1">
            <Shield size={16} />
            <span className="font-medium text-sm">Wskazówka bezpieczeństwa</span>
          </div>
          <p className="text-xs text-blue-600">
            Regularnie sprawdzaj aktywne sesje. Jeśli widzisz nieznane urządzenie lub lokalizację,
            natychmiast zakończ sesję i zmień hasło.
          </p>
        </div>
      </div>

      {/* Uwierzytelnianie dwuskładnikowe */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Uwierzytelnianie dwuskładnikowe (2FA)
          </h2>
          <button
            onClick={() => setShowAddTwoFactor(!showAddTwoFactor)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Dodaj metodę
          </button>
        </div>

        <div className="space-y-4">
          {twoFactorMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  {getTwoFactorIcon(method.type)}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    {method.type === 'sms' ? 'SMS' : 'Email'}
                    {method.primary && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                        Główna
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600">{method.identifier}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={method.enabled}
                    onChange={() => handleToggleTwoFactor(method.id)}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {method.enabled ? 'Włączone' : 'Wyłączone'}
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {showAddTwoFactor && (
          <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="font-medium text-gray-900 mb-3">Dodaj nową metodę 2FA</h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 border border-gray-300 rounded-lg hover:bg-white hover:border-blue-300 transition-all">
                <div className="flex items-center gap-3">
                  <Mail size={20} className="text-green-600" />
                  <div>
                    <div className="font-medium">Email</div>
                    <div className="text-sm text-gray-600">Otrzymuj kody na swoją skrzynkę</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 mb-1">
            <Shield size={16} />
            <span className="font-medium text-sm">Zwiększ bezpieczeństwo</span>
          </div>
          <p className="text-xs text-green-600">
            Uwierzytelnianie dwuskładnikowe dodaje dodatkową warstwę ochrony do Twojego konta.
            Zalecamy włączenie co najmniej jednej metody 2FA.
          </p>
        </div>
      </div>
    </div>
  );
}
