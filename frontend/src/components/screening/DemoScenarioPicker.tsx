'use client';

import * as React from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  UserX,
  Users,
  AlertCircle,
} from 'lucide-react';
import type { DemoScenario } from '@/lib/types/screening';
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_LABELS,
  DEMO_SCENARIO_DESCRIPTIONS,
} from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface DemoScenarioPickerProps {
  selectedScenario: DemoScenario;
  onSelectScenario: (scenario: DemoScenario) => void;
  disabled?: boolean;
  className?: string;
}

const SCENARIO_ICONS: Record<
  DemoScenario,
  { icon: React.ComponentType<{ className?: string }>; tone: string; risk: string }
> = {
  GENUINE: {
    icon: ShieldCheck,
    tone: 'text-risk-low border-risk-low/30 bg-risk-low/10',
    risk: 'LOW RISK (Score ~12)',
  },
  TAMPERED: {
    icon: AlertTriangle,
    tone: 'text-risk-high border-risk-high/30 bg-risk-high/10',
    risk: 'HIGH RISK (Score ~84)',
  },
  IMPERSONATION: {
    icon: UserX,
    tone: 'text-risk-high border-risk-high/30 bg-risk-high/10',
    risk: 'HIGH RISK (Score ~78)',
  },
  DUPLICATE_IDENTITY: {
    icon: Users,
    tone: 'text-foreground border-border-strong bg-surface-raised',
    risk: 'MEDIUM/HIGH (Score ~68)',
  },
  PARTIAL_FAILURE: {
    icon: AlertCircle,
    tone: 'text-risk-medium border-risk-medium/30 bg-risk-medium/10',
    risk: 'PARTIAL (Score ~45)',
  },
};

export function DemoScenarioPicker({
  selectedScenario,
  onSelectScenario,
  disabled = false,
  className,
}: DemoScenarioPickerProps) {
  return (
    <div className={cn('panel p-5 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-surface-raised border border-border-strong text-foreground">
            <Sparkles className="size-3.5" />
          </span>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Demonstration Scenarios
            </h4>
            <p className="text-2xs text-muted-foreground">
              Quickly switch between test profiles for document and biometric screening
            </p>
          </div>
        </div>

        <span className="font-mono text-[10px] text-muted-foreground uppercase bg-surface-muted px-2 py-0.5 rounded border border-border">
          Presets
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {DEMO_SCENARIOS.map((scenario) => {
          const isSelected = selectedScenario === scenario;
          const label = DEMO_SCENARIO_LABELS[scenario];
          const desc = DEMO_SCENARIO_DESCRIPTIONS[scenario];
          const cfg = SCENARIO_ICONS[scenario];
          const Icon = cfg.icon;

          return (
            <button
              key={scenario}
              type="button"
              disabled={disabled}
              onClick={() => onSelectScenario(scenario)}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                isSelected
                  ? 'border-foreground/80 bg-surface-raised shadow-sm ring-1 ring-border-strong'
                  : 'border-border bg-surface-muted/30 hover:border-border-strong hover:bg-surface-muted/70',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'grid size-8 place-items-center rounded-lg border shrink-0',
                  cfg.tone
                )}
              >
                <Icon className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-foreground truncate">
                    {label}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">
                  {cfg.risk}
                </span>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
