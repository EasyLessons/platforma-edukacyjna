

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/context/AuthContext';
import {
  fetchWorkspaces,
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
};

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

  const createWorkspace = (data: WorkspaceCreateRequest): Promise<Workspace> =>
    createMutation.mutateAsync(data);

  const updateWorkspace = (id: number, data: WorkspaceUpdateRequest): Promise<Workspace> =>
    updateMutation.mutateAsync({ id, data });

  const deleteWorkspace = (id: number): Promise<void> =>
    deleteMutation.mutateAsync(id);

  const leaveWorkspace = (id: number): Promise<{ message: string }> =>
    leaveMutation.mutateAsync(id);

  const toggleFavourite = (id: number, isFavourite: boolean): Promise<void> =>
    toggleFavouriteMutation.mutateAsync({ id, is_favourite: isFavourite }).then(() => undefined);

  const refreshWorkspaces = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });

  const getWorkspaceById = (id: number): Workspace | undefined =>
    workspaces.find((ws) => ws.id === id);

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
