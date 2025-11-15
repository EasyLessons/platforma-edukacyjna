'use client';

import { useState, useEffect } from 'react';
import { Mail, X, UserPlus, Search, Check, AlertCircle, Clock } from 'lucide-react';
import { createInvite } from '@/workspace_api/api';
import { checkUserInviteStatus, UserSearchResult, getToken, searchUsers } from '@/auth_api/api';

interface InvitePopupProps {
  onClose: () => void;
  workspaceId: number;
  workspaceName: string;
}

interface UserWithStatus extends UserSearchResult {
  is_member?: boolean;
  has_pending_invite?: boolean;
  can_invite?: boolean;
  status_checked?: boolean;
}

export default function InvitePopup({ onClose, workspaceId, workspaceName }: InvitePopupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<number | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<number[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (searchQuery.length < 2) {
      setUsers([]);
      setError('');
      return;
    }

    const searchUsersDebounced = async () => {
      try {
        setLoading(true);
        setError('');

        const results = await searchUsers(searchQuery, 10);
        console.log('✅ Search results:', results);

        const usersWithStatus = await Promise.all(
          results.map(async (user: any) => {
            try {
              const status = await checkUserInviteStatus(workspaceId, user.id);
              return { ...user, ...status, status_checked: true };
            } catch (err) {
              console.warn('⚠️ Status check failed for user:', user.id, err);
              return { ...user, status_checked: false };
            }
          })
        );

        setUsers(usersWithStatus);

      } catch (error: any) {
        console.error('❌ Search error:', error);
        setError(error.message || 'Nieznany błąd wyszukiwania');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsersDebounced, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, workspaceId]);

  const handleInvite = async (userId: number) => {
    try {
      setInviting(userId);
      setError('');

      await createInvite(workspaceId, userId);

      setInvitedUsers(prev => [...prev, userId]);

      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, has_pending_invite: true, can_invite: false }
          : u
      ));

      setTimeout(() => {
        setInvitedUsers(prev => prev.filter(id => id !== userId));
      }, 3000);

    } catch (error: any) {
      setError(error.message || 'Błąd wysyłania zaproszenia');
      console.error('Błąd wysyłania zaproszenia:', error);
    } finally {
      setInviting(null);
    }
  };

  const getUserStatusBadge = (user: UserWithStatus) => {
    if (!user.status_checked) return null;
    if (user.is_member)
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
          <Check size={12} />
          <span>Członek</span>
        </div>
      );
    if (user.has_pending_invite)
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
          <Clock size={12} />
          <span>Zaproszony</span>
        </div>
      );
    return null;
  };

  const getInviteButtonContent = (user: UserWithStatus) => {
    const justInvited = invitedUsers.includes(user.id);
    const isInviting = inviting === user.id;

    if (isInviting) return <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div><span>Wysyłanie...</span></>;
    if (justInvited) return <><Check size={16} /><span>Wysłano!</span></>;
    return <><UserPlus size={16} /><span>Zaproś</span></>;
  };

  return (
    <div className="fixed inset-0 bg-black/15 backdrop-blur-sm flex items-center justify-center z-[100] px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Zaproś użytkowników</h2>
            <p className="text-sm text-gray-500 mt-1">
              do workspace'a: <span className="font-medium text-gray-700">{workspaceName}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Wyszukaj po nazwie użytkownika lub emailu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none"
              autoFocus
            />
          </div>
          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <p className="text-sm text-gray-500 mt-2">Wpisz minimum 2 znaki...</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : users.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {users.map((user) => {
                const canInvite = user.can_invite !== false;
                return (
                  <div key={user.id} className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-green-700 font-semibold">{user.username[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800 truncate">{user.username}</p>
                          {getUserStatusBadge(user)}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        {user.full_name && <p className="text-xs text-gray-400 truncate">{user.full_name}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleInvite(user.id)}
                      disabled={inviting === user.id || invitedUsers.includes(user.id) || !canInvite}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 flex-shrink-0 ml-3 ${
                        !canInvite
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : invitedUsers.includes(user.id)
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {getInviteButtonContent(user)}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="py-12 text-center">
              <Search size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nie znaleziono użytkowników</p>
              <p className="text-sm text-gray-400 mt-1">Spróbuj użyć innej frazy wyszukiwania</p>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Mail size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Wyszukaj użytkowników</p>
              <p className="text-sm text-gray-400 mt-1">Wpisz minimum 2 znaki aby rozpocząć wyszukiwanie</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-6 py-4 bg-blue-50 border-t border-blue-100 flex-shrink-0">
          <p className="text-sm text-blue-800">
            💡 Zaproszeni użytkownicy otrzymają email z linkiem do akceptacji oraz powiadomienie w panelu
          </p>
        </div>
      </div>
    </div>
  );
}
