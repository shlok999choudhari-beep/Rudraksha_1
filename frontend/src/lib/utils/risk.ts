import {
  RISK_LEVEL_LABELS,
  RISK_RECOMMENDED_ACTION,
  RISK_THRESHOLDS,
  type RiskBreakdownItem,
  type RiskLevel,
  type RiskReasonSeverity,
  type SignalOrigin,
} from '@/lib/types/risk';
import type { StageStatus } from '@/lib/types/screening';

/**
 * Derive the level from a score using the PRD's illustrative prototype
 * thresholds. The backend is authoritative; this is only a fallback for
 * rendering scores that arrive without a level.
 */
export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.HIGH.min) return 'HIGH';
  if (score >= RISK_THRESHOLDS.MEDIUM.min) return 'MEDIUM';
  return 'LOW';
}

export function riskLabel(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level];
}

export function recommendedAction(level: RiskLevel): string {
  return RISK_RECOMMENDED_ACTION[level];
}

/* -------------------------------------------------------------------------- */
/* Colour tokens                                                              */
/* -------------------------------------------------------------------------- */

interface RiskTone {
  text: string;
  bg: string;
  border: string;
  ring: string;
  /** Raw CSS colour, for canvas/SVG/Recharts. */
  css: string;
  shadow: string;
  gradient: string;
}

export const RISK_TONES: Record<RiskLevel, RiskTone> = {
  LOW: {
    text: 'text-risk-low',
    bg: 'bg-risk-low/10',
    border: 'border-risk-low/30',
    ring: 'ring-risk-low/30',
    css: 'hsl(152 65% 34%)',
    shadow: 'shadow-glow-low',
    gradient: 'from-risk-low/15 to-transparent',
  },
  MEDIUM: {
    text: 'text-risk-medium',
    bg: 'bg-risk-medium/10',
    border: 'border-risk-medium/30',
    ring: 'ring-risk-medium/30',
    css: 'hsl(35 92% 40%)',
    shadow: 'shadow-glow-medium',
    gradient: 'from-risk-medium/15 to-transparent',
  },
  HIGH: {
    text: 'text-risk-high',
    bg: 'bg-risk-high/10',
    border: 'border-risk-high/30',
    ring: 'ring-risk-high/30',
    css: 'hsl(0 78% 50%)',
    shadow: 'shadow-glow-high',
    gradient: 'from-risk-high/15 to-transparent',
  },
};

export function riskTone(level: RiskLevel): RiskTone {
  return RISK_TONES[level];
}

/** Colours for the deterministic-vs-probabilistic distinction. */
export const ORIGIN_TONES: Record<SignalOrigin, { text: string; bg: string; border: string; css: string; label: string }> =
  {
    DETERMINISTIC: {
      text: 'text-rule',
      bg: 'bg-rule/10',
      border: 'border-rule/25',
      css: 'hsl(215 25% 40%)',
      label: 'Rule',
    },
    PROBABILISTIC: {
      text: 'text-foreground',
      bg: 'bg-surface-raised',
      border: 'border-border-strong',
      css: 'hsl(240 10% 4%)',
      label: 'AI',
    },
  };

export const SEVERITY_TONES: Record<RiskReasonSeverity, { text: string; bg: string; border: string }> = {
  INFO: { text: 'text-foreground', bg: 'bg-surface-muted', border: 'border-border' },
  WARNING: {
    text: 'text-risk-medium',
    bg: 'bg-risk-medium/10',
    border: 'border-risk-medium/30',
  },
  CRITICAL: { text: 'text-risk-high', bg: 'bg-risk-high/10', border: 'border-risk-high/30' },
};

/* -------------------------------------------------------------------------- */
/* Breakdown helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A category's severity is its share of the available points — a category that
 * contributed 31/35 is far more alarming than one that contributed 5/25.
 */
export function breakdownIntensity(item: RiskBreakdownItem): number {
  if (item.maxScore <= 0) return 0;
  return Math.min(1, Math.max(0, item.score / item.maxScore));
}

export function breakdownLevel(item: RiskBreakdownItem): RiskLevel {
  const ratio = breakdownIntensity(item);
  if (ratio >= 0.6) return 'HIGH';
  if (ratio >= 0.3) return 'MEDIUM';
  return 'LOW';
}

export function totalRiskPoints(breakdown: RiskBreakdownItem[]) {
  return breakdown.reduce(
    (acc, item) => {
      acc.score += item.score;
      acc.max += item.maxScore;
      return acc;
    },
    { score: 0, max: 0 },
  );
}

/* -------------------------------------------------------------------------- */
/* Stage status helpers                                                       */
/* -------------------------------------------------------------------------- */

/**
 * PARTIAL and FAILED deliberately share the "not a pass" visual family — the
 * spec forbids rendering an incomplete analysis as a successful verification.
 */
export function isConclusive(status: StageStatus): boolean {
  return status === 'COMPLETED';
}

export function isSettled(status: StageStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'PARTIAL' || status === 'SKIPPED';
}

export function stageProgress(statuses: StageStatus[]): number {
  if (statuses.length === 0) return 0;
  const done = statuses.filter(isSettled).length;
  const inFlight = statuses.filter((s) => s === 'PROCESSING').length;
  return Math.min(100, Math.round(((done + inFlight * 0.5) / statuses.length) * 100));
}
