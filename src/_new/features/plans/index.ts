/**
 * Publiczne API feature'a `plans` (plany free/premium, limity, upgrade).
 *
 * Backend: backend/api/v1/plans (GET /api/v1/plans/me, 403 PLAN_LIMIT_*).
 * Dokumentacja: docs/plan-subskrypcje.md
 */

export { usePlan, useEntitlements, planKeys } from './hooks/use-plan';
export { fetchMyPlan } from './api/plans-api';
export { getPlanLimitCode, isPlanLimitError, PLAN_LIMIT_CODES } from './utils/plan-limit-error';
export { PlanUsageBadge } from './components/plan-usage-badge';
export { UpgradeModal } from './components/upgrade-modal';
export { ReadOnlyBanner } from './components/read-only-banner';
export type {
  PlanName,
  PlanLimits,
  PlanUsage,
  PlanMe,
  PlanLimitCode,
  BoardReadOnlyReason,
} from './types';
