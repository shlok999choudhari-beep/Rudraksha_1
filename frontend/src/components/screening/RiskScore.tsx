'use client';

import * as React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, Info, AlertCircle } from 'lucide-react';
import type { RiskAssessment, RiskLevel } from '@/lib/types/risk';
import {
  RISK_LEVEL_LABELS,
  RISK_RECOMMENDED_ACTION,
  RISK_LEVEL_SUBTITLE,
} from '@/lib/types/risk';
import { cn } from '@/lib/utils/cn';

export interface RiskScoreProps {
  assessment: RiskAssessment;
  className?: string;
}

const LEVEL_STYLES: Record<
  RiskLevel,
  {
    badge: string;
    border: string;
    bg: string;
    text: string;
    indicatorBg: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  LOW: {
    badge: 'bg-risk-low/20 text-risk-low border-risk-low/40',
    border: 'border-risk-low/40',
    bg: 'from-risk-low/10 via-surface to-background',
    text: 'text-risk-low',
    indicatorBg: 'bg-risk-low',
    icon: ShieldCheck,
  },
  MEDIUM: {
    badge: 'bg-risk-medium/20 text-risk-medium border-risk-medium/40',
    border: 'border-risk-medium/40',
    bg: 'from-risk-medium/10 via-surface to-background',
    text: 'text-risk-medium',
    indicatorBg: 'bg-risk-medium',
    icon: AlertTriangle,
  },
  HIGH: {
    badge: 'bg-risk-high/20 text-risk-high border-risk-high/40',
    border: 'border-risk-high/40',
    bg: 'from-risk-high/10 via-surface to-background',
    text: 'text-risk-high',
    indicatorBg: 'bg-risk-high',
    icon: ShieldAlert,
  },
};

export function RiskScore({ assessment, className }: RiskScoreProps) {
  const { score, baseScore, level, recommendedAction, partial, escalations, reasons } = assessment;
  const style = LEVEL_STYLES[level] ?? LEVEL_STYLES.LOW;
  const Icon = style.icon;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-r p-6 shadow-sm transition-all',
        style.border,
        style.bg,
        className
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Side: Score & Verdict */}
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'grid size-20 place-items-center rounded-2xl border bg-surface/90 shadow-inner shrink-0',
              style.border
            )}
          >
            <div className="text-center">
              <span className={cn('font-mono text-3xl font-black tabular leading-none', style.text)}>
                {score}
              </span>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
                Score / 100
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider font-mono border',
                  style.badge
                )}
              >
                <Icon className="size-4" />
                <span>{RISK_LEVEL_LABELS[level]}</span>
              </span>

              {partial && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-2xs font-mono font-semibold text-amber-400">
                  <AlertCircle className="size-3" />
                  Partial Analysis
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-foreground">
              {recommendedAction}
            </h2>
            <p className="text-xs text-muted-foreground">
              {RISK_LEVEL_SUBTITLE[level]}
            </p>
          </div>
        </div>

        {/* Right Side: Risk Threshold Gauge & Baseline */}
        <div className="md:w-72 space-y-3 bg-surface/60 backdrop-blur rounded-xl p-3.5 border border-border">
          <div className="flex justify-between text-2xs font-mono text-muted-foreground">
            <span>Prototype Thresholds</span>
            <span>Current: <strong>{score}</strong></span>
          </div>

          {/* 3-segment Visual Meter */}
          <div className="relative h-3 rounded-full bg-surface-muted overflow-hidden flex border border-border">
            <div className="w-[30%] bg-emerald-500/40 border-r border-background" title="LOW (0-29)" />
            <div className="w-[30%] bg-amber-500/40 border-r border-background" title="MEDIUM (30-59)" />
            <div className="w-[40%] bg-rose-500/40" title="HIGH (60-100)" />

            {/* Score Marker Pin */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-white shadow-md transition-all duration-500"
              style={{ left: `calc(${Math.min(100, Math.max(0, score))}% - 3px)` }}
            />
          </div>

          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span className="text-risk-low">LOW 0–29</span>
            <span className="text-risk-medium">MED 30–59</span>
            <span className="text-risk-high">HIGH 60+</span>
          </div>
        </div>
      </div>

      {/* Escalation Rules Notification If Applied */}
      {escalations && escalations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/60 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="size-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Escalation Override: </span>
            {escalations.map((e) => e.label).join('; ')}
          </div>
        </div>
      )}
    </div>
  );
}
