'use client';

import { useState } from 'react';
import { Globe, DollarSign, Clock, Calendar } from 'lucide-react';

// Przykładowe dane
const mockLocalizationData = {
  language: 'Polski',
  currency: 'PLN (Złoty polski)',
  timezone: 'Europe/Warsaw (GMT+1)',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
};

const languages = [
  { code: 'pl', name: 'Polski' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
];

const currencies = [
  { code: 'PLN', name: 'PLN (Złoty polski)' },
  { code: 'EUR', name: 'EUR (Euro)' },
  { code: 'USD', name: 'USD (Dolar amerykański)' },
  { code: 'GBP', name: 'GBP (Funt brytyjski)' },
];

const timezones = [
  { code: 'Europe/Warsaw', name: 'Europe/Warsaw (GMT+1)' },
  { code: 'Europe/London', name: 'Europe/London (GMT+0)' },
  { code: 'Europe/Berlin', name: 'Europe/Berlin (GMT+1)' },
  { code: 'America/New_York', name: 'America/New_York (GMT-5)' },
];

const dateFormats = [
  { code: 'DD/MM/YYYY', name: 'DD/MM/YYYY' },
  { code: 'MM/DD/YYYY', name: 'MM/DD/YYYY' },
  { code: 'YYYY-MM-DD', name: 'YYYY-MM-DD' },
];

const timeFormats = [
  { code: '24h', name: '24h (14:30)' },
  { code: '12h', name: '12h (2:30 PM)' },
];

export default function LocalizationInfo() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    language: 'pl',
    currency: 'PLN',
    timezone: 'Europe/Warsaw',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
  });

  const handleSave = () => {
    // TODO: Zapisz w bazie danych
    console.log('Saving localization data:', formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      language: 'pl',
      currency: 'PLN',
      timezone: 'Europe/Warsaw',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Lokalizacja</h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Edytuj ustawienia
          </button>
        )}
      </div>

      <div className="space-y-6">
        {isEditing ? (
          <div className="space-y-6">
            {/* Język i waluta */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-2 mb-4">
                Język i waluta
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Język</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData((prev) => ({ ...prev, language: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Waluta</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  >
                    {currencies.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Strefa czasowa i format daty */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-2 mb-4">
                Strefa czasowa i format daty
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Strefa czasowa
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  >
                    {timezones.map((tz) => (
                      <option key={tz.code} value={tz.code}>
                        {tz.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Format daty
                    </label>
                    <select
                      value={formData.dateFormat}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, dateFormat: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                    >
                      {dateFormats.map((format) => (
                        <option key={format.code} value={format.code}>
                          {format.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Format godziny
                    </label>
                    <select
                      value={formData.timeFormat}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, timeFormat: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                    >
                      {timeFormats.map((format) => (
                        <option key={format.code} value={format.code}>
                          {format.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Przyciski */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
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
          <div className="space-y-6">
            {/* Język i waluta */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-2 mb-4">
                Język i waluta
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Język</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Globe size={20} className="text-blue-600" />
                    </div>
                    <span className="text-gray-900 font-medium">
                      {mockLocalizationData.language}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Waluta</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign size={20} className="text-green-600" />
                    </div>
                    <span className="text-gray-900 font-medium">
                      {mockLocalizationData.currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Strefa czasowa i format daty */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-2 mb-4">
                Strefa czasowa i format daty
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Strefa czasowa
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Clock size={20} className="text-purple-600" />
                    </div>
                    <span className="text-gray-900 font-medium">
                      {mockLocalizationData.timezone}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Format daty
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <Calendar size={20} className="text-orange-600" />
                      </div>
                      <span className="text-gray-900 font-medium">
                        {mockLocalizationData.dateFormat}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Format godziny
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Clock size={20} className="text-indigo-600" />
                      </div>
                      <span className="text-gray-900 font-medium">
                        {mockLocalizationData.timeFormat}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
