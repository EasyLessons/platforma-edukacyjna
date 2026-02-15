'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    console.log('🔍 Callback page - pełne URL:', window.location.href);
    
    const token = searchParams.get('token');
    const userEncoded = searchParams.get('user');

    console.log('🔍 Token z URL:', token ? '✅ Jest' : '❌ Brak');
    console.log('🔍 User z URL:', userEncoded ? '✅ Jest' : '❌ Brak');
    console.log('🔍 window.opener:', window.opener ? '✅ Jest (POPUP)' : '❌ Brak (główne okno)');

    if (token && userEncoded) {
      try {
        // Odkoduj dane użytkownika z base64
        const userJson = atob(userEncoded);
        const userData = JSON.parse(userJson);
        
        console.log('✅ Odkodowano userData:', userData);

        // Jeśli to popup window - wyślij token i userData do parent window
        if (window.opener) {
          console.log('📤 WYSYŁAM postMessage do parent window...');
          window.opener.postMessage(
            { type: 'GOOGLE_AUTH_SUCCESS', token, userData },
            window.location.origin
          );
          console.log('✅ postMessage wysłany! Zamykam popup...');
          window.close();
        } else {
          // Jeśli to główne okno - zapisz token i userData, następnie przekieruj
          console.log('💾 Zapisuję do localStorage (główne okno)...');
          localStorage.setItem('access_token', token);
          localStorage.setItem('user', JSON.stringify(userData));
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('❌ Błąd dekodowania danych użytkownika:', error);
        if (window.opener) {
          window.opener.postMessage(
            { type: 'GOOGLE_AUTH_ERROR', error: 'Invalid user data' },
            window.location.origin
          );
          window.close();
        } else {
          window.location.href = '/login';
        }
      }
    } else {
      // Brak tokenu lub danych użytkownika - błąd
      console.error('❌ Brak token lub user w URL!');
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_ERROR', error: 'No token or user data received' },
          window.location.origin
        );
        window.close();
      } else {
        window.location.href = '/login';
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Logowanie przez Google...</p>
      </div>
    </div>
  );
}
