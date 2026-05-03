'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmailVerificationForm } from "@/_new/features/auth/components/emailVerificationForm";
import { AuthLayout } from "@/_new/features/auth/components/authLayout";

function VerifyContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const email = searchParams.get('email');

  if (!userId || !email) return null;

  return (
    <AuthLayout title="Weryfikacja" showBackToLogin showGoogle={false}>
      <EmailVerificationForm userId={userId} email={email} />
    </AuthLayout>
  );
}

export default function EmailVerificationPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}