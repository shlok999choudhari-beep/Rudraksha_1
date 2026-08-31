'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { RISK_LEVEL_LABELS, RISK_THRESHOLDS, type RiskLevel } from '@/lib/types/risk';
import type { RiskDistributionSlice } from '@/lib/types/dashboard';
import { formatNumber } from '@/lib/utils/formatters';
import { CHART_COLORS, ChartLegendItem, ChartTooltipShell } from './chart-theme';

const SLICE_COLOR: Record<RiskLevel, string> = {
  LOW: CHART_COLORS.low,
  MEDIUM: CHART_COLORS.medium,
  HIGH: CHART_COLORS.high,
};

const ORDER: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

/**
 * Risk-level distribution.
 *
 * A donut rather than a pie so the total can sit in the middle — the officer's
 * first question is "how many did we screen", and the second is "how were they
 * split".
 */
export function RiskChart({ distribution }: { distribution: RiskDistributionSlice[] }) {
  const byLevel = new Map(distribution.map((slice) => [slice.level, slice]));
  const data = ORDER.map((level) => ({
    level,
    label: RISK_LEVEL_LABELS[level],
    count: byLevel.get(level)?.count ?? 0,
    percentage: byLevel.get(level)?.percentage ?? 0,
  }));
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative h-44 w-full sm:h-40 sm:w-40 sm:shrink-0">
        {total === 0 ? (
          <div className="grid h-full place-items-center rounded-full border border-dashed border-border text-2xs text-muted-foreground">
            No screenings
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={2}
                strokeWidth={0}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {data.map((slice) => (
                  <Cell key={slice.level} fill={SLICE_COLOR[slice.level]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const slice = payload[0].payload as (typeof data)[number];
                  return (
                    <ChartTooltipShell
                      title={slice.label}
                      rows={[
                        { label: 'Cases', value: formatNumber(slice.count), color: SLICE_COLOR[slice.level] },
                        { label: 'Share', value: `${slice.percentage.toFixed(1)}%` },
                      ]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <p className="font-mono text-2xl font-semibold leading-none tabular text-foreground">
            {formatNumber(total)}
          </p>
          <p className="mt-1 text-2xs uppercase tracking-[0.14em] text-muted-foreground">Screened</p>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        {data.map((slice) => (
          <ChartLegendItem
            key={slice.level}
            color={SLICE_COLOR[slice.level]}
            label={`${slice.label} (${RISK_THRESHOLDS[slice.level].min}–${
              slice.level === 'HIGH' ? '100' : RISK_THRESHOLDS[slice.level].max
            })`}
            value={formatNumber(slice.count)}
            detail={`${slice.percentage.toFixed(1)}%`}
          />
        ))}
        {/*
          Restated next to every distribution: these bands are prototype
          settings, not a measured error rate.
        */}
        <p className="pt-1 text-2xs leading-relaxed text-muted-foreground/80">
          Bands are illustrative prototype thresholds, not validated performance figures.
        </p>
      </div>
    </div>
  );
}
