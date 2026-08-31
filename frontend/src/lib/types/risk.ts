/** Risk scoring, thresholds and explainability contracts. */

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Illustrative prototype thresholds taken from the PRD.
 * These are NOT validated performance figures and must always be presented as
 * prototype configuration, never as accuracy claims.
 */
export const RISK_THRESHOLDS = {
  LOW: { min: 0, max: 29 },
  MEDIUM: { min: 30, max: 59 },
  HIGH: { min: 60, max: 100 },
} as const;

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: 'Low Risk',
  MEDIUM: 'Medium Risk',
  HIGH: 'High Risk',
};

/** Recommended officer action per level — never a border-admission decision. */
export const RISK_RECOMMENDED_ACTION: Record<RiskLevel, string> = {
  LOW: 'Standard Processing',
  MEDIUM: 'Officer Review Recommended',
  HIGH: 'Secondary Verification Required',
};

export const RISK_LEVEL_SUBTITLE: Record<RiskLevel, string> = {
  LOW: 'No significant adverse evidence detected',
  MEDIUM: 'Some evidence requires officer review',
  HIGH: 'Suspicious evidence detected',
};

/** The six evidence categories aggregated by the risk engine. */
export const RISK_CATEGORIES = [
  'document_validity',
  'ocr_mrz_consistency',
  'tampering',
  'identity',
  'liveness',
  'database',
] as const;
export type RiskCategoryKey = (typeof RISK_CATEGORIES)[number];

export const RISK_CATEGORY_LABELS: Record<RiskCategoryKey, string> = {
  document_validity: 'Document Validity',
  ocr_mrz_consistency: 'OCR / MRZ Consistency',
  tampering: 'Tampering',
  identity: 'Identity',
  liveness: 'Liveness',
  database: 'Database',
};

/**
 * Which engine produced a category's contribution.
 * The UI must keep `DETERMINISTIC` and `PROBABILISTIC` visually distinct.
 */
export type SignalOrigin = 'DETERMINISTIC' | 'PROBABILISTIC';

export const RISK_CATEGORY_ORIGIN: Record<RiskCategoryKey, SignalOrigin> = {
  document_validity: 'DETERMINISTIC',
  ocr_mrz_consistency: 'DETERMINISTIC',
  tampering: 'PROBABILISTIC',
  identity: 'PROBABILISTIC',
  liveness: 'PROBABILISTIC',
  database: 'DETERMINISTIC',
};

export interface RiskBreakdownItem {
  category: RiskCategoryKey;
  /** Points contributed to the aggregate risk score. */
  score: number;
  /** Maximum points this category can contribute. */
  maxScore: number;
  origin: SignalOrigin;
  /** Short explanation of why this category scored what it did. */
  note?: string;
  /** True when the underlying analyser did not complete. */
  incomplete?: boolean;
}

export type RiskReasonSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/**
 * A single explainable reason. The `label` is officer-facing copy and must never
 * assert fraud — see the prohibited-language rules in the spec.
 */
export interface RiskReason {
  id: string;
  label: string;
  severity: RiskReasonSeverity;
  category: RiskCategoryKey;
  /** Supporting detail, e.g. `OCR: 12 JAN 2001 · MRZ: 12 JAN 2000`. */
  detail?: string;
  /** Points this specific reason added to the score, when attributable. */
  contribution?: number;
}

export interface RiskAssessment {
  /** 0–100 aggregate, after any escalation rules have been applied. */
  score: number;
  /**
   * 0–100 weighted-evidence score before escalation rules.
   * Shown alongside `score` so an officer can see exactly what raised the level.
   */
  baseScore: number;
  level: RiskLevel;
  recommendedAction: string;
  reasons: RiskReason[];
  breakdown: RiskBreakdownItem[];
  /**
   * Rules that raised the level independently of the weighted sum. A single
   * decisive signal (identity non-match, revoked document, failed liveness)
   * must not be diluted by five categories that happen to look clean.
   */
  escalations: RiskEscalation[];
  /** Set when one or more analysers failed; the score is then not conclusive. */
  partial: boolean;
  /** Version stamps recorded in the audit trail. */
  engineVersion?: string;
  rulesetVersion?: string;
  evaluatedAt: string;
}

/** An override rule that enforces a minimum risk score. */
export interface RiskEscalation {
  /** Machine key, e.g. `IDENTITY_NON_MATCH`. */
  rule: string;
  /** Officer-facing explanation of what the rule asserts. */
  label: string;
  /** Minimum aggregate score this rule enforces. */
  floorScore: number;
  appliedLevel: RiskLevel;
}
