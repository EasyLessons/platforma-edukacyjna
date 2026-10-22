'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/_new/lib/auth';
import { loginWithGoogle } from '../api/authApi';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';

const GOOGLE_BUTTON_MAX_WIDTH = 400;

export function GoogleOAuthButton() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const { handleError } = useErrorHandler({ onError: setErrorMessage });

  const containerRef = useRef<HTMLDivElement>(null);
  const [buttonWidth, setButtonWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      setButtonWidth(Math.min(containerRef.current.clientWidth, GOOGLE_BUTTON_MAX_WIDTH));
    }
  }, []);

  return (
    <>
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center font-light">
          {errorMessage}
        </div>
      )}
      <div ref={containerRef} className="w-full min-h-10">
        {buttonWidth !== null && (
          <GoogleLogin
            width={buttonWidth}
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
        )}
      </div>
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-gray-300" />
        <span className="flex-shrink mx-4 text-gray-400 text-sm font-light">lub</span>
        <div className="flex-grow border-t border-gray-300" />
      </div>
    </>
  );
}
