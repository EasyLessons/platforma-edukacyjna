/**
 * BOARD TYPES
 *
 * Typy i interfejsy związane z zarządzaniem tablicami.
 * Odzwierciedlają schemas.py z backendu.
 *
 */

import type { FormErrors } from "../auth/types";

// CORE TYPES

export interface BoardSettings {
  ai_enabled: boolean;
  grid_visible: boolean;
  smartsearch_visible: boolean;
  toolbar_visible: boolean;
}

export interface BoardMember {
  user_id: number;
  username: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  is_owner: boolean;
  joined_at: string | null;
}

export interface Board {
  id: number;
  name: string;
  icon: string;
  bg_color: string;
  workspace_id: number;
  owner_id: number;
  owner_username: string;
  is_favourite: boolean;
  settings: BoardSettings | null;
  last_modified: string;
  last_modified_by: string | null;
  last_opened: string | null;
  created_at: string;
  created_by: string;
}

// FORM DATA TYPES

export interface BoardFormData {
  name: string;
  icon: string;
  bg_color: string;
}

export type BoardErrors = FormErrors<BoardFormData>;

// API REQUEST TYPES
// ================================

export interface BoardCreateRequest {
  name: string;
  icon?: string;
  bg_color?: string;
  workspace_id: number;
}

export interface BoardUpdateRequest {
  name?: string;
  icon?: string;
  bg_color?: string;
}

export interface BoardToggleFavouriteRequest {
  is_favourite: boolean;
}

export interface UpdateBoardSettingsRequest {
  settings: BoardSettings;
}

// API RESPONSE TYPES

export interface BoardListResponse {
  boards: Board[];
  total: number;
  limit: number;
  offset: number;
}

export interface BoardToggleFavouriteResponse {
  is_favourite: boolean;
  message: string;
}

export interface BoardMembersResponse {
  members: BoardMember[];
}

export interface UpdateSettingsResponse {
  success: boolean;
  settings: BoardSettings;
}

export interface JoinBoardResponse {
  success: boolean;
  already_member: boolean;
  workspace_id: number;
  board_id: number;
  owner_id: number;
  is_owner: boolean;
  user_role: string;
  message?: string;
}

// UI TYPES

export interface BoardCardActions {
  edit: (board: Board) => void;
  delete: (board: Board) => void;
}
