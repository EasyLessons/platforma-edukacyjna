import { describe, it, expect } from 'vitest';
import { AppError } from '@/_new/lib/errors';
import { getPlanLimitCode, isPlanLimitError, PLAN_LIMIT_CODES } from './plan-limit-error';

describe('plan-limit-error', () => {
  it('rozpoznaje każdy kod PLAN_LIMIT_*', () => {
    for (const code of PLAN_LIMIT_CODES) {
      const err = new AppError('limit', code, 403);
      expect(getPlanLimitCode(err)).toBe(code);
      expect(isPlanLimitError(err)).toBe(true);
    }
  });

  it('zwykły 403 (AUTH_ERROR) nie jest błędem planu', () => {
    const err = new AppError('Brak dostępu', 'AUTH_ERROR', 403);
    expect(getPlanLimitCode(err)).toBeNull();
    expect(isPlanLimitError(err)).toBe(false);
  });

  it('nie-AppError → null/false', () => {
    expect(getPlanLimitCode(new Error('x'))).toBeNull();
    expect(getPlanLimitCode('PLAN_LIMIT_BOARDS')).toBeNull();
    expect(isPlanLimitError(undefined)).toBe(false);
  });
});
