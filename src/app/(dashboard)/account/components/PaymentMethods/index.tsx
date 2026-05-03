'use client';

import { useState } from 'react';
import { Plus, CreditCard, Zap, MapPin } from 'lucide-react';
import PaymentCard from './PaymentCard';
import AddPaymentModal from './AddPaymentModal';
import { PaymentMethod } from '../../types';

// TODO: Integracja ze Stripe dla subskrypcji
// - Stripe Customer Portal dla zarządzania kartami
// - Stripe Subscriptions dla planów płatnych
// - Webhook handlers dla statusów płatności

export default function PaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState('');

  const handleAddPaymentMethod = (newMethod: Omit<PaymentMethod, 'id'>) => {
    // TODO: Integracja ze Stripe - dodanie karty przez Stripe Elements
    const method: PaymentMethod = {
      ...newMethod,
      id: Math.max(...(paymentMethods.length > 0 ? paymentMethods.map((p) => p.id) : [0])) + 1,
    };
    setPaymentMethods((prev) => [...prev, method]);
    setShowAddModal(false);
  };

  const handleEditPaymentMethod = (id: number, updatedMethod: Omit<PaymentMethod, 'id'>) => {
    setPaymentMethods((prev) =>
      prev.map((method) => (method.id === id ? { ...updatedMethod, id } : method))
    );
  };

  const handleDeletePaymentMethod = (id: number) => {
    setPaymentMethods((prev) => prev.filter((method) => method.id !== id));
  };

  const handleSetDefault = (id: number) => {
    setPaymentMethods((prev) =>
      prev.map((method) => ({
        ...method,
        isDefault: method.id === id,
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Metody płatności</h1>
        <p className="text-gray-600">
          Dodaj i zarządzaj swoimi metodami płatności za pomocą naszego bezpiecznego, szyfrowanego
          systemu płatności.
        </p>
      </div>

      {/* Główne płatności */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Główne płatności</h2>
        <div className="space-y-4">
          {paymentMethods.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Brak metod płatności</h3>
              <p className="text-gray-500 mb-4">
                Dodaj kartę płatniczą aby móc korzystać z płatnych funkcji platformy.
              </p>
              <p className="text-sm text-gray-400 flex items-center justify-center gap-1">
                <Zap size={16} />
                Przygotowujemy integrację ze Stripe dla bezpiecznych płatności
              </p>
            </div>
          ) : (
            paymentMethods.map((method) => (
              <PaymentCard
                key={method.id}
                paymentMethod={method}
                onEdit={handleEditPaymentMethod}
                onDelete={handleDeletePaymentMethod}
                onSetDefault={handleSetDefault}
              />
            ))
          )}
        </div>
      </div>

      {/* Przycisk dodania nowej metody płatności */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-3 py-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all group"
      >
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
          <Plus size={20} className="text-green-600" />
        </div>
        <span className="text-gray-700 font-medium group-hover:text-green-700">
          Dodaj metodę płatności
        </span>
      </button>

      {/* Adres używany do faktury */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Adres używany do faktury</h2>

        <div className="relative">
          <select
            value={selectedBillingAddress}
            onChange={(e) => setSelectedBillingAddress(e.target.value)}
            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 appearance-none bg-white"
          >
            <option value="">Wybierz adres</option>
            <option value="home">Adres główny - Pietkiewicza 6D/61, Białystok</option>
            <option value="work">Adres pracy - ul. Przykładowa 123, Warszawa</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <MapPin size={20} className="text-gray-400" />
          </div>
        </div>

        {selectedBillingAddress && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <MapPin size={16} />
              <span className="font-medium">Wybrany adres do faktury</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              {selectedBillingAddress === 'home'
                ? 'Pietkiewicza 6D/61, 15-689 Białystok, PL'
                : 'ul. Przykładowa 123, 00-000 Warszawa, PL'}
            </p>
          </div>
        )}
      </div>

      {/* Modal dodawania metody płatności */}
      <AddPaymentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddPaymentMethod}
      />
    </div>
  );
}
