'use client';

import * as React from 'react';
import { CheckCircle2, CircleDot, AlertCircle, RefreshCw, Smile, Eye, ArrowLeftRight } from 'lucide-react';
import type { LivenessChallenge as ChallengeType, LivenessStep } from '@/lib/types/screening';
import { LIVENESS_CHALLENGE_PROMPTS } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface LivenessChallengeProps {
  challenge: ChallengeType;
  steps?: LivenessStep[];
  isActive?: boolean;
  onComplete?: () => void;
  className?: string;
}

const DEFAULT_STEPS: LivenessStep[] = [
  { key: 'face_detected', label: 'Face detected in biometric bounding zone', completed: true },
  { key: 'movement_detected', label: 'Natural head kinematics & micro-motion detected', completed: true },
  { key: 'challenge_completed', label: 'Requested challenge movement verified', completed: true },
];

export function LivenessChallenge({
  challenge,
  steps = DEFAULT_STEPS,
  isActive = false,
  className,
}: LivenessChallengeProps) {
  const prompt = LIVENESS_CHALLENGE_PROMPTS[challenge];

  const getChallengeIcon = () => {
    switch (challenge) {
      case 'BLINK':
        return <Eye className="size-5 text-primary" />;
      case 'SMILE':
        return <Smile className="size-5 text-primary" />;
      case 'TURN_LEFT':
      case 'TURN_RIGHT':
      default:
        return <ArrowLeftRight className="size-5 text-primary" />;
    }
  };

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 border border-primary/25">
            {getChallengeIcon()}
          </span>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Presentation Attack & Liveness Challenge
            </h4>
            <p className="text-2xs text-muted-foreground">
              Anti-spoofing challenge to verify physical presence against photo/video replay attacks
            </p>
          </div>
        </div>

        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-2xs font-semibold text-emerald-400 font-mono flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active Detection
        </span>
      </div>

      {/* Challenge Callout */}
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-primary/80">
            Current Action
          </span>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {prompt}
          </p>
        </div>

        <div className="text-right font-mono text-2xs text-muted-foreground hidden sm:block">
          Challenge: <strong className="text-foreground">{challenge}</strong>
        </div>
      </div>

      {/* Check Steps */}
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div
            key={step.key}
            className="flex items-center gap-3 p-2.5 rounded-lg border border-border/80 bg-surface-muted/30 text-xs"
          >
            <span className="shrink-0">
              {step.completed ? (
                <CheckCircle2 className="size-4 text-risk-low" />
              ) : (
                <CircleDot className="size-4 text-muted-foreground animate-pulse" />
              )}
            </span>
            <span
              className={cn(
                'flex-1 font-medium',
                step.completed ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
            <span className="font-mono text-2xs text-muted-foreground">
              0{idx + 1}/0{steps.length}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
