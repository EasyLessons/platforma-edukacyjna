/**
 * WORKSPACE TYPES
 * 
 * Typy i interfejsy związane z zarządzaniem workspace'ami.
 *  
 * IDEA: typy zawarte w pliku są wspódzielone przez różne komponenty.
*/

import type { User, UserBasic } from '@/_new/shared/types/user';


// CORE WORKSPACE TYPES
export interface Workspace {
  id: number;
  name: string;
  icon: string;
  bg_color: string;
  created_by: number;
  creator?: UserBasic;
  member_count: number;
  board_count: number;
  is_owner: boolean;
  role: string;
  is_favourite: boolean;
  created_at?: string;
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

// VALIDATION ERROR TYPES
export interface WorkspaceErrors {
  name?: string;
  icon?: string;
  bg_color?: string;
}

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
