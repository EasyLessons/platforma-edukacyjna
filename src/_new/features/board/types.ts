/**
 * BOARD TYPES
 *
 * Typy i interfejsy związane z zarządzaniem tablicami.
 * Odzwierciedlają schemas.py z backendu.
 *
 */

// CORE TYPES
// ================================

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
  role: 'owner' | 'admin' | 'member' | 'viewer';
  is_owner: boolean;
  joined_at: string | null;
}

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

  // Ustawienia tablicy
  settings: BoardSettings | null;

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

// BOARD CARD TYPES
export interface BoardCardActions {
  edit: (board: Board) => void;
  delete: (board: Board) => void;
}
