import { LoginForm } from "@/_new/features/auth/components/loginForm";
import { AuthLayout } from "@/_new/features/auth/components/authLayout";

export default function LoginPage() {
  return (
    <AuthLayout title="Witaj ponownie!">
      <LoginForm />
    </AuthLayout>
  );
}