'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmailVerificationForm } from '@/_new/features/auth/components/emailVerificationForm';

function VerifyContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') ?? '';
  const email = searchParams.get('email') ?? '';

  return <EmailVerificationForm userId={userId} email={email} />;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}