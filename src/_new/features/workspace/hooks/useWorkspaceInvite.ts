/**
 * USE WORKSPACE INVITE HOOK
 *
 * Logika modalu zapraszania użytkowników do workspace'a.
 *
 * Odpowiada za:
 * - Wyszukiwanie użytkowników z debouncingiem
 * - Sprawdzanie statusu każdego usera (member/pending invite)
 * - Wysyłanie zaproszeń
 * - Optimistic update po zaproszeniu
 * - Reset stanu przy zamknięciu modalu
 */
'use client';

import { useState, useEffect } from 'react';
import { searchUsers } from '../../auth/api/authApi';
import type { UserSearchResult } from '../../auth/api/authApi';
import { createInvite, checkUserInviteStatus } from '../api/inviteApi';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { InviteStatusResponse } from '../types';

export interface UserWithStatus extends UserSearchResult {
  is_member?: boolean;
  has_pending_invite?: boolean;
  can_invite?: boolean;
  status_checked?: boolean;
}

interface UseWorkspaceInviteOptions {
  workspace_id: number;
  isOpen: boolean;
}

export function useWorkspaceInvite({ workspace_id, isOpen }: UseWorkspaceInviteOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<number>>(new Set());

  const { handleError } = useErrorHandler({ onError: setSearchError });

  // Reset przy zamknięciu
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setUsers([]);
      setSearchError('');
      setInvitedUserIds(new Set());
    }
  }, [isOpen]);

  // Wyszukiwanie z debouncingiem
  useEffect(() => {
    if (searchQuery.length < 2) {
      setUsers([]);
      setSearchError('');
      return;
    }

    const search = async () => {
      try {
        setSearchLoading(true);
        setSearchError('');

        const results = await searchUsers(searchQuery, 10);

        const usersWithStatus = await Promise.all(
          results.map(async (user) => {
            try {
              const status: InviteStatusResponse = await checkUserInviteStatus(
                workspace_id,
                user.id
              );
              return { ...user, ...status, status_checked: true };
            } catch {
              return { ...user, status_checked: false };
            }
          })
        );

        setUsers(usersWithStatus);
      } catch (err) {
        await handleError(err);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, workspace_id]);

  const invite = async (user_id: number) => {
    try {
      setInvitingUserId(user_id);
      setSearchError('');

      await createInvite(workspace_id, user_id);

      // Optimistic update
      setInvitedUserIds((prev) => new Set(prev).add(user_id));
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user_id ? { ...u, has_pending_invite: true, can_invite: false } : u
        )
      );

      // Usuń "wysłano" badge po 3 sekundach
      setTimeout(() => {
        setInvitedUserIds((prev) => {
          const next = new Set(prev);
          next.delete(user_id);
          return next;
        });
      }, 3000);
    } catch (err) {
      await handleError(err);
    } finally {
      setInvitingUserId(null);
    }
  };

  return {
    // Search
    searchQuery,
    setSearchQuery,
    users,
    searchLoading,
    searchError,
    // Invite
    invite,
    invitingUserId,
    invitedUserIds,
    isInviting: invitingUserId !== null,
  };
}
