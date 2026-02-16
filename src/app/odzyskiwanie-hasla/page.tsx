import { PasswordResetForm } from "@new/features/auth/components/password-reset-form";
import { AuthLayout } from "@/_new/features/auth/components/auth-layout";

export default function LoginPage() {
  return (
    <AuthLayout title="Odzyskiwanie hasła" showBackToLogin showGoogle={false}>
      <PasswordResetForm />
    </AuthLayout>
  );
}