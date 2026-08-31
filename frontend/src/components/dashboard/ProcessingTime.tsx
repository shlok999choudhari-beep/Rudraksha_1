'use client';

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProcessingTimePoint } from '@/lib/types/dashboard';
import { formatDateShort, formatDuration } from '@/lib/utils/dates';
import { AXIS_PROPS, CHART_COLORS, ChartLegendItem, ChartTooltipShell } from './chart-theme';

/**
 * Pipeline wall-clock time: mean with the 95th percentile above it.
 *
 * The mean alone hides the queue an officer actually feels. p95 is the number
 * that says "one in twenty travellers waited this long".
 */
export function ProcessingTime({
  data,
  height = 220,
}: {
  data: ProcessingTimePoint[];
  height?: number;
}) {
  const latest = data.at(-1);

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="vg-p95-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={(iso) => formatDateShort(String(iso))} {...AXIS_PROPS} minTickGap={20} />
            <YAxis
              width={52}
              tickFormatter={(ms) => `${Math.round(Number(ms) / 100) / 10}s`}
              {...AXIS_PROPS}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as ProcessingTimePoint;
                return (
                  <ChartTooltipShell
                    title={formatDateShort(String(label))}
                    rows={[
                      { label: 'Mean', value: formatDuration(point.averageMs), color: CHART_COLORS.muted },
                      { label: '95th percentile', value: formatDuration(point.p95Ms), color: CHART_COLORS.primary },
                    ]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="p95Ms"
              stroke={CHART_COLORS.primary}
              strokeWidth={1.5}
              fill="url(#vg-p95-fill)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="averageMs"
              stroke={CHART_COLORS.muted}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3">
        <ChartLegendItem
          color={CHART_COLORS.muted}
          label="Mean"
          value={latest ? formatDuration(latest.averageMs) : '—'}
          className="w-auto"
        />
        <ChartLegendItem
          color={CHART_COLORS.primary}
          label="95th percentile"
          value={latest ? formatDuration(latest.p95Ms) : '—'}
          className="w-auto"
        />
        <span className="ml-auto text-2xs text-muted-foreground">Latest bucket</span>
      </div>
    </div>
  );
}
