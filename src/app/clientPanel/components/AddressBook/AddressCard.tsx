'use client';

import { useState } from 'react';
import { Edit2, Trash2, MapPin, Phone, Mail, Star, StarOff } from 'lucide-react';
import { Address } from '../../types';

interface AddressCardProps {
  address: Address;
  onEdit: (id: number, updatedAddress: Omit<Address, 'id'>) => void;
  onDelete: (id: number) => void;
  onSetDefault: (id: number) => void;
}

export default function AddressCard({ address, onEdit, onDelete, onSetDefault }: AddressCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    label: address.label,
    fullName: address.fullName,
    street: address.street,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    country: address.country,
    email: address.email || '',
    phone: address.phone || '',
    isDefault: address.isDefault
  });

  const handleSave = () => {
    onEdit(address.id, formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      label: address.label,
      fullName: address.fullName,
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
      email: address.email || '',
      phone: address.phone || '',
      isDefault: address.isDefault
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Czy na pewno chcesz usunąć ten adres?')) {
      onDelete(address.id);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <MapPin size={20} className="text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{address.label}</h3>
            {address.isDefault && (
              <div className="flex items-center gap-1 mt-1">
                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                <span className="text-xs text-yellow-600 font-medium">Adres domyślny</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!address.isDefault && (
            <button
              onClick={() => onSetDefault(address.id)}
              className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-all"
              title="Ustaw jako domyślny"
            >
              <StarOff size={16} />
            </button>
          )}
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Edytuj adres"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Usuń adres"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nazwa adresu
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Imię i nazwisko / Nazwa firmy
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ulica i numer
            </label>
            <input
              type="text"
              value={formData.street}
              onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Miasto
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Województwo
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kod pocztowy
              </label>
              <input
                type="text"
                value={formData.zipCode}
                onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
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
        <div className="space-y-3">
          <div className="text-gray-900 font-medium">
            {address.fullName}
          </div>
          <div className="text-gray-700">
            {address.street}<br />
            {address.city}, {address.state}, {address.zipCode}<br />
            {address.country}
          </div>
          
          {address.email && (
            <div className="flex items-center gap-2 text-gray-600">
              <Mail size={14} />
              <span className="text-sm">{address.email}</span>
            </div>
          )}
          
          {address.phone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone size={14} />
              <span className="text-sm">{address.phone}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}