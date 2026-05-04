import { RegisterForm } from '@new/features/auth/components/registerForm';
import { GoogleAuthButton } from '@/_new/features/auth/components/googleAuthButton';

export default function Page() {
  return (
    <>
      <h2 className="text-2xl font-light text-gray-900 text-center mb-6">Zarejestruj się!</h2>
      <GoogleAuthButton />
      <RegisterForm />
    </>
  );
}
