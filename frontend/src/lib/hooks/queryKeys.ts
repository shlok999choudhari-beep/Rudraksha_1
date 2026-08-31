/**
 * Query key factory.
 *
 * Centralised so invalidation after an officer action is exact: reviewing a case
 * must refresh that case, the case list, the dashboard counters and the audit
 * trail, and nothing else.
 */

import type { AnalyticsRange } from '@/lib/types/dashboard';
import type { AuditQuery } from '@/lib/types/audit';
import type { CaseQuery } from '@/lib/types/case';

export const queryKeys = {
  dashboard: {
    all: ['dashboard'] as const,
    statistics: (range: AnalyticsRange) => ['dashboard', 'statistics', range] as const,
    analytics: (range: AnalyticsRange) => ['dashboard', 'analytics', range] as const,
    health: () => ['dashboard', 'health'] as const,
  },
  cases: {
    all: ['cases'] as const,
    list: (query: CaseQuery) => ['cases', 'list', query] as const,
    detail: (caseId: string) => ['cases', 'detail', caseId] as const,
    neighbours: (caseId: string, query: CaseQuery) =>
      ['cases', 'neighbours', caseId, query] as const,
    timeline: (caseId: string) => ['cases', 'timeline', caseId] as const,
  },
  screening: {
    all: ['screening'] as const,
    detail: (caseId: string) => ['screening', 'detail', caseId] as const,
    history: (query: CaseQuery) => ['screening', 'history', query] as const,
  },
  audit: {
    all: ['audit'] as const,
    list: (query: AuditQuery) => ['audit', 'list', query] as const,
  },
} as const;
