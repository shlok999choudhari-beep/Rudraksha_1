'use client';

import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Cpu,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import type { PipelineStageState, StageStatus } from '@/lib/types/screening';
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_DESCRIPTIONS } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface ProcessingPipelineProps {
  stages: PipelineStageState[];
  activeIndex: number;
  progress: number;
  isPartial?: boolean;
  onRetryStage?: (stageKey: string) => void;
  onViewResults?: () => void;
  className?: string;
}

const STAGE_STATUS_ICONS: Record<
  StageStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string; badge: string }
> = {
  PENDING: {
    icon: Clock,
    color: 'text-muted-foreground',
    badge: 'bg-surface-muted text-muted-foreground border-border',
  },
  PROCESSING: {
    icon: RefreshCw,
    color: 'text-primary animate-spin',
    badge: 'bg-primary/10 text-primary border-primary/30',
  },
  COMPLETED: {
    icon: CheckCircle2,
    color: 'text-risk-low',
    badge: 'bg-risk-low/15 text-risk-low border-risk-low/30',
  },
  FAILED: {
    icon: XCircle,
    color: 'text-risk-high',
    badge: 'bg-risk-high/15 text-risk-high border-risk-high/30',
  },
  PARTIAL: {
    icon: AlertTriangle,
    color: 'text-risk-medium',
    badge: 'bg-risk-medium/15 text-risk-medium border-risk-medium/30',
  },
  SKIPPED: {
    icon: Clock,
    color: 'text-muted-foreground',
    badge: 'bg-surface-muted text-muted-foreground border-border',
  },
};

export function ProcessingPipeline({
  stages,
  activeIndex,
  progress,
  isPartial = false,
  onRetryStage,
  onViewResults,
  className,
}: ProcessingPipelineProps) {
  const isDone = progress >= 1;
  const hasFailures = stages.some((s) => s.status === 'FAILED' || s.status === 'PARTIAL');

  return (
    <div className={cn('panel p-6 space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 border border-primary/25 text-primary">
              <Cpu className="size-4" />
            </span>
            <h3 className="text-base font-bold text-foreground">
              {isDone ? 'Forensic Pipeline Complete' : 'Analyzing Document & Identity'}
            </h3>
            {isDone && !hasFailures && (
              <span className="rounded-full bg-risk-low/15 text-risk-low border border-risk-low/30 px-2.5 py-0.5 text-2xs font-semibold font-mono">
                All Checks Passed
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Running 9-stage asynchronous forensic validation and evidence aggregation engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-foreground">
            {Math.round(progress * 100)}%
          </span>
          {isDone && onViewResults && (
            <Button
              variant="default"
              size="sm"
              onClick={onViewResults}
              className="shadow-md shadow-primary/20"
            >
              <span>View Screening Report</span>
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <Progress value={progress * 100} className="h-2 rounded-full" />
        <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
          <span>Stage {Math.min(stages.length, activeIndex + 1)} of {stages.length}</span>
          <span>FastAPI Inference Engine</span>
        </div>
      </div>

      {/* Warning if Partial or Failures occurred */}
      {hasFailures && (
        <div className="rounded-xl border border-risk-medium/30 bg-risk-medium/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-risk-medium">
            <AlertTriangle className="size-4 shrink-0" />
            <span>PARTIAL ANALYSIS DETECTED</span>
          </div>
          <p className="text-2xs text-muted-foreground leading-relaxed">
            One or more sub-services could not produce a conclusive output. The aggregated risk assessment is flagged as partial. In accordance with border security protocols, this state must not be treated as a verified pass.
          </p>
        </div>
      )}

      {/* Pipeline Stage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {stages.map((stage, idx) => {
          const cfg = STAGE_STATUS_ICONS[stage.status] ?? STAGE_STATUS_ICONS.PENDING;
          const Icon = cfg.icon;
          const label = PIPELINE_STAGE_LABELS[stage.key] ?? stage.key;
          const desc = PIPELINE_STAGE_DESCRIPTIONS[stage.key] ?? '';
          const isCurrent = idx === activeIndex && stage.status === 'PROCESSING';

          return (
            <div
              key={stage.key}
              className={cn(
                'flex flex-col justify-between p-3.5 rounded-xl border transition-all',
                isCurrent
                  ? 'border-primary/50 bg-primary/10 shadow-sm'
                  : stage.status === 'COMPLETED'
                    ? 'border-border bg-surface-muted/30'
                    : stage.status === 'FAILED'
                      ? 'border-risk-high/40 bg-risk-high/5'
                      : stage.status === 'PARTIAL'
                        ? 'border-risk-medium/40 bg-risk-medium/5'
                        : 'border-border/60 bg-surface/30 opacity-70'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground">0{idx + 1}</span>
                    <span className="text-xs font-semibold text-foreground truncate">{label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{desc}</p>
                </div>

                <span
                  className={cn(
                    'grid size-7 place-items-center rounded-lg border shrink-0',
                    cfg.badge
                  )}
                  title={stage.status}
                >
                  <Icon className="size-3.5" />
                </span>
              </div>

              <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono">
                <span
                  className={cn(
                    'text-[10px] uppercase font-semibold',
                    stage.status === 'COMPLETED'
                      ? 'text-risk-low'
                      : stage.status === 'FAILED'
                        ? 'text-risk-high'
                        : stage.status === 'PARTIAL'
                          ? 'text-risk-medium'
                          : stage.status === 'PROCESSING'
                            ? 'text-primary'
                            : 'text-muted-foreground'
                  )}
                >
                  {stage.status}
                </span>

                {stage.durationMs ? (
                  <span className="text-muted-foreground">
                    {stage.durationMs}ms
                  </span>
                ) : null}
              </div>

              {stage.message && (
                <p className="text-[10px] text-risk-high mt-1 truncate">{stage.message}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
