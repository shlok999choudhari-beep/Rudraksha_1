import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { clamp } from '@/lib/utils/formatters';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value: number;
  max?: number;
  /** Bar colour. `auto` is not supported — callers pass the semantic tone. */
  tone?: 'primary' | 'low' | 'medium' | 'high' | 'rule' | 'ai' | 'muted';
  size?: 'xs' | 'sm' | 'default' | 'lg';
  /** Animated diagonal stripes, used while a stage is actively processing. */
  indeterminate?: boolean;
  label?: string;
}

const toneClass = {
  primary: 'bg-primary',
  low: 'bg-risk-low',
  medium: 'bg-risk-medium',
  high: 'bg-risk-high',
  rule: 'bg-rule',
  ai: 'bg-ai',
  muted: 'bg-muted-foreground',
} as const;

const sizeClass = {
  xs: 'h-1',
  sm: 'h-1.5',
  default: 'h-2',
  lg: 'h-2.5',
} as const;

export function Progress({
  className,
  value,
  max = 100,
  tone = 'primary',
  size = 'default',
  indeterminate,
  label,
  ...props
}: ProgressProps) {
  const pct = clamp((value / max) * 100, 0, 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-muted ring-1 ring-inset ring-border',
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {indeterminate ? (
        <div className="stripe-progress h-full w-full animate-progress-stripe" />
      ) : (
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', toneClass[tone])}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}

/**
 * The segmented `███████░░░` meter the spec uses for risk-breakdown rows.
 * Discrete blocks read faster than a smooth bar when comparing six categories.
 */
export function SegmentedMeter({
  value,
  max = 100,
  segments = 10,
  tone = 'primary',
  className,
  ariaLabel,
}: {
  value: number;
  max?: number;
  segments?: number;
  tone?: ProgressProps['tone'];
  className?: string;
  ariaLabel?: string;
}) {
  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0;
  const filled = Math.round(ratio * segments);
  return (
    <div
      className={cn('flex items-center gap-[3px]', className)}
      role="img"
      aria-label={ariaLabel ?? `${Math.round(value)} of ${max}`}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-2.5 flex-1 rounded-[2px] transition-colors duration-500',
            i < filled ? toneClass[tone] : 'bg-surface-muted ring-1 ring-inset ring-border',
          )}
        />
      ))}
    </div>
  );
}
