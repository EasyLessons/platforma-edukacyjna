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
import {
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
} from '../api/workspace-api';
import type { WorkspaceMember } from '../types';

interface UseWorkspaceMembersOptions {
  workspaceId: number | null;
  autoLoad?: boolean;
}

export function useWorkspaceMembers(options: UseWorkspaceMembersOptions) {
  const { workspaceId, autoLoad = true } = options;

  // STATE
  // ================================
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [changingRoleMemberId, setChangingRoleMemberId] = useState<number | null>(null);

  // MEMBERS CRUD
  // ================================

  // loadMembers - Pobiera członków z backendu
  const loadMembers = async () => {
    if (!workspaceId) {
      setMembers([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetchWorkspaceMembers(workspaceId);
      setMembers(response.members);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Błąd ładowania członków';
      setError(errorMessage);
      console.error('Error loading members:', err);
    } finally {
      setLoading(false);
    }
  };

  // removeMember - Usuwa członka z workspace'a
  const removeMember = async (userId: number) => {
    if (!workspaceId) return;

    setRemovingMemberId(userId);

    try {
      await removeWorkspaceMember(workspaceId, userId);

      // Optymistic update - usuń ze stanu
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Błąd usuwania członka';
      setError(errorMessage);
      console.error('Error removing member:', err);
      throw err; // Re-throw żeby komponent mógł obsłużyć
    } finally {
      setRemovingMemberId(null);
    }
  };

  // changeRole - Zmienia role członka
  const changeRole = async (userId: number, newRole: 'owner' | 'editor' | 'viewer') => {
    if (!workspaceId) return;

    setChangingRoleMemberId(userId);

    try {
      await updateMemberRole(workspaceId, userId, newRole);

      // Optymistic update - zaktualizuj w stanie
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId ? { ...m, role: newRole, is_owner: newRole === 'owner' } : m
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Błąd zmiany roli';
      setError(errorMessage);
      console.error('Error changing role:', err);
      throw err; // Re-throw żeby komponent mógł obsłużyć
    } finally {
      setChangingRoleMemberId(null);
    }
  };

  // HELPERS
  // ================================

  // refreshMembers - Odświeża listę członków
  const refreshMembers = loadMembers;

  // getMemberById
  const getMemberById = (userId: number): WorkspaceMember | undefined => {
    return members.find((m) => m.user_id === userId);
  };

  // getOwner - Zwraca właściciela workspace'a
  const getOwner = (): WorkspaceMember | undefined => {
    return members.find((m) => m.is_owner);
  };

  // getMembersByRole - Filtruje członków po roli
  const getMembersByRole = (role: string): WorkspaceMember[] => {
    return members.filter((m) => m.role === role);
  };

  // HELPERS
  // ================================

  // Odświeża stan członków.
  useEffect(() => {
    if (autoLoad && workspaceId) {
      loadMembers();
    }
  }, [workspaceId, autoLoad]);

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
