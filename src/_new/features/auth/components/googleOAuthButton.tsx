'use client';

import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/_new/lib/auth';
import { loginWithGoogle } from '../api/authApi';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import { TermsNotice } from './termsNotice';

export function GoogleOAuthButton() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const { handleError } = useErrorHandler({ onError: setErrorMessage });

  return (
    <>
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center font-light">
          {errorMessage}
        </div>
      )}
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          if (!credentialResponse.credential) return;
          setErrorMessage('');
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
      <TermsNotice action="Kontynuując" className="mt-2" />
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-gray-300" />
        <span className="flex-shrink mx-4 text-gray-400 text-sm font-light">lub</span>
        <div className="flex-grow border-t border-gray-300" />
      </div>
    </>
  );
}
