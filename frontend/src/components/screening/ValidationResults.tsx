'use client';

import * as React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import type { ValidationResult, ValidationOutcome } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface ValidationResultsProps {
  validation: ValidationResult;
  className?: string;
}

const OUTCOME_CONFIG: Record<
  ValidationOutcome,
  { label: string; icon: React.ComponentType<{ className?: string }>; style: string }
> = {
  PASS: {
    label: 'PASS',
    icon: CheckCircle2,
    style: 'bg-risk-low/10 text-risk-low border-risk-low/30',
  },
  FAIL: {
    label: 'FAIL',
    icon: XCircle,
    style: 'bg-risk-high/15 text-risk-high border-risk-high/40',
  },
  WARN: {
    label: 'WARN',
    icon: AlertTriangle,
    style: 'bg-risk-medium/15 text-risk-medium border-risk-medium/30',
  },
  NOT_APPLICABLE: {
    label: 'N/A',
    icon: HelpCircle,
    style: 'bg-surface-muted text-muted-foreground border-border',
  },
};

export function ValidationResults({ validation, className }: ValidationResultsProps) {
  const hasFailed = validation.failedCount > 0;

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Deterministic Document Rules Engine
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-mono font-semibold border',
                !hasFailed
                  ? 'bg-risk-low/10 text-risk-low border-risk-low/30'
                  : 'bg-risk-high/10 text-risk-high border-risk-high/30'
              )}
            >
              {!hasFailed ? (
                <>
                  <CheckCircle2 className="size-3" />
                  All Deterministic Rules Passed
                </>
              ) : (
                <>
                  <XCircle className="size-3" />
                  {validation.failedCount} Rule Violation
                </>
              )}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Rule-based validation of expiry bounds, format syntax, dates logic, and visa constraints
          </p>
        </div>

        {validation.rulesetVersion && (
          <span className="font-mono text-[10px] text-muted-foreground bg-surface-muted px-2 py-0.5 rounded border border-border">
            Ruleset: {validation.rulesetVersion}
          </span>
        )}
      </div>

      {/* Rules List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {validation.checks.map((c) => {
          const cfg = OUTCOME_CONFIG[c.outcome] ?? OUTCOME_CONFIG.PASS;
          const Icon = cfg.icon;
          const isFailed = c.outcome === 'FAIL';

          return (
            <div
              key={c.key}
              className={cn(
                'flex items-start justify-between gap-3 p-3 rounded-xl border transition-colors',
                isFailed
                  ? 'border-risk-high/40 bg-risk-high/5'
                  : 'border-border bg-surface-muted/30 hover:bg-surface-muted/60'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground">{c.label}</div>
                <p className="text-2xs text-muted-foreground mt-0.5 leading-relaxed">{c.rule}</p>
                {c.detail && (
                  <p
                    className={cn(
                      'text-[11px] font-mono mt-1 font-medium',
                      isFailed ? 'text-risk-high' : 'text-foreground/80'
                    )}
                  >
                    Observed: {c.detail}
                  </p>
                )}
              </div>

              <span
                className={cn(
                  'inline-flex items-center gap-1 font-mono text-2xs px-2 py-0.5 rounded border shrink-0',
                  cfg.style
                )}
              >
                <Icon className="size-3" />
                <span>{cfg.label}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
