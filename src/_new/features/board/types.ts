/**
 * BOARD TYPES
 *
 * Typy i interfejsy związane z zarządzaniem tablicami.
 * Odzwierciedlają schemas.py z backendu.
 *
 */

import type { FormErrors } from '../auth/types';

// CORE TYPES

export interface Board {
  id: number;
  name: string;
  icon: string;
  bg_color: string;
  workspace_id: number;
  owner_id: number;
  owner_username: string;
  is_favourite: boolean;
  last_modified: string;
  last_modified_by: string | null;
  last_opened: string | null;
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

// UI TYPES

export interface BoardCardActions {
  edit: (board: Board) => void;
  delete: (board: Board) => void;
}
