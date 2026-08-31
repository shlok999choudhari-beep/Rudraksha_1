import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { InfoHint } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils/cn';
import { formatDelta } from '@/lib/utils/formatters';

type Tone = 'neutral' | 'primary' | 'low' | 'medium' | 'high';

const TONE_STYLES: Record<Tone, { value: string; icon: string; accent: string }> = {
  neutral: {
    value: 'text-foreground',
    icon: 'border-border-strong bg-surface-muted text-muted-foreground',
    accent: 'via-border-strong',
  },
  primary: {
    value: 'text-foreground',
    icon: 'border-primary/30 bg-primary/10 text-primary',
    accent: 'via-primary/55',
  },
  low: {
    value: 'text-risk-low',
    icon: 'border-risk-low/30 bg-risk-low/10 text-risk-low',
    accent: 'via-risk-low/55',
  },
  medium: {
    value: 'text-risk-medium',
    icon: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
    accent: 'via-risk-medium/55',
  },
  high: {
    value: 'text-risk-high',
    icon: 'border-risk-high/30 bg-risk-high/10 text-risk-high',
    accent: 'via-risk-high/55',
  },
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Secondary line under the value, e.g. `62% of all screenings`. */
  caption?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  /** Percentage change against the previous comparable window. */
  delta?: number | null;
  deltaLabel?: string;
  /**
   * Set for metrics where a rise is unwelcome (processing time, high-risk count).
   * The arrow still follows the number; only the colour flips.
   */
  invertDelta?: boolean;
  /** Explains what the metric counts, so nobody has to guess. */
  hint?: string;
  href?: string;
  className?: string;
}

/**
 * KPI tile.
 *
 * Deliberately quiet: the number carries the tone, and the delta is muted unless
 * it is moving the wrong way. A dashboard where every tile shouts is a dashboard
 * an officer stops reading.
 */
export function StatCard({
  label,
  value,
  caption,
  icon,
  tone = 'neutral',
  delta,
  deltaLabel = 'vs. previous period',
  invertDelta,
  hint,
  href,
  className,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];
  const deltaText = formatDelta(delta);
  const rising = (delta ?? 0) > 0;
  const flat = delta == null || Math.abs(delta) < 0.05;
  const unwelcome = invertDelta ? rising : !rising;

  const body = (
    <>
      <span
        className={cn(
          'pointer-events-none absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent to-transparent',
          styles.accent,
        )}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="section-label truncate">{label}</p>
          {hint && <InfoHint content={hint} />}
        </div>
        {icon && (
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-lg border [&_svg]:size-4',
              styles.icon,
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <p className={cn('mt-3 font-mono text-[1.75rem] font-semibold leading-none tabular', styles.value)}>
        {value}
      </p>

      <div className="mt-2.5 flex min-h-[1.125rem] items-center gap-2">
        {deltaText && !flat && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-2xs font-semibold',
              unwelcome ? 'text-risk-medium' : 'text-risk-low',
            )}
          >
            {rising ? (
              <TrendingUp className="size-3" aria-hidden />
            ) : (
              <TrendingDown className="size-3" aria-hidden />
            )}
            {deltaText}
          </span>
        )}
        {caption ? (
          <span className="truncate text-2xs text-muted-foreground">{caption}</span>
        ) : (
          deltaText && !flat && <span className="truncate text-2xs text-muted-foreground">{deltaLabel}</span>
        )}
        {href && (
          <ArrowRight
            className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/stat:translate-x-0.5 group-hover/stat:text-foreground"
            aria-hidden
          />
        )}
      </div>
    </>
  );

  const shell = cn('panel group/stat relative overflow-hidden px-5 py-4', className);

  if (href) {
    return (
      <Link href={href} className={cn(shell, 'block transition-colors hover:border-border-strong')}>
        {body}
      </Link>
    );
  }
  return <div className={shell}>{body}</div>;
}
