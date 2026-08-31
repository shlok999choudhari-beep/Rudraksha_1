'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  ScanLine,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import {
  StatCard,
  RiskChart,
  TrendChart,
  ProcessingTime,
  RecentCases,
} from '@/components/dashboard';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDashboardStatistics } from '@/lib/hooks/useDashboard';
import { useAuth } from '@/providers/AuthProvider';
import type { AnalyticsRange } from '@/lib/types/dashboard';
import { formatDuration } from '@/lib/utils/dates';
import { formatNumber } from '@/lib/utils/formatters';

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const { data: stats, isLoading, refetch } = useDashboardStatistics(range);

  return (
    <PageContainer
      title="Screening Dashboard"
      description={`Operational overview and real-time document integrity signals for ${user?.station ?? 'Checkpoint Console'}`}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Switcher */}
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
            title="Refresh statistics"
          >
            <RefreshCw className="size-3.5" />
          </Button>

          {/* New Screening CTA */}
          <Link href="/screening/new">
            <Button variant="default" size="default">
              <ScanLine className="size-4 mr-1.5" />
              <span>New Screening</span>
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Console Overview Banner */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="grid size-10 place-items-center rounded-lg border border-border-strong bg-surface-raised text-foreground shrink-0">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    VeriGuard Decision Support Console
                  </h2>
                  <span className="rounded border border-border-strong bg-surface-raised px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                    Station Active
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                  Document forensics, OCR/MRZ cross-validation, liveness verification, and explainable risk scoring. All signals provide evidence for officer review.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Link href="/screening/new" className="w-full sm:w-auto">
                <Button variant="default" size="sm" className="w-full">
                  <ScanLine className="size-3.5 mr-1" />
                  <span>Start Screening</span>
                </Button>
              </Link>
              <Link href="/cases" className="w-full sm:w-auto">
                <Button variant="secondary" size="sm" className="w-full">
                  <span>Case Archive</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Top KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="panel p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Total Screened"
              value={formatNumber(stats.totalScreened)}
              delta={stats.deltas?.totalScreened}
              deltaLabel="vs. previous window"
              icon={<Layers className="size-4" />}
              tone="primary"
              hint="Total identity and document integrity screening cases completed in this time frame."
              href="/cases"
            />
            <StatCard
              label="LOW Risk (Normal)"
              value={formatNumber(stats.lowRisk)}
              delta={stats.deltas?.lowRisk}
              caption={`${Math.round(
                (stats.lowRisk / Math.max(1, stats.totalScreened)) * 100
              )}% of total cases`}
              icon={<ShieldCheck className="size-4" />}
              tone="low"
              hint="Cases with score < 30 where all signals aligned consistently."
              href="/cases?riskLevel=LOW"
            />
            <StatCard
              label="MEDIUM Risk"
              value={formatNumber(stats.mediumRisk)}
              delta={stats.deltas?.mediumRisk}
              caption="Review recommended"
              icon={<AlertTriangle className="size-4" />}
              tone="medium"
              hint="Cases with score 30–59 displaying minor discrepancies or marginal quality."
              href="/cases?riskLevel=MEDIUM"
            />
            <StatCard
              label="HIGH Risk Flagged"
              value={formatNumber(stats.highRisk)}
              delta={stats.deltas?.highRisk}
              caption="Secondary inspection required"
              icon={<ShieldAlert className="size-4" />}
              tone="high"
              invertDelta
              hint="Cases with score 60+ displaying tampering signals, DOB mismatches, or face mismatch."
              href="/cases?riskLevel=HIGH"
            />
            <StatCard
              label="Avg Processing Time"
              value={formatDuration(stats.averageProcessingTimeMs)}
              delta={stats.deltas?.averageProcessingTimeMs}
              caption="Mean inference latency"
              icon={<Clock className="size-4" />}
              tone="neutral"
              invertDelta
              hint="End-to-end multi-analyser processing wall clock latency."
            />
          </div>
        ) : null}

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart (2 cols) */}
          <div className="panel p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Screening Volume & Risk Trend</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Daily distribution of Low, Medium, and High risk assessments
                </p>
              </div>
            </div>

            {stats ? (
              <TrendChart data={stats.trend} height={260} />
            ) : (
              <Skeleton className="h-[260px] w-full rounded-lg" />
            )}
          </div>

          {/* Risk Distribution Donut (1 col) */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Risk Distribution</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Breakdown across {stats ? formatNumber(stats.totalScreened) : 0} screened cases
                </p>
              </div>
            </div>

            {stats ? (
              <RiskChart distribution={stats.riskDistribution} />
            ) : (
              <Skeleton className="h-[260px] w-full rounded-lg" />
            )}
          </div>
        </div>

        {/* Secondary Row: Processing Time & Recent Cases */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Processing Latency Profile */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pipeline Latency</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Mean vs. 95th Percentile processing duration
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded border border-border-strong bg-surface-muted px-2 py-0.5 text-2xs font-mono text-muted-foreground">
                Engine Status
              </span>
            </div>

            {stats ? (
              <ProcessingTime
                data={stats.trend.map((t) => ({
                  date: t.date,
                  averageMs: stats.averageProcessingTimeMs,
                  p95Ms: Math.round(stats.averageProcessingTimeMs * 1.4),
                }))}
                height={220}
              />
            ) : (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            )}
          </div>

          {/* Recent High Risk Cases Table (2 cols) */}
          <div className="lg:col-span-2">
            {stats ? (
              <RecentCases cases={stats.recentHighRiskCases} />
            ) : (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
