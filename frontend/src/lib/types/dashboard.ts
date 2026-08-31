/** Dashboard & analytics contracts. */

import type { CaseSummary } from './case';
import type { RiskLevel } from './risk';

export interface DashboardStatistics {
  totalScreened: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  /** Mean pipeline wall-clock time, milliseconds. */
  averageProcessingTimeMs: number;
  /** Percentage change vs. the previous comparable window. */
  deltas?: {
    totalScreened?: number;
    lowRisk?: number;
    mediumRisk?: number;
    highRisk?: number;
    averageProcessingTimeMs?: number;
  };
  pendingReview: number;
  escalated: number;
  partialAnalyses: number;
  recentHighRiskCases: CaseSummary[];
  trend: TrendPoint[];
  riskDistribution: RiskDistributionSlice[];
  windowLabel: string;
}

export interface TrendPoint {
  /** ISO date (day granularity). */
  date: string;
  total: number;
  low: number;
  medium: number;
  high: number;
}

export interface RiskDistributionSlice {
  level: RiskLevel;
  count: number;
  percentage: number;
}

export interface ProcessingTimePoint {
  date: string;
  /** Milliseconds. */
  averageMs: number;
  p95Ms: number;
}

export interface TopRiskReason {
  label: string;
  count: number;
  /** Share of all flagged cases, 0–1. */
  share: number;
}

export interface AnalyticsSummary extends DashboardStatistics {
  processingTimeSeries: ProcessingTimePoint[];
  topRiskReasons: TopRiskReason[];
  casesByDocumentType: { type: string; count: number }[];
  reviewOutcomes: { outcome: string; count: number }[];
}

export type AnalyticsRange = '24h' | '7d' | '30d' | '90d';

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};
