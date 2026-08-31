'use client';

import * as React from 'react';
import type { RiskBreakdownItem } from '@/lib/types/risk';
import { RISK_CATEGORY_LABELS } from '@/lib/types/risk';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils/cn';

export interface RiskBreakdownProps {
  items: RiskBreakdownItem[];
  className?: string;
}

export function RiskBreakdown({ items, className }: RiskBreakdownProps) {
  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
            Evidence Category Risk Breakdown
          </h4>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Individual category contributions to the aggregate screening score
          </p>
        </div>
      </div>

      <div className="space-y-3.5">
        {items.map((item) => {
          const label = RISK_CATEGORY_LABELS[item.category] ?? item.category;
          const percentage = Math.min(100, Math.round((item.score / item.maxScore) * 100));
          const isHigh = percentage >= 60;
          const isMedium = percentage >= 30 && percentage < 60;

          return (
            <div key={item.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{label}</span>
                  <span
                    className={cn(
                      'text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border',
                      item.origin === 'DETERMINISTIC'
                        ? 'bg-surface-muted text-muted-foreground border-border'
                        : 'bg-primary/10 text-primary border-primary/20'
                    )}
                  >
                    {item.origin === 'DETERMINISTIC' ? 'Rule' : 'AI Signal'}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span
                    className={cn(
                      'font-semibold',
                      isHigh
                        ? 'text-risk-high'
                        : isMedium
                          ? 'text-risk-medium'
                          : 'text-risk-low'
                    )}
                  >
                    {item.score}
                  </span>
                  <span className="text-muted-foreground">/ {item.maxScore}</span>
                </div>
              </div>

              {/* Score Bar */}
              <div className="h-2 rounded-full bg-surface-muted overflow-hidden border border-border/60">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isHigh
                      ? 'bg-risk-high'
                      : isMedium
                        ? 'bg-risk-medium'
                        : 'bg-risk-low'
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {item.note && (
                <p className="text-[11px] text-muted-foreground">{item.note}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
