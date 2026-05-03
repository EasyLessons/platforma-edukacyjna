import { RegisterForm } from "@/_new/features/auth/components/registerForm";
import { AuthLayout } from "@/_new/features/auth/components/authLayout";

export default function LoginPage() {
  return (
    <AuthLayout title="Zarejestruj się!">
      <RegisterForm />
    </AuthLayout>
  );
}