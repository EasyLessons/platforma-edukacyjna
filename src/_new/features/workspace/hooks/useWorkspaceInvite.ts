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
import { searchUsers } from '../../auth/api/authApi';
import type { UserSearchResult } from '../../auth/api/authApi';
import { createInvite, checkUsersInviteStatusBatch } from '../api/inviteApi';
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
  const [searchError, setSearchError] = useState('');
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<number>>(new Set());
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusOverrides, setStatusOverrides] = useState<Record<number, InviteStatusResponse>>({});

  const { handleError } = useErrorHandler({ onError: setSearchError });

  // Reset przy zamknięciu
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchError('');
      setInvitedUserIds(new Set());
      setDebouncedQuery('');
      setStatusOverrides({});
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
    queryFn: () => searchUsers(debouncedQuery, 10),
    enabled: isOpen && debouncedQuery.length >= 2,
  });

  const users = usersQuery.data ?? [];

  const statusesQuery = useQuery<Record<number, InviteStatusResponse>>({
    queryKey: ['workspace-invite-statuses', workspace_id, users.map((user) => user.id).join(',')],
    queryFn: () => checkUsersInviteStatusBatch(workspace_id, users.map((user) => user.id)),
    enabled: isOpen && users.length > 0,
  });

  const mergedStatuses = useMemo(() => {
    const base = statusesQuery.data ?? {};
    return { ...base, ...statusOverrides };
  }, [statusesQuery.data, statusOverrides]);

  const usersWithStatus = useMemo<UserWithStatus[]>(() => {
    return users.map((user) => {
      const status = mergedStatuses[user.id];
      if (!status) {
        return { ...user, status_checked: false };
      }
      return { ...user, ...status, status_checked: true };
    });
  }, [users, mergedStatuses]);

  useEffect(() => {
    if (usersQuery.error) {
      void handleError(usersQuery.error);
    }
  }, [usersQuery.error, handleError]);

  useEffect(() => {
    if (statusesQuery.error) {
      void handleError(statusesQuery.error);
    }
  }, [statusesQuery.error, handleError]);

  const invite = async (user_id: number) => {
    try {
      setInvitingUserId(user_id);
      setSearchError('');

      await createInvite(workspace_id, user_id);

      setInvitedUserIds((prev) => new Set(prev).add(user_id));
      setStatusOverrides((prev) => ({
        ...prev,
        [user_id]: {
          is_member: false,
          has_pending_invite: true,
          can_invite: false,
        },
      }));

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
    searchLoading: usersQuery.isLoading || statusesQuery.isLoading || usersQuery.isFetching || statusesQuery.isFetching,
    searchError,
    // Invite
    invite,
    invitingUserId,
    invitedUserIds,
    isInviting: invitingUserId !== null,
  };
}
