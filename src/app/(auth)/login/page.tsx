import { LoginForm } from '@/_new/features/auth/components/loginForm';
import { GoogleOAuthButton } from '@/_new/features/auth/components/googleOAuthButton';

export default function Page() {
  return (
    <>
      <h2 className="text-2xl font-light text-gray-900 text-center mb-6">Witaj ponownie!</h2>
      <GoogleOAuthButton />
      <LoginForm />
    </>
  );
}
