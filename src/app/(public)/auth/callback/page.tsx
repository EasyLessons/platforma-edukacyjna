'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userEncoded = searchParams.get('user');
    const error = searchParams.get('error');

    if (error) {
      console.error('❌ Google OAuth error:', error);
      if (window.opener) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error }, window.location.origin);
        window.close();
      } else {
        router.replace('/login');
      }
      return;
    }

    if (!token || !userEncoded) {
      console.error('❌ Brak token lub user w URL!');
      if (window.opener) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: 'No token or user data received' }, window.location.origin);
        window.close();
      } else {
        router.replace('/login');
      }
      return;
    }

    try {
      const userJson = atob(userEncoded);
      const userData = JSON.parse(userJson);

      if (window.opener) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token, userData }, window.location.origin);
        window.close();
      } else {
        login(token, userData);
        router.replace('/dashboard');
      }
    } catch (err) {
      console.error('❌ Błąd dekodowania danych:', err);
      if (window.opener) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: 'Invalid user data' }, window.location.origin);
        window.close();
      } else {
        router.replace('/login');
      }
    }
  }, [searchParams, router, login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Logowanie przez Google...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}