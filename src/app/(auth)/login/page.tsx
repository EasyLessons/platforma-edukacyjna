import { LoginForm } from '@/_new/features/auth/components/loginForm';
import { GoogleAuthButton } from '@/_new/features/auth/components/googleAuthButton';

export default function Page() {
  return (
    <>
      <h2 className="text-2xl font-light text-gray-900 text-center mb-6">Witaj ponownie!</h2>
      <GoogleAuthButton />
      <LoginForm />
    </>
  );
}
