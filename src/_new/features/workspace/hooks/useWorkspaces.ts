

import { useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/context/AuthContext';
import {
  fetchWorkspaces,
  getDashboardInit,
  createWorkspace as apiCreateWorkspace,
  updateWorkspace as apiUpdateWorkspace,
  deleteWorkspace as apiDeleteWorkspace,
  leaveWorkspace as apiLeaveWorkspace,
  toggleWorkspaceFavourite as apiToggleFavourite,
} from '../api/workspaceApi';
import type { Workspace, WorkspaceCreateRequest, WorkspaceListResponse, WorkspaceUpdateRequest } from '../types';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => ['workspaces', 'list'] as const,
  init: () => ['dashboard', 'init'] as const,
};

export function useDashboardInit() {
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: workspaceKeys.init(),
    queryFn: getDashboardInit,
    enabled: !!isLoggedIn,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  useEffect(() => {
    if (data) {
      // Seed workspaces
      queryClient.setQueryData<WorkspaceListResponse>(workspaceKeys.list(), {
        workspaces: data.workspaces,
        total: data.workspaces.length,
      });

      // Seed boards for active workspace if available
      if (data.active_workspace_id && data.active_workspace_boards) {
        queryClient.setQueryData(['boards', data.active_workspace_id], {
          boards: data.active_workspace_boards,
          total: data.active_workspace_boards.length,
          limit: 50,
          offset: 0,
        });
      }
    }
  }, [data, queryClient]);

  return {
    data,
    isLoading,
    error,
  };
}

export function useWorkspaces() {
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();


  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery<WorkspaceListResponse>({
    queryKey: workspaceKeys.list(),
    queryFn: fetchWorkspaces,
    enabled: !!isLoggedIn,
  });

  const workspaces: Workspace[] = data?.workspaces ?? [];
  const error: string | null = queryError
    ? (queryError instanceof Error ? queryError.message : String(queryError))
    : null;



  const createMutation = useMutation({
    mutationFn: apiCreateWorkspace,
    onSuccess: () => {
      // Przy tworzeniu: pełna inwalidacja, bo backend przypisuje ID i daty
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: WorkspaceUpdateRequest }) =>
      apiUpdateWorkspace(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<WorkspaceListResponse>(
        workspaceKeys.list(),
        (old) =>
          old
            ? { ...old, workspaces: old.workspaces.map((ws) => (ws.id === updated.id ? updated : ws)) }
            : old,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteWorkspace,
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<WorkspaceListResponse>(
        workspaceKeys.list(),
        (old) =>
          old
            ? { ...old, workspaces: old.workspaces.filter((ws) => ws.id !== deletedId) }
            : old,
      );
    },
  });

  const leaveMutation = useMutation({
    mutationFn: apiLeaveWorkspace,
    onSuccess: (_, leftId) => {
      queryClient.setQueryData<WorkspaceListResponse>(
        workspaceKeys.list(),
        (old) =>
          old
            ? { ...old, workspaces: old.workspaces.filter((ws) => ws.id !== leftId) }
            : old,
      );
    },
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: ({ id, is_favourite }: { id: number; is_favourite: boolean }) =>
      apiToggleFavourite(id, is_favourite),
    onSuccess: (_, { id, is_favourite }) => {
      queryClient.setQueryData<WorkspaceListResponse>(
        workspaceKeys.list(),
        (old) =>
          old
            ? { ...old, workspaces: old.workspaces.map((ws) => (ws.id === id ? { ...ws, is_favourite } : ws)) }
            : old,
      );
    },
  });

  // ── Public API (zachowana sygnatura dla komponentów) ───────────────────────

  const createWorkspace = useCallback(
    (data: WorkspaceCreateRequest): Promise<Workspace> => createMutation.mutateAsync(data),
    [createMutation]
  );

  const updateWorkspace = useCallback(
    (id: number, data: WorkspaceUpdateRequest): Promise<Workspace> =>
      updateMutation.mutateAsync({ id, data }),
    [updateMutation]
  );

  const deleteWorkspace = useCallback(
    (id: number): Promise<void> => deleteMutation.mutateAsync(id),
    [deleteMutation]
  );

  const leaveWorkspace = useCallback(
    (id: number): Promise<void> => leaveMutation.mutateAsync(id).then(() => undefined),
    [leaveMutation]
  );

  const toggleFavourite = useCallback(
    (id: number, isFavourite: boolean): Promise<void> =>
      toggleFavouriteMutation.mutateAsync({ id, is_favourite: isFavourite }).then(() => undefined),
    [toggleFavouriteMutation]
  );

  const refreshWorkspaces = useCallback(
    (): Promise<void> => queryClient.invalidateQueries({ queryKey: workspaceKeys.list() }),
    [queryClient]
  );

  const getWorkspaceById = useCallback(
    (id: number): Workspace | undefined => workspaces.find((ws) => ws.id === id),
    [workspaces]
  );

  return useMemo(
    () => ({
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
    }),
    [
      workspaces,
      loading,
      error,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      leaveWorkspace,
      toggleFavourite,
      refreshWorkspaces,
      getWorkspaceById,
    ]
  );
}
