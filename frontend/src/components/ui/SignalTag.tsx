import * as React from 'react';
import { Cpu, Ruler } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { SignalOrigin } from '@/lib/types/risk';
import { Tooltip } from './Tooltip';

const COPY: Record<SignalOrigin, { label: string; icon: React.ElementType; explain: string; cls: string }> =
  {
    DETERMINISTIC: {
      label: 'Rule',
      icon: Ruler,
      explain:
        'Deterministic rule check. Produces a definite pass or fail from the document’s own data — no model inference involved.',
      cls: 'border-border-strong bg-surface-muted text-muted-foreground',
    },
    PROBABILISTIC: {
      label: 'AI',
      icon: Cpu,
      explain:
        'Probabilistic model output. Produces a likelihood, not a verdict, and must be weighed alongside other evidence.',
      cls: 'border-border-strong bg-surface-raised text-foreground font-mono',
    },
  };

/**
 * Marks whether a signal came from the deterministic rule engine or from a
 * model. Required by the spec: rules and AI outputs must stay visually distinct
 * everywhere they appear, including inside aggregated views.
 */
export function SignalTag({
  origin,
  className,
  showLabel = true,
  withTooltip = true,
}: {
  origin: SignalOrigin;
  className?: string;
  showLabel?: boolean;
  withTooltip?: boolean;
}) {
  const cfg = COPY[origin];
  const Icon = cfg.icon;

  const tag = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em]',
        cfg.cls,
        className,
      )}
    >
      <Icon className="size-2.5" aria-hidden />
      {showLabel && cfg.label}
    </span>
  );

  if (!withTooltip) return tag;
  return <Tooltip content={cfg.explain}>{tag}</Tooltip>;
}

/** Full-width banner introducing a block of same-origin signals. */
export function SignalSectionHeading({
  origin,
  title,
  description,
  className,
}: {
  origin: SignalOrigin;
  title: string;
  description?: string;
  className?: string;
}) {
  const cfg = COPY[origin];
  const Icon = cfg.icon;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border',
          cfg.cls,
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="section-label">{title}</h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
