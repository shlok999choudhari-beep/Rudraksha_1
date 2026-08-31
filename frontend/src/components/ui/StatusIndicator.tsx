import * as React from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  CircleDashed,
  Loader2,
  MinusCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * The single vocabulary for "how did this check turn out".
 *
 * `partial` and `failed` are visually distinct from `pass` on purpose: an
 * incomplete analysis must never look like a successful verification.
 */
export type IndicatorState =
  | 'pass'
  | 'fail'
  | 'warn'
  | 'partial'
  | 'processing'
  | 'pending'
  | 'skipped'
  | 'na';

const STATE_CONFIG: Record<
  IndicatorState,
  { icon: React.ElementType; tone: string; ring: string; label: string; spin?: boolean }
> = {
  pass: { icon: Check, tone: 'text-risk-low', ring: 'bg-risk-low/12 ring-risk-low/30', label: 'Pass' },
  fail: { icon: X, tone: 'text-risk-high', ring: 'bg-risk-high/12 ring-risk-high/30', label: 'Failed' },
  warn: {
    icon: AlertTriangle,
    tone: 'text-risk-medium',
    ring: 'bg-risk-medium/12 ring-risk-medium/30',
    label: 'Attention',
  },
  partial: {
    icon: MinusCircle,
    tone: 'text-risk-medium',
    ring: 'bg-risk-medium/12 ring-risk-medium/30',
    label: 'Partial',
  },
  processing: {
    icon: Loader2,
    tone: 'text-primary',
    ring: 'bg-primary/12 ring-primary/30',
    label: 'Processing',
    spin: true,
  },
  pending: {
    icon: CircleDashed,
    tone: 'text-muted-foreground',
    ring: 'bg-surface-muted ring-border',
    label: 'Waiting',
  },
  skipped: {
    icon: Ban,
    tone: 'text-muted-foreground',
    ring: 'bg-surface-muted ring-border',
    label: 'Skipped',
  },
  na: {
    icon: MinusCircle,
    tone: 'text-muted-foreground',
    ring: 'bg-surface-muted ring-border',
    label: 'Not applicable',
  },
};

const SIZES = {
  sm: { box: 'size-5', icon: 'size-3' },
  default: { box: 'size-6', icon: 'size-3.5' },
  lg: { box: 'size-8', icon: 'size-4' },
} as const;

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: IndicatorState;
  size?: keyof typeof SIZES;
  /** Show the state's word next to the glyph. */
  withLabel?: boolean;
  /** Override the default label text (`✓ PASS`, `⚠ MISMATCH`, …). */
  label?: string;
}

export function StatusIndicator({
  state,
  size = 'default',
  withLabel,
  label,
  className,
  ...props
}: StatusIndicatorProps) {
  const cfg = STATE_CONFIG[state];
  const Icon = cfg.icon;
  const dims = SIZES[size];
  const text = label ?? cfg.label;

  return (
    <span className={cn('inline-flex items-center gap-2', className)} {...props}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
          dims.box,
          cfg.ring,
          cfg.tone,
        )}
      >
        <Icon className={cn(dims.icon, cfg.spin && 'animate-spin')} aria-hidden />
      </span>
      {withLabel && (
        <span
          className={cn(
            'text-xs font-semibold uppercase tracking-[0.08em]',
            cfg.tone,
          )}
        >
          {text}
        </span>
      )}
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** A tiny pulsing dot for live/idle system status in the header. */
export function LiveDot({
  tone = 'low',
  className,
}: {
  tone?: 'low' | 'medium' | 'high' | 'primary';
  className?: string;
}) {
  const color = {
    low: 'bg-risk-low',
    medium: 'bg-risk-medium',
    high: 'bg-risk-high',
    primary: 'bg-primary',
  }[tone];
  return (
    <span className={cn('relative flex size-2', className)} aria-hidden>
      <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', color)} />
      <span className={cn('relative inline-flex size-2 rounded-full', color)} />
    </span>
  );
}

/* --------------------------------------------------------------------------- */
/* Mappers from domain enums to indicator states                              */
/* --------------------------------------------------------------------------- */

import type { EvidenceVerdict, StageStatus, ValidationOutcome } from '@/lib/types/screening';
import type { QualityVerdict } from '@/lib/types/document';

export function stageToIndicator(status: StageStatus): IndicatorState {
  switch (status) {
    case 'COMPLETED':
      return 'pass';
    case 'PROCESSING':
      return 'processing';
    case 'FAILED':
      return 'fail';
    case 'PARTIAL':
      return 'partial';
    case 'SKIPPED':
      return 'skipped';
    default:
      return 'pending';
  }
}

export function validationToIndicator(outcome: ValidationOutcome): IndicatorState {
  switch (outcome) {
    case 'PASS':
      return 'pass';
    case 'FAIL':
      return 'fail';
    case 'WARN':
      return 'warn';
    default:
      return 'na';
  }
}

export function qualityToIndicator(verdict: QualityVerdict): IndicatorState {
  switch (verdict) {
    case 'GOOD':
      return 'pass';
    case 'ACCEPTABLE':
      return 'warn';
    default:
      return 'fail';
  }
}

export function evidenceToIndicator(verdict: EvidenceVerdict): IndicatorState {
  switch (verdict) {
    case 'OK':
      return 'pass';
    case 'ATTENTION':
      return 'warn';
    default:
      return 'partial';
  }
}
