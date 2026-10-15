/**
 * Rozpoznawanie błędów limitu planu (403 z kodem PLAN_LIMIT_*).
 *
 *   try { await createBoard(data); }
 *   catch (err) {
 *     const code = getPlanLimitCode(err);
 *     if (code) { openUpgradeModal(code); return; }
 *     throw err;
 *   }
 */
import { AppError } from '@/_new/lib/errors';
import type { PlanLimitCode } from '../types';

export const PLAN_LIMIT_CODES: readonly PlanLimitCode[] = [
  'PLAN_LIMIT_WORKSPACES',
  'PLAN_LIMIT_BOARDS',
  'PLAN_LIMIT_ELEMENTS',
];

/** Kod limitu z błędu albo null, gdy to nie jest błąd planu. */
export function getPlanLimitCode(err: unknown): PlanLimitCode | null {
  if (!(err instanceof AppError)) return null;
  return (PLAN_LIMIT_CODES as readonly string[]).includes(err.code)
    ? (err.code as PlanLimitCode)
    : null;
}

export function isPlanLimitError(err: unknown): err is AppError {
  return getPlanLimitCode(err) !== null;
}
