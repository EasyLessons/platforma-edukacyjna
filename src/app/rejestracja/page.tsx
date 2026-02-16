import { RegisterForm } from "@new/features/auth/components/register-form";
import { AuthLayout } from "@/_new/features/auth/components/auth-layout";

export default function LoginPage() {
  return (
    <AuthLayout title="Zarejestruj się!">
      <RegisterForm />
    </AuthLayout>
  );
}