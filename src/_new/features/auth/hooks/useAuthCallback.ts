import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

export function useAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userEncoded = searchParams.get('user');
    const error = searchParams.get('error');

    const sendToOpener = (message: object) => {
      window.opener?.postMessage(message, window.location.origin);
      window.close();
    };

    if (error || !token || !userEncoded) {
      if (window.opener) sendToOpener({ type: 'GOOGLE_AUTH_ERROR', error: error ?? 'Missing data' });
      else router.replace('/login');
      return;
    }

    try {
      const userData = JSON.parse(atob(userEncoded));
      if (window.opener) sendToOpener({ type: 'GOOGLE_AUTH_SUCCESS', token, userData });
      else { login(token, userData); router.replace('/dashboard'); }
    } catch {
      if (window.opener) sendToOpener({ type: 'GOOGLE_AUTH_ERROR', error: 'Invalid user data' });
      else router.replace('/login');
    }
  }, []);
}