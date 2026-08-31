'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Shared Recharts styling.
 *
 * Recharts draws with SVG attributes rather than classes, so the theme's HSL
 * values have to be repeated here as literals. They mirror `globals.css` — if a
 * token changes there, change it here too.
 */
export const CHART_COLORS = {
  grid: 'hsl(240 6% 90%)',
  axis: 'hsl(240 4% 46%)',
  primary: 'hsl(240 10% 4%)',
  low: 'hsl(152 65% 34%)',
  medium: 'hsl(35 92% 40%)',
  high: 'hsl(0 78% 50%)',
  rule: 'hsl(215 25% 40%)',
  ai: 'hsl(240 10% 4%)',
  muted: 'hsl(240 4% 60%)',
} as const;

export const AXIS_PROPS = {
  stroke: CHART_COLORS.axis,
  tick: { fill: CHART_COLORS.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

interface TooltipRow {
  label: string;
  value: React.ReactNode;
  color?: string;
}

/** Themed tooltip surface — used by every chart so they read identically. */
export function ChartTooltipShell({
  title,
  rows,
  footer,
}: {
  title?: React.ReactNode;
  rows: TooltipRow[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-strong bg-popover px-3 py-2 shadow-2xl">
      {title && (
        <p className="mb-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </p>
      )}
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2.5 text-xs">
            {row.color && (
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
            )}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto font-mono font-medium tabular text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
      {footer && <p className="mt-1.5 text-2xs text-muted-foreground">{footer}</p>}
    </div>
  );
}

/** Colour swatch + label legend row, shared by the risk and trend charts. */
export function ChartLegendItem({
  color,
  label,
  value,
  detail,
  className,
}: {
  color: string;
  label: string;
  value?: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{label}</span>
      {value != null && (
        <span className="font-mono text-xs font-semibold tabular text-foreground">{value}</span>
      )}
      {detail != null && <span className="font-mono text-2xs tabular text-muted-foreground">{detail}</span>}
    </div>
  );
}
