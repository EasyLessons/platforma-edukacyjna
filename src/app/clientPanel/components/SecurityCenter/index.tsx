'use client';

import PasswordSection from './PasswordSection';
import LoginMethods from './LoginMethods';

export default function SecurityCenter() {
  return (
    <div className="space-y-8">
      {/* Nagłówek */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Centrum bezpieczeństwa</h1>
        <p className="text-gray-600">
          Zarządzaj zabezpieczeniami swojego konta i metodami logowania.
        </p>
      </div>

      {/* Sekcje */}
      <PasswordSection />
      <LoginMethods />
    </div>
  );
}