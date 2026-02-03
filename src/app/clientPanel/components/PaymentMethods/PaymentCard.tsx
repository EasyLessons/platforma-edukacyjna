'use client';

import { useState } from 'react';
import { Edit2, Trash2, CreditCard, Star, StarOff } from 'lucide-react';
import { PaymentMethod } from '../../types';

interface PaymentCardProps {
  paymentMethod: PaymentMethod;
  onEdit: (id: number, updatedMethod: Omit<PaymentMethod, 'id'>) => void;
  onDelete: (id: number) => void;
  onSetDefault: (id: number) => void;
}

const getCardIcon = (brand: string) => {
  const icons: Record<string, string> = {
    visa: '💳',
    mastercard: '💳',
    amex: '💳',
    discover: '💳',
  };
  return icons[brand] || '💳';
};

const getCardBrandName = (brand: string) => {
  const names: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
  };
  return names[brand] || 'Karta';
};

const getExpiryStatus = (month: number, year: number) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { status: 'expired', text: 'Wygasła', color: 'text-red-600' };
  } else if (year === currentYear && month <= currentMonth + 3) {
    return { status: 'expiring', text: 'Wygasa wkrótce', color: 'text-orange-600' };
  }
  return { status: 'valid', text: 'Ważna', color: 'text-green-600' };
};

export default function PaymentCard({
  paymentMethod,
  onEdit,
  onDelete,
  onSetDefault,
}: PaymentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    cardHolderName: paymentMethod.cardHolderName,
    expiryMonth: paymentMethod.expiryMonth,
    expiryYear: paymentMethod.expiryYear,
    isDefault: paymentMethod.isDefault,
  });

  const expiryStatus = getExpiryStatus(paymentMethod.expiryMonth, paymentMethod.expiryYear);

  const handleSave = () => {
    onEdit(paymentMethod.id, {
      ...paymentMethod,
      ...formData,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      cardHolderName: paymentMethod.cardHolderName,
      expiryMonth: paymentMethod.expiryMonth,
      expiryYear: paymentMethod.expiryYear,
      isDefault: paymentMethod.isDefault,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Czy na pewno chcesz usunąć tę metodę płatności?')) {
      onDelete(paymentMethod.id);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white text-xl">
            {getCardIcon(paymentMethod.brand)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">
                **** {paymentMethod.lastFourDigits}
              </span>
              <span className="text-sm text-gray-500">{getCardBrandName(paymentMethod.brand)}</span>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-sm text-gray-600">{paymentMethod.cardHolderName}</span>
              {paymentMethod.isDefault && (
                <div className="flex items-center gap-1">
                  <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  <span className="text-xs text-yellow-600 font-medium">Domyślna</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!paymentMethod.isDefault && (
            <button
              onClick={() => onSetDefault(paymentMethod.id)}
              className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-all"
              title="Ustaw jako domyślną"
            >
              <StarOff size={16} />
            </button>
          )}
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Edytuj metodę płatności"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Usuń metodę płatności"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Imię i nazwisko na karcie
              </label>
              <input
                type="text"
                value={formData.cardHolderName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cardHolderName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Miesiąc wygaśnięcia
                </label>
                <select
                  value={formData.expiryMonth}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, expiryMonth: parseInt(e.target.value) }))
                  }
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {month.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rok wygaśnięcia
                </label>
                <select
                  value={formData.expiryYear}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, expiryYear: parseInt(e.target.value) }))
                  }
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() + i).map(
                    (year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

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
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">
                Wygasa:{' '}
                <span className="font-medium">
                  {paymentMethod.expiryMonth.toString().padStart(2, '0')}/{paymentMethod.expiryYear}
                </span>
              </span>
              <div className={`text-sm font-medium ${expiryStatus.color} mt-1`}>
                {expiryStatus.text}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
