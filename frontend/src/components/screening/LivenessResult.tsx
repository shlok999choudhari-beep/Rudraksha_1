'use client';

import * as React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, UserCheck, ShieldCheck } from 'lucide-react';
import type { LivenessResult as LivenessResultType } from '@/lib/types/screening';
import { LIVENESS_CHALLENGE_PROMPTS } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface LivenessResultProps {
  liveness: LivenessResultType;
  className?: string;
}

export function LivenessResult({ liveness, className }: LivenessResultProps) {
  const prompt = LIVENESS_CHALLENGE_PROMPTS[liveness.challenge] ?? liveness.challenge;
  const isPassed = liveness.passed;

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Presentation Attack & Liveness Result
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-mono font-semibold border',
                isPassed
                  ? 'bg-risk-low/10 text-risk-low border-risk-low/30'
                  : 'bg-risk-high/15 text-risk-high border-risk-high/40'
              )}
            >
              {isPassed ? (
                <>
                  <CheckCircle2 className="size-3" />
                  LIVE SUBJECT VERIFIED
                </>
              ) : (
                <>
                  <XCircle className="size-3" />
                  LIVENESS FAILED
                </>
              )}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Validation of dynamic motion challenge against 2D photo prints and video playback spoofing
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Challenge summary */}
        <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
            Executed Challenge
          </span>
          <p className="text-sm font-semibold text-foreground">
            &quot;{prompt}&quot;
          </p>
          <div className="flex items-center gap-2 text-2xs font-mono text-muted-foreground pt-1">
            <span>Challenge Type: <strong>{liveness.challenge}</strong></span>
            {liveness.confidence !== undefined && (
              <span>· Confidence: <strong>{Math.round(liveness.confidence * 100)}%</strong></span>
            )}
          </div>
        </div>

        {/* Challenge Steps checklist */}
        <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
            Challenge Step Verification
          </span>
          <div className="space-y-1.5">
            {liveness.steps?.map((step) => (
              <div key={step.key} className="flex items-center gap-2 text-xs">
                {step.completed ? (
                  <CheckCircle2 className="size-3.5 text-risk-low shrink-0" />
                ) : (
                  <XCircle className="size-3.5 text-risk-high shrink-0" />
                )}
                <span className={step.completed ? 'text-foreground' : 'text-risk-high font-medium'}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
