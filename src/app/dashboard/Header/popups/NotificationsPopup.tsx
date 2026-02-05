'use client';

import { X, Check, Clock, Building } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  fetchPendingInvites,
  acceptInvite,
  rejectInvite,
  PendingInvite,
} from '@/workspace_api/api';
import { useWorkspaces } from '@/app/context/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/_new/shared/ui/button';

interface NotificationsPopupProps {
  onClose: () => void;
}

export default function NotificationsPopup({ onClose }: NotificationsPopupProps) {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingInvite, setProcessingInvite] = useState<number | null>(null);
  const { refreshWorkspaces } = useWorkspaces();

  useEffect(() => {
    loadInvites();

    // Realtime nasłuchiwanie nowych zaproszeń
    const channel = supabase
      .channel('workspace_invites_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workspace_invites',
        },
        (payload) => {
          console.log('🔔 Nowe zaproszenie:', payload);
          // Odśwież listę zaproszeń
          loadInvites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadInvites = async () => {
    try {
      setLoading(true);
      const data = await fetchPendingInvites();
      setInvites(data);
    } catch (error) {
      console.error('Błąd pobierania zaproszeń:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invite: PendingInvite) => {
    try {
      setProcessingInvite(invite.id);
      await acceptInvite(invite.invite_token);

      setInvites((prev) => prev.filter((inv) => inv.id !== invite.id));
      await refreshWorkspaces();
    } catch (error: any) {
      alert(error.message || 'Błąd akceptowania zaproszenia');
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleReject = async (invite: PendingInvite) => {
    try {
      setProcessingInvite(invite.id);
      await rejectInvite(invite.invite_token);

      setInvites((prev) => prev.filter((inv) => inv.id !== invite.id));
    } catch (error: any) {
      alert(error.message || 'Błąd odrzucania zaproszenia');
    } finally {
      setProcessingInvite(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'przed chwilą';
    if (diffMins < 60) return `${diffMins} min temu`;
    if (diffHours < 24) return `${diffHours} godz. temu`;
    if (diffDays < 7) return `${diffDays} dni temu`;

    return date.toLocaleDateString('pl-PL');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/15 backdrop-blur-sm z-[100]" onClick={onClose} />

      <div
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[101] overflow-hidden flex flex-col animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Powiadomienia</h2>
            {invites.length > 0 && (
              <p className="text-sm text-gray-600 mt-0.5">
                {invites.length} {invites.length === 1 ? 'zaproszenie' : 'zaproszeń'}
              </p>
            )}
          </div>
          <Button variant="secondary" size="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : invites.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {invites.map((invite) => (
                <div key={invite.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex gap-3">
                    <div
                      className={`flex-shrink-0 w-12 h-12 ${invite.workspace_bg_color} rounded-lg flex items-center justify-center text-white`}
                    >
                      <Building size={24} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-800 text-sm mb-1">
                            Zaproszenie do workspace
                          </h3>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">{invite.inviter_name}</span> zaprasza Cię
                            do <span className="font-medium">{invite.workspace_name}</span>
                          </p>
                        </div>
                        <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-1.5"></span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                        <Clock size={12} />
                        <span>{formatDate(invite.created_at)}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAccept(invite)}
                          loading={processingInvite === invite.id}
                          className="flex-1"
                        >
                          {processingInvite === invite.id ? 'Akceptuję...' : 'Akceptuj'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleReject(invite)}
                          disabled={processingInvite === invite.id}
                          className="flex-1"
                        >
                          Odrzuć
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Brak zaproszeń</h3>
              <p className="text-sm text-gray-500">
                Nie masz żadnych oczekujących zaproszeń do workspace'ów
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
