'use client';

import * as React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Shield } from 'lucide-react';
import type { EvidenceGroup, EvidenceVerdict } from '@/lib/types/screening';
import type { RiskReason } from '@/lib/types/risk';
import { RISK_CATEGORY_LABELS } from '@/lib/types/risk';
import { cn } from '@/lib/utils/cn';

export interface EvidenceSummaryProps {
  evidence: EvidenceGroup[];
  reasons: RiskReason[];
  className?: string;
}

const VERDICT_CONFIG: Record<
  EvidenceVerdict,
  { icon: React.ComponentType<{ className?: string }>; style: string; label: string }
> = {
  OK: {
    icon: CheckCircle2,
    style: 'text-risk-low',
    label: 'Passed',
  },
  ATTENTION: {
    icon: AlertTriangle,
    style: 'text-risk-high',
    label: 'Attention Required',
  },
  INCOMPLETE: {
    icon: Clock,
    style: 'text-risk-medium',
    label: 'Incomplete / Partial',
  },
};

export function EvidenceSummary({ evidence, reasons, className }: EvidenceSummaryProps) {
  return (
    <div className={cn('panel p-5 space-y-5', className)}>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
          Forensic Evidence & Findings Summary
        </h4>
        <p className="text-2xs text-muted-foreground mt-0.5">
          Explainable signals derived from cross-validation rules and deep learning models
        </p>
      </div>

      {/* Primary Flagged Reasons (Why this result?) */}
      {reasons && reasons.length > 0 && (
        <div className="rounded-xl border border-risk-high/30 bg-risk-high/10 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-risk-high">
            <AlertTriangle className="size-4" />
            <span>Why This Risk Result?</span>
          </div>

          <div className="space-y-2">
            {reasons.map((reason) => (
              <div
                key={reason.id}
                className="flex items-start gap-2.5 text-xs text-foreground bg-surface/60 rounded-lg p-2.5 border border-risk-high/20"
              >
                <span className="size-2 rounded-full bg-risk-high shrink-0 mt-1.5" />
                <div className="flex-1">
                  <span className="font-semibold text-risk-high">{reason.label}</span>
                  {reason.detail && (
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      {reason.detail}
                    </p>
                  )}
                </div>
                {reason.contribution !== undefined && (
                  <span className="font-mono text-2xs font-semibold text-risk-high">
                    +{reason.contribution} pts
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categorized Evidence Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {evidence?.map((group, groupIdx) => {
          const categoryLabel = RISK_CATEGORY_LABELS[group.category] ?? group.category ?? 'Evidence Group';
          const items = group.items ?? (group as any).signals ?? [];

          return (
            <div
              key={group.category || `group-${groupIdx}`}
              className="rounded-xl border border-border bg-surface-muted/30 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-semibold text-foreground">{categoryLabel}</span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  {items.length} checks
                </span>
              </div>

              <div className="space-y-1.5">
                {items.map((item: any, idx: number) => {
                  const itemVerdict = item.verdict ?? (item.severity === 'CRITICAL' ? 'ATTENTION' : 'OK');
                  const cfg = VERDICT_CONFIG[itemVerdict as keyof typeof VERDICT_CONFIG] ?? VERDICT_CONFIG.OK;
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs py-1"
                    >
                      <Icon className={cn('size-3.5 shrink-0 mt-0.5', cfg.style)} />
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'text-xs',
                            itemVerdict === 'ATTENTION'
                              ? 'font-medium text-risk-high'
                              : 'text-foreground'
                          )}
                        >
                          {item.label}
                        </span>
                        {(item.detail || item.value) && (
                          <p className="text-[11px] font-mono text-muted-foreground truncate">
                            {item.detail || item.value}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
