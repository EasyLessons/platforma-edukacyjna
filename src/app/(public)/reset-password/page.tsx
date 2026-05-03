import { PasswordResetForm } from "@/_new/features/auth/components/passwordResetForm";
import { AuthLayout } from "@/_new/features/auth/components/authLayout";

export default function LoginPage() {
  return (
    <AuthLayout title="Odzyskiwanie hasła" showBackToLogin showGoogle={false}>
      <PasswordResetForm />
    </AuthLayout>
  );
}