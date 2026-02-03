'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
// 🔥 POPRAWIONA ŚCIEŻKA - idź 1 poziom wyżej, potem do context
import { useAuth } from '../context/AuthContext'; // ✅ POPRAWNA ŚCIEŻKA!

export default function AuthHeader() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    console.log('🚪 Wylogowywanie...');
    logout();
    console.log('✅ Wylogowano!');
    router.push('/');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/resources/LogoEasyLesson.webp"
                alt="EasyLesson Logo"
                width={160}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <span className="text-gray-600 text-sm">
                Witaj, <strong>{user.username}</strong>!
              </span>
            )}

            <Link
              href="#pricing"
              className="text-gray-700 hover:text-gray-900 font-medium transition-colors duration-200"
            >
              Ceny
            </Link>

            <Link href="/dashboard">
              <button className="px-4 py-2 text-gray-700 font-medium hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200">
                Panel
              </button>
            </Link>

            <button
              onClick={handleLogout}
              className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
