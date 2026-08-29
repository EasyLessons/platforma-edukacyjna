'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { previewShareLink, joinShareLink } from '@/_new/features/workspace/api/shareLinkApi';
import type { ShareLinkPreview } from '@/_new/features/workspace/types';
import { useAuth } from '@/_new/lib/auth';
import { Check, X, Loader2 } from 'lucide-react';

export default function JoinPage() {
  const { token } = useParams();
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [status, setStatus] = useState<'preview' | 'loading' | 'success' | 'error'>('loading');
  const [preview, setPreview] = useState<ShareLinkPreview | null>(null);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    // Jeśli niezalogowany, przekieruj do logowania
    if (!isLoggedIn) {
      router.push(`/login?redirect=/join/${token}`);
      return;
    }

    const loadPreview = async () => {
      try {
        const result = await previewShareLink(token as string);
        setPreview(result);
        setStatus('preview');
      } catch (error: any) {
        setStatus('error');
        setMessage(error.message || 'Błąd wczytywania linku');
      }
    };

    loadPreview();
  }, [token, isLoggedIn, router]);

  const redirectAfterJoin = (workspace_id: number, board_id: number | null) => {
    if (board_id) {
      router.push(`/whiteboard?boardId=${board_id}&workspace=${workspace_id}`);
    } else {
      router.push(`/dashboard`);
    }
  };

  const handleJoin = async () => {
    if (!token) return;
    setJoining(true);
    try {
      const result = await joinShareLink(token as string);
      setStatus('success');
      setMessage(result.message);
      setTimeout(() => {
        redirectAfterJoin(result.workspace_id, result.board_id);
      }, 1500);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || "Błąd dołączania do workspace'a");
    } finally {
      setJoining(false);
    }
  };

  const handleContinue = () => {
    if (!preview) return;
    redirectAfterJoin(preview.workspace_id, preview.board_id);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {status === 'loading' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Sprawdzanie linku...</h2>
          </div>
        )}

        {status === 'preview' && preview && !preview.already_member && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Dołącz do przestrzeni</h2>
            <p className="text-gray-600 mb-6">
              Dołączasz do przestrzeni <strong>{preview.workspace_name}</strong>.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:opacity-50"
              >
                {joining ? 'Dołączanie...' : 'Dołącz'}
              </button>
            </div>
          </div>
        )}

        {status === 'preview' && preview && preview.already_member && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Już jesteś członkiem</h2>
            <p className="text-gray-600 mb-6">
              Jesteś już częścią przestrzeni <strong>{preview.workspace_name}</strong>.
            </p>
            <button
              onClick={handleContinue}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors"
            >
              {preview.board_name ? 'Przejdź do tablicy' : 'Przejdź do dashboardu'}
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Dołączono!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Przekierowywanie...</span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Błąd</h2>
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
