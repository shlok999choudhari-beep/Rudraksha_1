/** Dashboard and analytics aggregates. */

import type { AnalyticsRange, AnalyticsSummary, DashboardStatistics } from '@/lib/types/dashboard';
import { getAnalyticsSummary, getDashboardStatistics } from '@/lib/mock/store';
import { DEMO_LATENCY, DEMO_MODE, apiGet, camelize, delay } from './client';

/** `GET /api/dashboard/statistics` */
export async function fetchDashboardStatistics(
  range: AnalyticsRange = '7d',
): Promise<DashboardStatistics> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.normal);
    return getDashboardStatistics(range);
  }
  return camelize<DashboardStatistics>(
    await apiGet<unknown>('/api/dashboard/statistics', { params: { range } }),
  );
}

/**
 * `GET /api/analytics`
 *
 * Everything on the analytics page describes throughput and the distribution of
 * signals this prototype produced. None of it is a model-accuracy measurement,
 * and the page must not present it as one.
 */
export async function fetchAnalytics(range: AnalyticsRange = '30d'): Promise<AnalyticsSummary> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.normal);
    return getAnalyticsSummary(range);
  }
  return camelize<AnalyticsSummary>(await apiGet<unknown>('/api/analytics', { params: { range } }));
}

export interface ServiceHealth {
  status: 'ok' | 'degraded' | 'unreachable';
  components: Record<string, string>;
  version?: string;
}

/**
 * `GET /health`
 *
 * The header shows this so an officer can tell the difference between "no
 * suspicious evidence" and "the analysis service is down".
 */
export async function fetchServiceHealth(): Promise<ServiceHealth> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.fast);
    return {
      status: 'ok',
      components: {
        api: 'demo data',
        preprocessing: 'demo data',
        risk_engine: 'demo data',
      },
      version: 'demo',
    };
  }

  try {
    const response = camelize<{ status: string; components: Record<string, string> }>(
      await apiGet<unknown>('/health'),
    );
    return {
      status: response.status === 'ok' ? 'ok' : 'degraded',
      components: response.components ?? {},
    };
  } catch {
    return { status: 'unreachable', components: {} };
  }
}
