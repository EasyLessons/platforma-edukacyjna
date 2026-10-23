/**
 * PLANS TYPES
 *
 * Odzwierciedlają backend/api/v1/plans/schemas.py (GET /api/v1/plans/me)
 * i kody błędów PlanLimitError z backend/core/exceptions.py.
 */

export type PlanName = 'free' | 'premium';

/** null = bez limitu */
export interface PlanLimits {
  max_own_workspaces: number | null;
  max_boards_per_workspace: number | null;
  max_elements_per_board: number | null;
  /** Miejsce na pliki tablic (bajty) na konto właściciela przestrzeni. */
  max_storage_bytes: number | null;
  ai_chat_daily: number | null;
}

export interface PlanUsage {
  own_workspaces: number;
  /** id własnej przestrzeni (jako string) -> liczba tablic w niej */
  boards_by_workspace: Record<string, number>;
  /** Miejsce zajęte przez pliki tablic we własnych przestrzeniach (bajty). */
  storage_bytes: number;
}

export interface PlanMe {
  plan: PlanName;
  limits: PlanLimits;
  usage: PlanUsage;
}

/** Kody `AppError.code` zwracane przez backend przy przekroczeniu limitu (HTTP 403). */
export type PlanLimitCode =
  'PLAN_LIMIT_WORKSPACES' | 'PLAN_LIMIT_BOARDS' | 'PLAN_LIMIT_ELEMENTS' | 'PLAN_LIMIT_STORAGE';
