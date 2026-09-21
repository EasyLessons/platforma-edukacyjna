/**
 * PLANS API
 *
 * fetchMyPlan() → GET /api/v1/plans/me → { plan, limits, usage }
 */
import { apiClient } from '@/_new/lib/api';
import type { PlanMe } from '../types';

export const fetchMyPlan = (): Promise<PlanMe> =>
  apiClient.get<PlanMe>('/api/v1/plans/me').then((res) => res.data);
