'use client';

import * as React from 'react';
import { Check, FileText, Camera, Cpu, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type ScreeningStep = 1 | 2 | 3 | 4;

export interface ScreeningStepperProps {
  currentStep: ScreeningStep;
  onStepClick?: (step: ScreeningStep) => void;
  canNavigateBack?: boolean;
  className?: string;
}

const STEPS = [
  { step: 1, label: 'Document', subtitle: 'Upload & Quality Check', icon: FileText },
  { step: 2, label: 'Live Face', subtitle: 'Camera & Liveness', icon: Camera },
  { step: 3, label: 'Processing', subtitle: 'AI Forensic Pipeline', icon: Cpu },
  { step: 4, label: 'Result', subtitle: 'Risk & Evidence Review', icon: FileCheck },
] as const;

export function ScreeningStepper({
  currentStep,
  onStepClick,
  canNavigateBack = false,
  className,
}: ScreeningStepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <nav aria-label="Screening workflow progress">
        <ol className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          {STEPS.map((s) => {
            const isCompleted = s.step < currentStep;
            const isCurrent = s.step === currentStep;
            const isClickable = canNavigateBack && isCompleted && onStepClick;
            const Icon = s.icon;

            return (
              <li
                key={s.step}
                className={cn(
                  'relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
                  isCurrent
                    ? 'border-peach-400/90 bg-gradient-to-br from-peach-50/90 via-surface to-surface shadow-[0_4px_16px_-4px_rgba(245,123,74,0.2)] ring-1 ring-peach-300/40'
                    : isCompleted
                      ? 'border-border bg-surface/90 hover:border-peach-200'
                      : 'border-border/60 bg-surface/40 opacity-60',
                  isClickable && 'cursor-pointer hover:bg-peach-50/50'
                )}
                onClick={() => isClickable && onStepClick(s.step as ScreeningStep)}
              >
                <div
                  className={cn(
                    'grid size-8 sm:size-9 place-items-center rounded-lg font-mono text-xs font-semibold shrink-0 transition-colors',
                    isCurrent
                      ? 'bg-gradient-to-br from-peach-500 to-peach-600 text-white shadow-sm'
                      : isCompleted
                        ? 'bg-peach-100 text-peach-700 border border-peach-200/80'
                        : 'bg-surface-muted text-muted-foreground border border-border'
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-4 stroke-[2.5]" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      'font-mono text-[10px] uppercase tracking-wider',
                      isCurrent ? 'text-peach-700 font-semibold' : 'text-muted-foreground'
                    )}>
                      Step 0{s.step}
                    </span>
                    {isCurrent && (
                      <span className="size-1.5 rounded-full bg-peach-500 animate-pulse" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'text-xs sm:text-sm font-semibold truncate',
                      isCurrent
                        ? 'text-foreground font-bold'
                        : isCompleted
                          ? 'text-foreground/90'
                          : 'text-muted-foreground'
                    )}
                  >
                    {s.label}
                  </div>
                  <div className="hidden sm:block text-[11px] text-muted-foreground truncate">
                    {s.subtitle}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
