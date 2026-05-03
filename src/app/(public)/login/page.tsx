"use client";

import { Suspense } from "react";
import { LoginForm } from "@/_new/features/auth/components/loginForm";
import { AuthLayout } from "@/_new/features/auth/components/authLayout";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const autoStartGoogle = searchParams.get('google') === '1';

  return (
    <AuthLayout title="Witaj ponownie!" autoStartGoogle={autoStartGoogle}>
      <LoginForm />
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}