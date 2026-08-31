import * as React from 'react';
import { AlertOctagon, AlertTriangle, ArrowUpRight, CheckCircle2, Clock, FileWarning, Repeat, ShieldCheck } from 'lucide-react';
import type { RiskLevel } from '@/lib/types/risk';
import { RISK_LEVEL_LABELS } from '@/lib/types/risk';
import type { CaseStatus } from '@/lib/types/screening';
import { CASE_STATUS_LABELS } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';
import { riskTone } from '@/lib/utils/risk';
import { Badge } from './Badge';

const RISK_ICONS: Record<RiskLevel, React.ElementType> = {
  LOW: ShieldCheck,
  MEDIUM: AlertTriangle,
  HIGH: AlertOctagon,
};

const RISK_VARIANT: Record<RiskLevel, 'low' | 'medium' | 'high'> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

/**
 * The one way a risk level is written anywhere in the console.
 *
 * Wording comes from `RISK_LEVEL_LABELS` so a level can never be described as a
 * verdict about a person or a document — "High Risk", never "Fraudulent".
 */
export function RiskBadge({
  level,
  score,
  size = 'default',
  withIcon = true,
  className,
}: {
  level: RiskLevel;
  /** Appends the numeric score, e.g. `High Risk · 74`. */
  score?: number;
  size?: 'sm' | 'default' | 'lg';
  withIcon?: boolean;
  className?: string;
}) {
  const Icon = RISK_ICONS[level];
  return (
    <Badge variant={RISK_VARIANT[level]} size={size} className={className}>
      {withIcon && <Icon aria-hidden />}
      {RISK_LEVEL_LABELS[level]}
      {score != null && <span className="font-mono tabular opacity-80">· {Math.round(score)}</span>}
    </Badge>
  );
}

/** Compact numeric score chip for dense table rows. */
export function RiskScorePill({
  score,
  level,
  className,
}: {
  score: number;
  level: RiskLevel;
  className?: string;
}) {
  const tone = riskTone(level);
  return (
    <span
      className={cn(
        'inline-flex min-w-[2.5rem] items-center justify-center rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold tabular',
        tone.text,
        tone.bg,
        tone.border,
        className,
      )}
      title={`${RISK_LEVEL_LABELS[level]} — score ${Math.round(score)} of 100`}
    >
      {Math.round(score)}
    </span>
  );
}

const STATUS_CONFIG: Record<
  CaseStatus,
  { variant: 'default' | 'outline' | 'primary' | 'low' | 'medium' | 'high' | 'neutral'; icon: React.ElementType }
> = {
  DRAFT: { variant: 'outline', icon: FileWarning },
  PROCESSING: { variant: 'primary', icon: Clock },
  AWAITING_REVIEW: { variant: 'medium', icon: Clock },
  REVIEWED: { variant: 'low', icon: CheckCircle2 },
  ESCALATED: { variant: 'high', icon: ArrowUpRight },
  RECAPTURE_REQUESTED: { variant: 'medium', icon: Repeat },
  FAILED: { variant: 'neutral', icon: FileWarning },
};

export function CaseStatusBadge({
  status,
  size = 'default',
  className,
}: {
  status: CaseStatus;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} size={size} className={className}>
      <Icon aria-hidden />
      {CASE_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Flag for a case whose pipeline did not fully complete.
 * Shown wherever a score is shown, because a score derived from an incomplete
 * analysis must never be read as a clean result.
 */
export function PartialBadge({ className }: { className?: string }) {
  return (
    <Badge variant="medium" size="sm" className={className} title="At least one analyser did not complete">
      <AlertTriangle aria-hidden />
      Partial
    </Badge>
  );
}
