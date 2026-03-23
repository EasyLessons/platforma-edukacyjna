/**
 * AUTH LAYOUT
 *
 * Layout dla podstron autoryzacji. Wszystkie dzielą wspólny.
 * Można rozbudowywać design bez ingerencji w formularze.
 * Formularze są wydzielonym komponentem aplikacji. Można je reużywać w innych miejscach.
 * 
*/
'use client'

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { ReactNode } from 'react';
import { Button } from '@new/shared/ui/button';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '@/app/context/AuthContext';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showHelpLink?: boolean;
  showBackToLogin?: boolean;
  showGoogle?: boolean;
}

export function AuthLayout({
  title,
  subtitle,
  children,
  showHelpLink = false,
  showBackToLogin = false,
  showGoogle = true,
}: AuthLayoutProps) {
  const { login: authLogin } = useAuth();
  
  // Blokada przewijania
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // Nasłuchuj na wiadomości z Google OAuth popup
  useEffect(() => {
    console.log('👂 auth-layout: Nasluchuję na wiadomości postMessage...');
    
    const handleMessage = (event: MessageEvent) => {
      console.log('📨 auth-layout: Otrzymano wiadomość!', {
        origin: event.origin,
        expectedOrigin: window.location.origin,
        type: event.data?.type,
        hasToken: !!event.data?.token,
        hasUserData: !!event.data?.userData
      });
      
      // Sprawdź origin dla bezpieczeństwa
      if (event.origin !== window.location.origin) {
        console.warn('⚠️ auth-layout: Zły origin, ignoruję wiadomość');
        return;
      }

      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        const { token, userData } = event.data;
        
        console.log('✅ auth-layout: GOOGLE_AUTH_SUCCESS!');
        console.log('📝 Token otrzymany:', token?.substring(0, 20) + '...');
        console.log('📝 UserData otrzymany:', userData);
        
        // Użyj AuthContext.login() - to robi wszystko prawidłowo!
        authLogin(token, userData);
        
        console.log('✅ authLogin() wywołany! Przekierowuję na /dashboard...');
        
        // Przekieruj natychmiast
        window.location.href = '/dashboard';
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        console.error('❌ auth-layout: GOOGLE_AUTH_ERROR:', event.data.error);
        alert('Błąd logowania przez Google. Spróbuj ponownie.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      console.log('🔇 auth-layout: Przestaję nasłuchiwać');
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Handler logowania Google
  const handleGoogleLogin = () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const authUrl = `${baseUrl}/api/v1/auth/google`;
    
    console.log('🚀 Otwieram Google OAuth popup:', authUrl);
    
    const width = 520;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    if (!popup) {
      console.error('❌ Nie udało się otworzyć popup! (popup blocker?)');
      alert('Nie udało się otworzyć okna logowania. Sprawdź blokowanie wyskakujących okien.');
    } else {
      console.log('✅ Popup otwarty pomyślnie');
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden bg-white">
      {/* Gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Zielonkawy - lewy górny */}
        <div
          className="absolute -top-64 -left-64 w-[1200px] h-[1200px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              'radial-gradient(circle, rgba(134, 239, 172, 0.6) 0%, rgba(134, 239, 172, 0) 70%)',
          }}
        />

        {/* Niebieski - prawy górny */}
        <div
          className="absolute -top-80 -right-80 w-[1100px] h-[1100px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              'radial-gradient(circle, rgba(147, 197, 253, 0.9) 0%, rgba(147, 197, 253, 0) 70%)',
          }}
        />

        {/* Żółty - lewy dół */}
        <div
          className="absolute -bottom-100 -left-100 w-[1000px] h-[1000px] rounded-full opacity-35 blur-[120px]"
          style={{
            background:
              'radial-gradient(circle, rgba(253, 224, 71, 0.1) 0%, rgba(253, 224, 71, 0) 70%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6 -mt-40">
        {/* Logo */}
        <div className="text-center mb-10">
          <Image
            src="/resources/LogoEasyLesson.webp"
            alt="EasyLesson"
            width={200}
            height={60}
            className="mx-auto"
          />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-light text-gray-900 text-center mb-6">{title}</h2>

        {/* Subtitle (optional) */}
        {subtitle && <p className="text-center text-gray-600 font-light mb-8">{subtitle}</p>}

        {/* Google */}
        {showGoogle && (
          <div>
            <Button
              variant="outline"
              onClick={handleGoogleLogin}
              leftIcon={<FcGoogle className="w-5 h-5" />}
              className="w-full"
            >
              Kontynuuj za pomocą konta Google
            </Button>

            <div className="relative flex items-center py-0">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-sm font-light">lub</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
          </div>
        )}

        {/* Form */}
        {children}
      </div>

      {/* Help link at bottom */}
      {showHelpLink && (
        <div className="absolute bottom-6 left-0 right-0 text-center z-10">
          <Link
            href="#"
            className="hover-shine text-sm text-gray-600 font-light hover:text-gray-900 hover:underline transition-colors hover:cursor-pointer"
          >
            Potrzebujesz pomocy?
          </Link>
        </div>
      )}

      {/* Back to login link */}
      {showBackToLogin && (
        <div className="absolute bottom-6 left-0 right-0 text-center z-10">
          <Link
            href="/login"
            className="hover-shine text-sm text-gray-600 font-light hover:text-gray-900 hover:underline transition-colors hover:cursor-pointer"
          >
            Powrót do logowania
          </Link>
        </div>
      )}
    </div>
  );
}
