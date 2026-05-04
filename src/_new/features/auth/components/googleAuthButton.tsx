'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FcGoogle } from 'react-icons/fc';
import { Button } from '@/_new/shared/ui/button';
import { useAuth } from '@/app/context/AuthContext';

function useGoogleAuth() {
  const { login: authLogin } = useAuth();
  const router = useRouter();

  const getGoogleAuthUrl = () =>
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/auth/google`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        authLogin(event.data.token, event.data.userData);
        router.push('/dashboard');
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        alert('Błąd logowania przez Google. Spróbuj ponownie.');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoogleLogin = () => {
    const width = 520, height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      getGoogleAuthUrl(),
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    if (!popup) alert('Nie udało się otworzyć okna logowania. Sprawdź blokowanie wyskakujących okien.');
  };

  return { handleGoogleLogin };
}

export function GoogleAuthButton() {
  const { handleGoogleLogin } = useGoogleAuth();

  return (
    <>
      <Button
        variant="outline"
        onClick={handleGoogleLogin}
        leftIcon={<FcGoogle className="w-5 h-5" />}
        className="w-full"
      >
        Kontynuuj za pomocą konta Google
      </Button>
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-gray-300" />
        <span className="flex-shrink mx-4 text-gray-400 text-sm font-light">lub</span>
        <div className="flex-grow border-t border-gray-300" />
      </div>
    </>
  );
}