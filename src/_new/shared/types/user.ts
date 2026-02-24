/**
 * USER TYPES
 *
 * Globalne typy i interfejsy przechowujące dane o użytkowniku.
 */

export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserBasic {
  id: number;
  username: string;
  email: string;
}

export interface OnlineUser {
  user_id: number;
  username: string;
}
