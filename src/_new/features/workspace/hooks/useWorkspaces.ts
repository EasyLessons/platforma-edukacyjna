/**
 * USE WORKSPACES HOOK
 *
 * Hook który zarządza WSZYSTKIMI workspace'ami użytkownika.
 *
 * Odpowiada za:
 * - Pobieranie listy workspace'ów z backendu
 * - Tworzenie nowego workspace'a
 * - Aktualizacja workspace'a
 * - Usuwanie workspace'a
 * - Toggle ulubione
 * - Zarządzanie stanem (loading, error)
 *
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  fetchWorkspaces,
  createWorkspace as apiCreateWorkspace,
  updateWorkspace as apiUpdateWorkspace,
  deleteWorkspace as apiDeleteWorkspace,
  leaveWorkspace as apiLeaveWorkspace,
  toggleWorkspaceFavourite as apiToggleFavourite,
} from '../api/workspaceApi';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { Workspace, WorkspaceCreateRequest, WorkspaceUpdateRequest } from '../types';

export function useWorkspaces() {
  // STATE
  // ================================
  const { isLoggedIn } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { handleError } = useErrorHandler({ onError: setError });

  // WORKSPACE CRUD
  // ================================

  // loadWorkspaces - Pobiera workspace'y z backendu
  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWorkspaces();
      setWorkspaces(response.workspaces);
    } catch (err) {
      await handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // createWorkspace - Tworzy nowy workspace
  const createWorkspace = async (data: WorkspaceCreateRequest) => {
    const newWorkspace = await apiCreateWorkspace(data);
    setWorkspaces((prev) => [...prev, newWorkspace]);
    return newWorkspace;
  };

  // updateWorkspace - Aktualizuje workspace
  const updateWorkspace = async (id: number, data: WorkspaceUpdateRequest) => {
    const updatedWorkspace = await apiUpdateWorkspace(id, data);
    setWorkspaces((prev) => prev.map((ws) => (ws.id === id ? updatedWorkspace : ws)));
    return updatedWorkspace;
  };

  // deleteWorkspace - Usuwa workspace
  const deleteWorkspace = async (id: number) => {
    await apiDeleteWorkspace(id);
    setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
  };

  // leaveWorkspace - Opuszcza workspace (członek)
  const leaveWorkspace = async (id: number) => {
    await apiLeaveWorkspace(id);
    setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
  };

  // toggleFavourite - Dodaje/usuwa workspace z ulubionych
  const toggleFavourite = async (id: number, isFavourite: boolean) => {
    await apiToggleFavourite(id, isFavourite);
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === id ? { ...ws, is_favourite: isFavourite } : ws))
    );
  };

  // HELPERS
  // ================================

  const refreshWorkspaces = loadWorkspaces;

  const getWorkspaceById = (id: number): Workspace | undefined => {
    return workspaces.find((ws) => ws.id === id);
  };

  // EFFECTS
  // ================================

  // Pobierz workspace'y przy mount i logowaniu użytkownika
  useEffect(() => {
    if (isLoggedIn) {
      loadWorkspaces();
    }
  }, [isLoggedIn]);

  return {
    // State
    workspaces,
    loading,
    error,
    // CRUD
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    leaveWorkspace,
    toggleFavourite,
    // Helpers
    refreshWorkspaces,
    getWorkspaceById,
  };
}
