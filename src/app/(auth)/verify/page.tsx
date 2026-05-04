'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

function useAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userEncoded = searchParams.get('user');
    const error = searchParams.get('error');

    const sendToOpener = (message: object) => {
      window.opener?.postMessage(message, window.location.origin);
      window.close();
    };

    if (error || !token || !userEncoded) {
      if (window.opener) sendToOpener({ type: 'GOOGLE_AUTH_ERROR', error: error ?? 'Missing data' });
      else router.replace('/login');
      return;
    }

    try {
      const userData = JSON.parse(atob(userEncoded));
      if (window.opener) sendToOpener({ type: 'GOOGLE_AUTH_SUCCESS', token, userData });
      else { login(token, userData); router.replace('/dashboard'); }
    } catch {
      if (window.opener) sendToOpener({ type: 'GOOGLE_AUTH_ERROR', error: 'Invalid user data' });
      else router.replace('/login');
    }
  }, []);
}

function AuthCallbackContent() {
  useAuthCallback();
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Logowanie przez Google...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}