'use client';

import { useState } from 'react';
import { User, Settings, MapPin, CreditCard, Shield, ChevronRight } from 'lucide-react';
import { ActiveSection } from '../types';

interface SidebarProps {
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;
  isMobile?: boolean;
}

const menuItems = [
  {
    id: 'profile' as ActiveSection,
    label: 'Profil',
    icon: User,
    description: 'Podstawowe informacje i ustawienia konta',
  },
  {
    id: 'addresses' as ActiveSection,
    label: 'Książka adresowa',
    icon: MapPin,
    description: 'Zarządzaj swoimi adresami',
  },
  {
    id: 'payments' as ActiveSection,
    label: 'Metody płatności',
    icon: CreditCard,
    description: 'Karty i sposoby płatności',
  },
  {
    id: 'security' as ActiveSection,
    label: 'Centrum bezpieczeństwa',
    icon: Shield,
    description: 'Hasło i zabezpieczenia konta',
  },
];

export default function Sidebar({
  activeSection,
  setActiveSection,
  isMobile = false,
}: SidebarProps) {
  if (isMobile) {
    return (
      <div className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-green-50 text-green-700 border-l-4 border-green-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-green-600' : 'text-gray-500'} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Panel klienta</h1>
        <p className="text-sm text-gray-600">Zarządzaj swoim kontem i ustawieniami</p>
      </div>

      {/* Navigation */}
      <div className="p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full text-left p-4 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-green-50 border-2 border-green-200 shadow-sm'
                  : 'hover:bg-gray-50 border-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                  }`}
                >
                  <Icon size={20} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3
                      className={`font-medium text-sm ${
                        isActive ? 'text-green-700' : 'text-gray-900'
                      }`}
                    >
                      {item.label}
                    </h3>
                    <ChevronRight
                      size={16}
                      className={`transition-transform ${
                        isActive
                          ? 'text-green-600 transform rotate-90'
                          : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                    {item.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="p-6 border-t border-gray-200 mt-auto">
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-1">Potrzebujesz pomocy?</h4>
          <p className="text-xs text-blue-700 mb-3">Skontaktuj się z naszym zespołem wsparcia</p>
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 px-3 rounded-lg transition-colors">
            Centrum pomocy
          </button>
        </div>
      </div>
    </div>
  );
}
