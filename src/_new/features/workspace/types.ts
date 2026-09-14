/**
 * WORKSPACE TYPES
 *
 * Typy i interfejsy związane z zarządzaniem workspace'ami.
 *
 * IDEA: typy zawarte w pliku są wspódzielone przez różne komponenty.
 */

import type { User } from '@/_new/shared/types/user';

// CORE WORKSPACE TYPES
export interface Workspace {
  id: number;
  name: string;
  icon: string;
  bg_color: string;
  is_owner: boolean;
  role: string;
  is_favourite: boolean;
}

export interface WorkspaceMember {
  id: number;
  user_id: number;
  username: string;
  email: string;
  full_name?: string;
  role: string;
  joined_at: string;
  is_owner: boolean;
}

// FORM DATA TYPES
export interface WorkspaceFormData {
  name: string;
  icon: string;
  bg_color: string;
}

export type WorkspaceErrors = Partial<Record<keyof WorkspaceFormData, string>>;
export type UserSearchResult = Pick<User, 'id' | 'username' | 'email'> & {
  full_name?: string;
  has_pending_invite: boolean;
};

// API REQUEST TYPES
export interface WorkspaceCreateRequest {
  name: string;
  icon?: string;
  bg_color?: string;
}

export interface WorkspaceUpdateRequest {
  name?: string;
  icon?: string;
  bg_color?: string;
}

// API RESPONSE TYPES
export interface WorkspaceListResponse {
  workspaces: Workspace[];
  total: number;
}

export interface WorkspaceMembersResponse {
  members: WorkspaceMember[];
  total: number;
}

export interface InviteResponse {
  id: number;
  workspace_id: number;
  invited_by: number;
  invited_id: number;
  invite_token: string;
  expires_at: string;
  created_at: string;
}

export interface AcceptInviteResponse {
  message: string;
  workspace_id: number;
  workspace_name: string;
  role: string;
}

export interface MyRoleResponse {
  role: string;
  is_owner: boolean;
  workspace_id: number;
}

export interface ShareLinkResponse {
  token: string;
  workspace_id: number;
  board_id: number | null;
}

export interface ShareLinkPreview {
  workspace_id: number;
  workspace_name: string;
  workspace_icon: string;
  board_id: number | null;
  board_name: string | null;
  already_member: boolean;
}

export interface JoinShareLinkResponse {
  message: string;
  workspace_id: number;
  workspace_name: string;
  board_id: number | null;
  role: string;
  already_member: boolean;
}

// UI TYPES
export interface WorkspaceCardActions {
  edit: (workspace: Workspace) => void;
  members: (workspace: Workspace) => void;
  delete: (workspace: Workspace) => void;
  leave: (workspace: Workspace) => void;
  invite: (workspace: Workspace) => void;
}

export interface WorkspaceDragState {
  draggedId: number | null;
  dragOverId: number | null;
}

export interface WorkspaceDragHandlers {
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, id: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetId: number) => void;
}
