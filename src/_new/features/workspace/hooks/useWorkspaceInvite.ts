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

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createInvite, searchWorkspaceUsers } from '../api/inviteApi';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { UserSearchResult } from '../types';

interface UseWorkspaceInviteOptions {
  workspace_id: number;
  isOpen: boolean;
}

export function useWorkspaceInvite({ workspace_id, isOpen }: UseWorkspaceInviteOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<number>>(new Set());
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [pendingOverrides, setPendingOverrides] = useState<Set<number>>(new Set());

  const { handleError } = useErrorHandler({ onError: setSearchError });

  // Reset przy zamknięciu
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchError('');
      setInvitedUserIds(new Set());
      setDebouncedQuery('');
      setPendingOverrides(new Set());
    }
  }, [isOpen]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const usersQuery = useQuery<UserSearchResult[]>({
    queryKey: ['workspace-invite-users', workspace_id, debouncedQuery],
    queryFn: () => searchWorkspaceUsers(workspace_id, debouncedQuery, 10),
    enabled: isOpen && debouncedQuery.length >= 2,
  });

  const users = usersQuery.data ?? [];

  const usersWithStatus = useMemo<UserSearchResult[]>(() => {
    return users.map((user) => ({
      ...user,
      has_pending_invite: user.has_pending_invite || pendingOverrides.has(user.id),
    }));
  }, [users, pendingOverrides]);

  useEffect(() => {
    if (usersQuery.error) {
      void handleError(usersQuery.error);
    }
  }, [usersQuery.error, handleError]);

  const invite = async (user_id: number) => {
    try {
      setInvitingUserId(user_id);
      setSearchError('');

      await createInvite(workspace_id, user_id);

      setInvitedUserIds((prev) => new Set(prev).add(user_id));
      setPendingOverrides((prev) => new Set(prev).add(user_id));

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
    users: usersWithStatus,
    searchLoading: usersQuery.isLoading || usersQuery.isFetching,
    searchError,
    // Invite
    invite,
    invitingUserId,
    invitedUserIds,
    isInviting: invitingUserId !== null,
  };
}
