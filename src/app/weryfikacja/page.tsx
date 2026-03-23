'use client';

import { useSearchParams } from 'next/navigation';

import { EmailVerificationForm } from "@/_new/features/auth/components/emailVerificationForm";
import { AuthLayout } from "@/_new/features/auth/components/authLayout";

export default function EmailVerificationPage() {
  const searchParams = useSearchParams();

  // Pobierz dane z URL
  const userId = searchParams.get('userId');
  const email = searchParams.get('email');

  if (!userId || !email) {
    return;
  }
  
  return (
    <AuthLayout title="Weryfikacja" showBackToLogin showGoogle={false}>
      <EmailVerificationForm userId={userId} email={email} />
    </AuthLayout>
  );
}
