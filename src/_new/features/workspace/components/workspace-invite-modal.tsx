/**
 * WORKSPACE INVITE MODAL
 *
 * Modal do zapraszania użytkowników do workspace'a.
 * Wyszukuje użytkowników po nazwie/emailu i wysyła zaproszenia.
 */

'use client';

import { useRef, useState, useEffect } from 'react';
import { Mail, X, UserPlus, Search, Check, AlertCircle, Clock } from 'lucide-react';
import { createInvite, checkUserInviteStatus } from '../api/invite_api';
import { UserSearchResult, searchUsers } from '@/auth_api/api';
import { Button } from '@/_new/shared/ui/button';
import { Input } from '@/_new/shared/ui/input';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { DashboardButton } from '@/app/dashboard/Components/DashboardButton';
import { Workspace } from '../types';

interface WorkspaceInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
}

interface UserWithStatus extends UserSearchResult {
  is_member?: boolean;
  has_pending_invite?: boolean;
  can_invite?: boolean;
  status_checked?: boolean;
}

export function WorkspaceInviteModal({
  isOpen,
  onClose,
  workspace,
}: WorkspaceInviteModalProps) {
  // STATE
  // ================================
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<number | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<number[]>([]);
  const [error, setError] = useState<string>('');

  // REFS
  // ================================
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // MODAL BEHAVIOR
  // ================================
  useModal({
    isOpen,
    onClose,
    modalRef,
    focusRef: inputRef,
    preventCloseWhen: () => !!inviting,
  });

  // Reset stanu przy zamknięciu
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setUsers([]);
      setError('');
      setInvitedUsers([]);
    }
  }, [isOpen]);

  // EFFECTS
  // ================================
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
              const status = await checkUserInviteStatus(workspace.id, user.id);
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
  }, [searchQuery, workspace.id]);

  const handleInvite = async (userId: number) => {
    try {
      setInviting(userId);
      setError('');

      await createInvite(workspace.id, userId);

      setInvitedUsers((prev) => [...prev, userId]);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, has_pending_invite: true, can_invite: false } : u
        )
      );

      setTimeout(() => {
        setInvitedUsers((prev) => prev.filter((id) => id !== userId));
      }, 3000);
    } catch (error: any) {
      setError(error.message || 'Błąd wysyłania zaproszenia');
      console.error('Błąd wysyłania zaproszenia:', error);
    } finally {
      setInviting(null);
    }
  };

  // HELPERS
  // ================================
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

  // RENDER
  // ================================
  if (!isOpen || !workspace) return null;

  return (
    <div
      className="dashboard-modal-overlay"
      onClick={onClose}
    >
      <div
        className="dashboard-modal-surface max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dashboard-modal-header flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Zaproś użytkowników</h2>
            <p className="text-sm text-gray-500 mt-1">
              do workspace'a: <span className="font-medium text-gray-700">{workspace.name}</span>
            </p>
          </div>
          <DashboardButton variant="secondary" onClick={onClose} className="h-9 w-9 rounded-full p-0">
            <X size={20} />
          </DashboardButton>
        </div>

        {/* Search */}
        <div className="flex-shrink-0 border-b border-[var(--dash-border)] p-6">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Wyszukaj po nazwie użytkownika lub emailu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={18} />}
            className="text-black"
          />
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
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-700"></div>
            </div>
          ) : users.length > 0 ? (
            <div className="divide-y divide-[var(--dash-border)]">
              {users.map((user) => {
                const canInvite = user.can_invite !== false;
                const isInviting = inviting === user.id;
                const justInvited = invitedUsers.includes(user.id);

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--dash-panel)]"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--dash-hover)]">
                        <span className="font-semibold text-gray-800">
                          {user.username[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800 truncate">{user.username}</p>
                          {getUserStatusBadge(user)}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        {user.full_name && (
                          <p className="text-xs text-gray-400 truncate">{user.full_name}</p>
                        )}
                      </div>
                    </div>

                    <DashboardButton
                      variant={justInvited ? 'secondary' : 'primary'}
                      onClick={() => handleInvite(user.id)}
                      disabled={isInviting || justInvited || !canInvite}
                      className={`flex-shrink-0 ml-3 ${
                        !justInvited && canInvite ? 'h-10 min-w-[128px] px-4 text-sm font-medium' : ''
                      } ${
                        justInvited ? 'bg-[var(--dash-hover)] text-gray-800 hover:bg-[var(--dash-hover)]' : ''
                      }`}
                    >
                      {justInvited ? (
                        <>
                          <Check size={16} />
                          <span>Wysłano!</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} />
                          <span>Zaproś</span>
                        </>
                      )}
                    </DashboardButton>
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
              <p className="text-sm text-gray-400 mt-1">
                Wpisz minimum 2 znaki aby rozpocząć wyszukiwanie
              </p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-shrink-0 border-t border-[var(--dash-border)] bg-[var(--dash-panel)] px-6 py-4">
          <p className="text-sm text-gray-700">
            Zaproszeni użytkownicy otrzymają email z linkiem do akceptacji oraz powiadomienie w
            panelu
          </p>
        </div>
      </div>
    </div>
  );
}
