'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { EmailVerificationForm } from "@new/features/auth/components/email-verification-form";
import { AuthLayout } from "@/_new/features/auth/components/auth-layout";

export default function EmailVerificationPage() {
  const router = useRouter();
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
