/**
 * BOARD TYPES
 *
 * Typy i interfejsy związane z zarządzaniem tablicami.
 * Odzwierciedlają schemas.py z backendu.
 *
 */

// CORE TYPES
// ================================

export interface Board {
  id: number;
  name: string;
  icon: string;
  bg_color: string;
  workspace_id: number;

  // Właściciel
  owner_id: number;
  owner_username: string;

  // Statusy
  is_favourite: boolean;

  // Timestamps
  last_modified: string;
  last_modified_by: string | null;
  last_opened: string | null;
  created_at: string;
  created_by: string;
}

// FORM DATA TYPES
// ================================

export interface BoardFormData {
  name: string;
  icon: string;
  bg_color: string;
}

export interface BoardErrors {
  name?: string;
  icon?: string;
  bg_color?: string;
}

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
// ================================

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