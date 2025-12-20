'use client';

import { useState } from 'react';
import { Key, Eye, EyeOff, Shield } from 'lucide-react';

export default function PasswordSection() {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Aktualne hasło jest wymagane';
    }
    
    if (!formData.newPassword || formData.newPassword.length < 8) {
      newErrors.newPassword = 'Nowe hasło musi mieć co najmniej 8 znaków';
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Hasła nie są identyczne';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // TODO: Wywołaj API do zmiany hasła
    console.log('Changing password...');
    
    // Reset form
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowChangePassword(false);
    setErrors({});
    
    // Show success message (możesz dodać toast notification)
    alert('Hasło zostało pomyślnie zmienione!');
  };

  const handleCancel = () => {
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowChangePassword(false);
    setErrors({});
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, text: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    
    if (strength < 2) return { strength, text: 'Słabe', color: 'text-red-500' };
    if (strength < 4) return { strength, text: 'Średnie', color: 'text-orange-500' };
    return { strength, text: 'Silne', color: 'text-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Metoda logowania</h2>
      </div>

      <div className="space-y-6">
        {/* Aktualny status */}
        <div>
          <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Key size={20} className="text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-green-900 mb-1">
                Aktualnie używasz hasła.
              </h3>
              <p className="text-sm text-green-700">
                Twoje konto jest chronione hasłem. Ostatnia zmiana: 30 dni temu.
              </p>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <Shield size={16} />
              <span className="text-sm font-medium">Zabezpieczone</span>
            </div>
          </div>
        </div>

        {/* Przycisk/Form zmiany hasła */}
        {!showChangePassword ? (
          <div className="text-center">
            <button
              onClick={() => setShowChangePassword(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Zmień hasło
            </button>
          </div>
        ) : (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Zmiana hasła</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Aktualne hasło */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aktualne hasło *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    required
                    value={formData.currentPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className={`w-full px-3 py-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      errors.currentPassword ? 'border-red-300' : 'border-gray-400'
                    }`}
                    placeholder="Wprowadź aktualne hasło"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.currentPassword}</p>
                )}
              </div>

              {/* Nowe hasło */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nowe hasło *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    required
                    value={formData.newPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className={`w-full px-3 py-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      errors.newPassword ? 'border-red-300' : 'border-gray-400'
                    }`}
                    placeholder="Wprowadź nowe hasło"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                
                {/* Wskaźnik siły hasła */}
                {formData.newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            passwordStrength.strength < 2 ? 'bg-red-500' :
                            passwordStrength.strength < 4 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${passwordStrength.color}`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Użyj co najmniej 8 znaków z kombinacją liter, cyfr i symboli
                    </p>
                  </div>
                )}
                
                {errors.newPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>
                )}
              </div>

              {/* Potwierdź nowe hasło */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Potwierdź nowe hasło *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className={`w-full px-3 py-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      errors.confirmPassword ? 'border-red-300' : 'border-gray-400'
                    }`}
                    placeholder="Potwierdź nowe hasło"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Przyciski */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Zmień hasło
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}