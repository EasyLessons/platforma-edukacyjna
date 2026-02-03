'use client';

import { useState } from 'react';
import { X, CreditCard, Lock } from 'lucide-react';
import { PaymentMethod } from '../../types';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (paymentMethod: Omit<PaymentMethod, 'id'>) => void;
}

export default function AddPaymentModal({ isOpen, onClose, onSave }: AddPaymentModalProps) {
  const [formData, setFormData] = useState({
    cardNumber: '',
    cardHolderName: '',
    expiryMonth: new Date().getMonth() + 1,
    expiryYear: new Date().getFullYear(),
    cvv: '',
    isDefault: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const detectCardBrand = (cardNumber: string): 'visa' | 'mastercard' | 'amex' | 'discover' => {
    const number = cardNumber.replace(/\s/g, '');
    if (number.startsWith('4')) return 'visa';
    if (number.startsWith('5') || number.startsWith('2')) return 'mastercard';
    if (number.startsWith('3')) return 'amex';
    return 'visa'; // default
  };

  const formatCardNumber = (value: string) => {
    const number = value.replace(/\D/g, '');
    const formatted = number.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length < 13) {
      newErrors.cardNumber = 'Numer karty jest nieprawidłowy';
    }

    if (!formData.cardHolderName.trim()) {
      newErrors.cardHolderName = 'Imię i nazwisko jest wymagane';
    }

    if (!formData.cvv || formData.cvv.length < 3) {
      newErrors.cvv = 'Kod CVV jest nieprawidłowy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const cardNumber = formData.cardNumber.replace(/\s/g, '');
    const paymentMethod: Omit<PaymentMethod, 'id'> = {
      type: 'credit_card',
      lastFourDigits: cardNumber.slice(-4),
      cardHolderName: formData.cardHolderName,
      expiryMonth: formData.expiryMonth,
      expiryYear: formData.expiryYear,
      isDefault: formData.isDefault,
      brand: detectCardBrand(cardNumber),
    };

    onSave(paymentMethod);
    handleReset();
  };

  const handleReset = () => {
    setFormData({
      cardNumber: '',
      cardHolderName: '',
      expiryMonth: new Date().getMonth() + 1,
      expiryYear: new Date().getFullYear(),
      cvv: '',
      isDefault: false,
    });
    setErrors({});
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Dodaj metodę płatności</h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Bezpieczeństwo informacja */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 mb-1">
              <Lock size={16} />
              <span className="font-medium text-sm">Bezpieczne płatności</span>
            </div>
            <p className="text-xs text-blue-600">
              Twoje dane karty są szyfrowane i bezpiecznie przechowywane zgodnie z standardami PCI
              DSS.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Numer karty *</label>
            <div className="relative">
              <input
                type="text"
                required
                value={formData.cardNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    cardNumber: formatCardNumber(e.target.value),
                  }))
                }
                maxLength={19}
                className={`w-full pl-12 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                  errors.cardNumber ? 'border-red-300' : 'border-gray-400'
                }`}
                placeholder="1234 5678 9012 3456"
              />
              <CreditCard
                size={20}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
            </div>
            {errors.cardNumber && <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imię i nazwisko na karcie *
            </label>
            <input
              type="text"
              required
              value={formData.cardHolderName}
              onChange={(e) => setFormData((prev) => ({ ...prev, cardHolderName: e.target.value }))}
              className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.cardHolderName ? 'border-red-300' : 'border-gray-400'
              }`}
              placeholder="Jan Kowalski"
            />
            {errors.cardHolderName && (
              <p className="text-red-500 text-xs mt-1">{errors.cardHolderName}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Miesiąc *</label>
              <select
                required
                value={formData.expiryMonth}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, expiryMonth: parseInt(e.target.value) }))
                }
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {month.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rok *</label>
              <select
                required
                value={formData.expiryYear}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, expiryYear: parseInt(e.target.value) }))
                }
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() + i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CVV *</label>
              <input
                type="text"
                required
                value={formData.cvv}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))
                }
                maxLength={4}
                className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                  errors.cvv ? 'border-red-300' : 'border-gray-400'
                }`}
                placeholder="123"
              />
              {errors.cvv && <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData((prev) => ({ ...prev, isDefault: e.target.checked }))}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
              Ustaw jako domyślną metodę płatności
            </label>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-100">
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Dodaj kartę
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Anuluj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
