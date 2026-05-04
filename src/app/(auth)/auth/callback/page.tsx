'use client';

import { Suspense } from 'react';
import { useAuthCallback } from '@/_new/features/auth/hooks/useAuthCallback';

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