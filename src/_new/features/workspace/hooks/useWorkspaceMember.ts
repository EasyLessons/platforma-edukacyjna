/**
 * USE WORKSPACE MEMBERS HOOK
 *
 * Hook który zarządza członkami konkretnego workspace'a.
 *
 * Odpowiada za:
 * - Pobieranie listy członków
 * - Usuwanie członka (tylko owner)
 * - Zmiana roli członka (tylko owner)
 * - Zarządzanie stanem (loading, error)
 *
 */

import { useState, useEffect } from 'react';
import { fetchWorkspaceMembers, removeWorkspaceMember, updateMemberRole } from '../api/memberApi';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { WorkspaceMember } from '../types';

interface UseWorkspaceMembersOptions {
  workspace_id: number | null;
  autoLoad?: boolean;
}

export function useWorkspaceMembers(options: UseWorkspaceMembersOptions) {
  const { workspace_id, autoLoad = true } = options;

  // STATE
  // ================================
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [changingRoleMemberId, setChangingRoleMemberId] = useState<number | null>(null);

  const { handleError } = useErrorHandler({ onError: setError });

  // MEMBERS CRUD
  // ================================

  // loadMembers - Pobiera członków z backendu
  const loadMembers = async () => {
    if (!workspace_id) {
      setMembers([]);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWorkspaceMembers(workspace_id);
      setMembers(response.members);
    } catch (err) {
      await handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // removeMember - Usuwa członka z workspace'a
  const removeMember = async (userId: number) => {
    if (!workspace_id) return;
    setRemovingMemberId(userId);
    try {
      await removeWorkspaceMember(workspace_id, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      await handleError(err);
      throw err; // Re-throw żeby komponent mógł obsłużyć
    } finally {
      setRemovingMemberId(null);
    }
  };

  // changeRole - Zmienia role członka
  const changeRole = async (userId: number, newRole: 'owner' | 'editor' | 'viewer') => {
    if (!workspace_id) return;
    setChangingRoleMemberId(userId);
    try {
      await updateMemberRole(workspace_id, userId, newRole);
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId ? { ...m, role: newRole, is_owner: newRole === 'owner' } : m
        )
      );
    } catch (err) {
      await handleError(err);
      throw err; // Re-throw żeby komponent mógł obsłużyć
    } finally {
      setChangingRoleMemberId(null);
    }
  };

  // HELPERS
  // ================================

  const refreshMembers = loadMembers;
  const getMemberById = (userId: number): WorkspaceMember | undefined => {
    return members.find((m) => m.user_id === userId);
  };
  const getOwner = (): WorkspaceMember | undefined => {
    return members.find((m) => m.is_owner);
  };
  const getMembersByRole = (role: string): WorkspaceMember[] => {
    return members.filter((m) => m.role === role);
  };

  // EFFECTS
  // ================================

  // Odświeża stan członków.
  useEffect(() => {
    if (autoLoad && workspace_id) {
      loadMembers();
    }
  }, [workspace_id, autoLoad]);

  return {
    // State
    members,
    loading,
    error,
    removingMemberId,
    changingRoleMemberId,
    // CRUD
    loadMembers,
    removeMember,
    changeRole,
    // Helpers
    refreshMembers,
    getMemberById,
    getOwner,
    getMembersByRole,
    // Meta
    memberCount: members.length,
    hasMembers: members.length > 0,
  };
}
