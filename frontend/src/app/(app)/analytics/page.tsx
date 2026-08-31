'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Clock,
  Layers,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { StatCard, RiskChart, TrendChart, ProcessingTime } from '@/components/dashboard';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAnalytics } from '@/lib/hooks/useDashboard';
import type { AnalyticsRange } from '@/lib/types/dashboard';
import { formatDuration } from '@/lib/utils/dates';
import { formatNumber } from '@/lib/utils/formatters';

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const { data: analytics, isLoading, refetch } = useAnalytics(range);

  return (
    <PageContainer
      title="Screening Analytics & Metrics"
      description="Throughput trends, forensic signal distributions, and decision latency profiles"
      actions={
        <div className="flex items-center gap-3">
          {/* Range Switcher */}
          <div className="flex items-center rounded-lg border border-border bg-surface-muted/60 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  range === r.value
                    ? 'bg-surface text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-foreground"
            title="Refresh analytics"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="panel p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : analytics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Cases Screened"
              value={formatNumber(analytics.totalScreened)}
              delta={analytics.deltas?.totalScreened}
              icon={<Layers className="size-4" />}
              tone="primary"
              hint="All travel documents passed through the forensic verification pipeline."
            />
            <StatCard
              label="High Risk Anomaly Share"
              value={formatNumber(analytics.highRisk)}
              delta={analytics.deltas?.highRisk}
              caption={`${Math.round(
                (analytics.highRisk / Math.max(1, analytics.totalScreened)) * 100
              )}% of total volume`}
              icon={<ShieldAlert className="size-4" />}
              tone="high"
              invertDelta
              hint="Cases with aggregate score >= 60 requiring secondary physical examination."
            />
            <StatCard
              label="Medium Risk Flagged"
              value={formatNumber(analytics.mediumRisk)}
              delta={analytics.deltas?.mediumRisk}
              caption="Review recommended"
              icon={<AlertTriangle className="size-4" />}
              tone="medium"
              hint="Cases with score 30-59."
            />
            <StatCard
              label="Mean Inference Duration"
              value={formatDuration(analytics.averageProcessingTimeMs)}
              delta={analytics.deltas?.averageProcessingTimeMs}
              caption="Full multi-model execution"
              icon={<Clock className="size-4" />}
              tone="neutral"
              invertDelta
              hint="Wall-clock elapsed processing duration."
            />
          </div>
        ) : null}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Screening Trend (7 cols) */}
          <div className="panel p-5 lg:col-span-7">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Screening Volume & Risk Breakdown</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Daily distribution across Low, Medium, and High risk classifications
                </p>
              </div>
            </div>

            {analytics ? (
              <TrendChart data={analytics.trend} height={280} />
            ) : (
              <Skeleton className="h-[280px] w-full rounded-lg" />
            )}
          </div>

          {/* Risk Level Distribution Donut (5 cols) */}
          <div className="panel p-5 lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Risk Category Composition</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Overall proportion across {analytics ? formatNumber(analytics.totalScreened) : 0} cases
                </p>
              </div>
            </div>

            {analytics ? (
              <RiskChart distribution={analytics.riskDistribution} />
            ) : (
              <Skeleton className="h-[280px] w-full rounded-lg" />
            )}
          </div>
        </div>

        {/* Bottom Row: Top Risk Reasons & Latency Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Risk Reasons (7 cols) */}
          <div className="panel p-5 lg:col-span-7 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Top Risk Trigger Signals</h3>
              <p className="text-2xs text-muted-foreground mt-0.5">
                Most frequent forensic anomalies identified across flagged cases
              </p>
            </div>

            {analytics?.topRiskReasons && analytics.topRiskReasons.length > 0 ? (
              <div className="space-y-3">
                {analytics.topRiskReasons.map((reason, idx) => {
                  const sharePct = Math.round(reason.share * 100);

                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xs text-muted-foreground font-semibold">
                            0{idx + 1}
                          </span>
                          <span className="font-medium text-foreground">{reason.label}</span>
                        </div>
                        <span className="font-mono text-xs font-semibold text-risk-high">
                          {reason.count} cases ({sharePct}%)
                        </span>
                      </div>

                      <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-risk-high to-rose-400 rounded-full"
                          style={{ width: `${sharePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground p-6 text-center">
                No dominant risk reasons in this period.
              </div>
            )}
          </div>

          {/* Wall-Clock Latency Profile (5 cols) */}
          <div className="panel p-5 lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Processing Latency Distribution</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Mean vs. 95th Percentile processing duration
                </p>
              </div>
            </div>

            {analytics?.processingTimeSeries ? (
              <ProcessingTime data={analytics.processingTimeSeries} height={240} />
            ) : (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
