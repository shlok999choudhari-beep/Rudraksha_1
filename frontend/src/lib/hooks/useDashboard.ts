'use client';

import { useQuery } from '@tanstack/react-query';
import type { AnalyticsRange } from '@/lib/types/dashboard';
import { fetchAnalytics, fetchDashboardStatistics, fetchServiceHealth } from '@/lib/api/dashboard';
import { queryKeys } from './queryKeys';

export function useDashboardStatistics(range: AnalyticsRange = '7d') {
  return useQuery({
    queryKey: queryKeys.dashboard.statistics(range),
    queryFn: () => fetchDashboardStatistics(range),
  });
}

export function useAnalytics(range: AnalyticsRange = '30d') {
  return useQuery({
    queryKey: queryKeys.dashboard.analytics(range),
    queryFn: () => fetchAnalytics(range),
  });
}

/**
 * Backend reachability, polled slowly.
 *
 * The header uses this to distinguish "nothing suspicious was found" from
 * "nothing was checked" — a distinction the officer has to be able to make.
 */
export function useServiceHealth() {
  return useQuery({
    queryKey: queryKeys.dashboard.health(),
    queryFn: fetchServiceHealth,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
}
