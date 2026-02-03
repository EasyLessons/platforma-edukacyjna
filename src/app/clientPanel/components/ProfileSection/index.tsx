'use client';

import { useAuth } from '../../../context/AuthContext';
import BasicInfo from './BasicInfo';
import SecurityInfo from './SecurityInfo';
import LocalizationInfo from './LocalizationInfo';

export default function ProfileSection() {
  const { user } = useAuth();
  return (
    <div className="space-y-8">
      {/* Nagłówek */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Profil</h1>
        <p className="text-gray-600">
          Zarządzaj informacjami, aby Spaceship działał lepiej dla Ciebie.
        </p>
      </div>

      {/* Sekcje */}
      <BasicInfo user={user} />
      <SecurityInfo />
      <LocalizationInfo />
    </div>
  );
}
