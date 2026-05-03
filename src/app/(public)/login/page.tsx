"use client";

import { LoginForm } from "@/_new/features/auth/components/loginForm";
import { AuthLayout } from "@/_new/features/auth/components/authLayout";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const autoStartGoogle = searchParams.get('google') === '1';

  return (
    <AuthLayout title="Witaj ponownie!" autoStartGoogle={autoStartGoogle}>
      <LoginForm />
    </AuthLayout>
  );
}