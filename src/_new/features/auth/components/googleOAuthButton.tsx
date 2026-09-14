'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/_new/lib/auth';
import { loginWithGoogle } from '../api/authApi';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';

export function GoogleOAuthButton() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const { handleError } = useErrorHandler();

  return (
    <>
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          if (!credentialResponse.credential) return;
          try {
            const response = await loginWithGoogle(credentialResponse.credential);
            authLogin(response.access_token, response.user);
            router.push('/dashboard');
          } catch (err) {
            await handleError(err);
          }
        }}
        onError={() => handleError(new Error('Logowanie przez Google nie powiodło się.'))}
      />
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-gray-300" />
        <span className="flex-shrink mx-4 text-gray-400 text-sm font-light">lub</span>
        <div className="flex-grow border-t border-gray-300" />
      </div>
    </>
  );
}
