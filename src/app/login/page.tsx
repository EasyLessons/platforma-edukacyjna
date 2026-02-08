import { LoginForm } from "@new/features/auth/components/login-form";
import { AuthLayout } from "@/_new/features/auth/components/auth-layout";

export default function LoginPage() {
  return (
    <AuthLayout title="Witaj ponownie!">
      <LoginForm />
    </AuthLayout>
  );
}