'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { acceptInvite } from '@/workspace_api/api';
import { useAuth } from '@/app/context/AuthContext';
import { Check, X, Loader2 } from 'lucide-react';

export default function InvitePage() {
  const { token } = useParams();
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    // Jeśli niezalogowany, przekieruj do logowania
    if (!isLoggedIn) {
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    // Automatycznie akceptuj zaproszenie
    const acceptInvitation = async () => {
      try {
        const result = await acceptInvite(token as string);
        setStatus('success');
        setMessage(result.message);

        // Przekieruj do workspace po 2 sekundach
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (error: any) {
        setStatus('error');
        setMessage(error.message || 'Błąd akceptowania zaproszenia');
      }
    };

    acceptInvitation();
  }, [token, isLoggedIn, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {status === 'loading' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Przetwarzanie zaproszenia...</h2>
            <p className="text-gray-600">Dodajemy Cię do workspace'a</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">🎉 Sukces!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Przekierowywanie do dashboardu...</span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">❌ Błąd</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors"
            >
              Przejdź do dashboardu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
