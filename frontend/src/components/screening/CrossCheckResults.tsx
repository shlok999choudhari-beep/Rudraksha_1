'use client';

import * as React from 'react';
import { CheckCircle2, AlertTriangle, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import type { CrossCheckResult, ComparisonStatus } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface CrossCheckResultsProps {
  crossCheck: CrossCheckResult;
  className?: string;
}

const STATUS_CONFIG: Record<
  ComparisonStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; style: string }
> = {
  MATCH: {
    label: 'MATCH',
    icon: CheckCircle2,
    style: 'bg-risk-low/10 text-risk-low border-risk-low/30',
  },
  MISMATCH: {
    label: 'MISMATCH',
    icon: AlertTriangle,
    style: 'bg-risk-high/15 text-risk-high border-risk-high/40 font-bold',
  },
  UNAVAILABLE: {
    label: 'N/A',
    icon: AlertTriangle,
    style: 'bg-surface-muted text-muted-foreground border-border',
  },
};

export function CrossCheckResults({ crossCheck, className }: CrossCheckResultsProps) {
  const hasMismatches = crossCheck.mismatchCount > 0;

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              OCR vs. MRZ Cross-Validation
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-mono font-semibold border',
                !hasMismatches
                  ? 'bg-risk-low/10 text-risk-low border-risk-low/30'
                  : 'bg-risk-high/10 text-risk-high border-risk-high/30'
              )}
            >
              {!hasMismatches ? (
                <>
                  <CheckCircle2 className="size-3" />
                  All Fields Consistent
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3" />
                  {crossCheck.mismatchCount} Inconsistency Detected
                </>
              )}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Cross-checks visual inspection text against machine-readable zone data to detect altered fields
          </p>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-muted/60 border-b border-border text-2xs font-mono text-muted-foreground uppercase">
            <tr>
              <th className="py-2.5 px-4 font-medium">Field</th>
              <th className="py-2.5 px-4 font-medium">Visual OCR Value</th>
              <th className="py-2.5 px-4 font-medium">MRZ Decoded Value</th>
              <th className="py-2.5 px-4 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {crossCheck.comparisons.map((c) => {
              const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.MATCH;
              const Icon = cfg.icon;
              const isMismatch = c.status === 'MISMATCH';

              return (
                <tr
                  key={c.key}
                  className={cn(
                    'transition-colors',
                    isMismatch ? 'bg-risk-high/5 hover:bg-risk-high/10' : 'hover:bg-surface-muted/30'
                  )}
                >
                  <td className="py-3 px-4 font-medium text-foreground">{c.label}</td>
                  <td className="py-3 px-4 font-mono">
                    <span
                      className={cn(
                        'px-2 py-1 rounded text-xs',
                        isMismatch ? 'bg-risk-high/15 text-risk-high font-bold' : 'text-foreground'
                      )}
                    >
                      {c.ocrValue || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span
                      className={cn(
                        'px-2 py-1 rounded text-xs',
                        isMismatch ? 'bg-risk-high/15 text-risk-high font-bold' : 'text-foreground'
                      )}
                    >
                      {c.mrzValue || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 font-mono text-2xs px-2 py-0.5 rounded border',
                        cfg.style
                      )}
                    >
                      <Icon className="size-3" />
                      <span>{cfg.label}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMismatches && (
        <div className="rounded-lg border border-risk-high/40 bg-risk-high/10 p-3 flex items-start gap-2.5 text-xs text-foreground">
          <AlertTriangle className="size-4 text-risk-high shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-risk-high">OCR/MRZ Discrepancy Flag: </span>
            A field mismatch between the printed visual zone and the optical MRZ is strong forensic evidence of localized text tampering or document alteration requiring secondary verification.
          </div>
        </div>
      )}
    </div>
  );
}
