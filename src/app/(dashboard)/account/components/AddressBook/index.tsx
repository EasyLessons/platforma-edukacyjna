'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import AddressCard from './AddressCard';
import AddAddressModal from './AddAddressModal';
import { Address } from '../../types';

// Przykładowe dane
const mockAddresses: Address[] = [
  {
    id: 1,
    label: 'Adres główny',
    fullName: 'Whiteslope Studio',
    street: 'Pietkiewicza 6D/61',
    city: 'Białystok',
    state: 'Podlaskie',
    zipCode: '15-689',
    country: 'PL',
    email: 'whiteslopestudio@gmail.com',
    phone: '+48 123 123 123',
    isDefault: true,
  },
];

export default function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddAddress = (newAddress: Omit<Address, 'id'>) => {
    const address: Address = {
      ...newAddress,
      id: Math.max(...addresses.map((a) => a.id)) + 1,
    };
    setAddresses((prev) => [...prev, address]);
    setShowAddModal(false);
  };

  const handleEditAddress = (id: number, updatedAddress: Omit<Address, 'id'>) => {
    setAddresses((prev) => prev.map((addr) => (addr.id === id ? { ...updatedAddress, id } : addr)));
  };

  const handleDeleteAddress = (id: number) => {
    setAddresses((prev) => prev.filter((addr) => addr.id !== id));
  };

  const handleSetDefault = (id: number) => {
    setAddresses((prev) =>
      prev.map((addr) => ({
        ...addr,
        isDefault: addr.id === id,
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Książka adresowa</h1>
        <p className="text-gray-600">Zarządzaj swoimi adresami do dostawy i fakturowania.</p>
      </div>

      {/* Lista adresów */}
      <div className="space-y-4">
        {addresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            onEdit={handleEditAddress}
            onDelete={handleDeleteAddress}
            onSetDefault={handleSetDefault}
          />
        ))}
      </div>

      {/* Przycisk dodania nowego adresu */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-3 py-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all group"
      >
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
          <Plus size={20} className="text-green-600" />
        </div>
        <span className="text-gray-700 font-medium group-hover:text-green-700">
          Dodaj nowy adres
        </span>
      </button>

      {/* Modal dodawania adresu */}
      <AddAddressModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddAddress}
      />
    </div>
  );
}
