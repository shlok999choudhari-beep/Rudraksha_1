'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendPoint } from '@/lib/types/dashboard';
import { formatDateShort, formatTime } from '@/lib/utils/dates';
import { formatNumber } from '@/lib/utils/formatters';
import { AXIS_PROPS, CHART_COLORS, ChartLegendItem, ChartTooltipShell } from './chart-theme';

/**
 * Screening volume over time, stacked by risk level.
 *
 * Stacked rather than three separate lines: the officer needs the total height
 * (throughput) and the composition (how much of it needed attention) from one
 * glance, and a line chart of three near-flat series gives neither.
 */
export function TrendChart({
  data,
  granularity = 'day',
  height = 260,
}: {
  data: TrendPoint[];
  granularity?: 'hour' | 'day';
  height?: number;
}) {
  const formatBucket = (iso: string) =>
    granularity === 'hour' ? formatTime(iso, false) : formatDateShort(iso);

  const totals = data.reduce(
    (acc, point) => {
      acc.low += point.low;
      acc.medium += point.medium;
      acc.high += point.high;
      return acc;
    },
    { low: 0, medium: 0, high: 0 },
  );

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }} barCategoryGap="22%">
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatBucket} {...AXIS_PROPS} minTickGap={18} />
            <YAxis allowDecimals={false} width={44} {...AXIS_PROPS} />
            <Tooltip
              cursor={{ fill: 'hsl(220 30% 15% / 0.5)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as TrendPoint;
                return (
                  <ChartTooltipShell
                    title={formatBucket(String(label))}
                    rows={[
                      { label: 'Low risk', value: formatNumber(point.low), color: CHART_COLORS.low },
                      { label: 'Medium risk', value: formatNumber(point.medium), color: CHART_COLORS.medium },
                      { label: 'High risk', value: formatNumber(point.high), color: CHART_COLORS.high },
                    ]}
                    footer={`Total ${formatNumber(point.total)}`}
                  />
                );
              }}
            />
            {/* Stack order puts the levels that need attention on top, where they read. */}
            <Bar dataKey="low" stackId="risk" fill={CHART_COLORS.low} isAnimationActive={false} />
            <Bar dataKey="medium" stackId="risk" fill={CHART_COLORS.medium} isAnimationActive={false} />
            <Bar
              dataKey="high"
              stackId="risk"
              fill={CHART_COLORS.high}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3">
        <ChartLegendItem color={CHART_COLORS.low} label="Low" value={formatNumber(totals.low)} className="w-auto" />
        <ChartLegendItem
          color={CHART_COLORS.medium}
          label="Medium"
          value={formatNumber(totals.medium)}
          className="w-auto"
        />
        <ChartLegendItem
          color={CHART_COLORS.high}
          label="High"
          value={formatNumber(totals.high)}
          className="w-auto"
        />
      </div>
    </div>
  );
}
