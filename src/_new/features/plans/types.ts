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
  max_boards: number | null;
  max_elements_per_board: number | null;
  ai_chat_daily: number | null;
}

export interface PlanUsage {
  own_workspaces: number;
  boards: number;
}

export interface PlanMe {
  plan: PlanName;
  limits: PlanLimits;
  usage: PlanUsage;
}

/** Kody `AppError.code` zwracane przez backend przy przekroczeniu limitu (HTTP 403). */
export type PlanLimitCode = 'PLAN_LIMIT_WORKSPACES' | 'PLAN_LIMIT_BOARDS' | 'PLAN_LIMIT_ELEMENTS';

/** Powód trybu tylko do odczytu z GET /api/v1/boards/{id} (`read_only_reason`). */
export type BoardReadOnlyReason = 'PLAN_LIMIT_ELEMENTS';
