'use client';

import * as React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Sparkles, RefreshCw } from 'lucide-react';
import type { QualityReport, QualityVerdict } from '@/lib/types/document';
import { cn } from '@/lib/utils/cn';

export interface QualityCheckProps {
  report: QualityReport;
  onRetry?: () => void;
  className?: string;
}

const VERDICT_CONFIG: Record<
  QualityVerdict,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeStyle: string }
> = {
  GOOD: {
    label: 'Good',
    icon: CheckCircle2,
    badgeStyle: 'bg-risk-low/15 text-risk-low border-risk-low/30',
  },
  ACCEPTABLE: {
    label: 'Acceptable',
    icon: AlertTriangle,
    badgeStyle: 'bg-risk-medium/15 text-risk-medium border-risk-medium/30',
  },
  POOR: {
    label: 'Poor / Retry',
    icon: XCircle,
    badgeStyle: 'bg-risk-high/15 text-risk-high border-risk-high/30',
  },
};

export function QualityCheck({ report, onRetry, className }: QualityCheckProps) {
  const { isAcceptable, checks, warnings } = report;

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Document Image Quality Analysis
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold border',
                isAcceptable
                  ? 'bg-risk-low/10 text-risk-low border-risk-low/30'
                  : 'bg-risk-high/10 text-risk-high border-risk-high/30'
              )}
            >
              {isAcceptable ? (
                <>
                  <CheckCircle2 className="size-3" />
                  Quality Acceptable
                </>
              ) : (
                <>
                  <XCircle className="size-3" />
                  Image Quality Insufficient
                </>
              )}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Pre-flight validation for resolution, blur, glare, perspective and document visibility
          </p>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 bg-surface-muted hover:bg-surface transition-colors"
          >
            <RefreshCw className="size-3" />
            <span>Re-check</span>
          </button>
        )}
      </div>

      {/* Quality Checks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {checks.map((c) => {
          const cfg = VERDICT_CONFIG[c.verdict] ?? VERDICT_CONFIG.ACCEPTABLE;
          const Icon = cfg.icon;

          return (
            <div
              key={c.key}
              className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-surface-muted/30"
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-medium text-foreground truncate">{c.label}</div>
                {c.detail && (
                  <div className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                    {c.detail}
                  </div>
                )}
                {c.hint && c.verdict !== 'GOOD' && (
                  <div className="text-[10px] text-risk-medium mt-0.5 truncate">{c.hint}</div>
                )}
              </div>

              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold border shrink-0',
                  cfg.badgeStyle
                )}
              >
                <Icon className="size-3" />
                <span>{cfg.label}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Warnings If Any */}
      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-risk-medium/30 bg-risk-medium/10 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-risk-medium">
            <AlertTriangle className="size-3.5" />
            <span>Quality Warnings</span>
          </div>
          <ul className="text-2xs text-muted-foreground list-disc list-inside space-y-0.5 pl-1">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {!isAcceptable && (
        <div className="rounded-lg border border-risk-high/40 bg-risk-high/10 p-3 flex items-start gap-3">
          <XCircle className="size-4 text-risk-high shrink-0 mt-0.5" />
          <div className="text-xs text-foreground">
            <p className="font-semibold text-risk-high">Capture quality is below the automated analysis threshold.</p>
            <p className="text-muted-foreground text-2xs mt-0.5">
              OCR extraction and tamper analysis require a clearer document scan with all four corners visible and minimal glare. Please re-capture or upload a clearer document.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
