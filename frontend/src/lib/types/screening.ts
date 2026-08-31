/** The screening pipeline: per-stage status plus every analyser's result shape. */

import type { BoundingBox, DocumentField, DocumentType, QualityReport } from './document';
import type { RiskAssessment, RiskCategoryKey } from './risk';

/* -------------------------------------------------------------------------- */
/* Stage status                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `PARTIAL` is load-bearing: it means the analyser ran but could not produce a
 * conclusive answer. It must never be rendered as a pass.
 */
export const STAGE_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'PARTIAL',
  'SKIPPED',
] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const PIPELINE_STAGES = [
  'quality',
  'ocr',
  'mrz',
  'validation',
  'tampering',
  'face',
  'liveness',
  'database',
  'risk',
] as const;
export type PipelineStageKey = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStageKey, string> = {
  quality: 'Image Quality',
  ocr: 'OCR Extraction',
  mrz: 'MRZ Analysis',
  validation: 'Document Validation',
  tampering: 'Tamper Analysis',
  face: 'Face Verification',
  liveness: 'Liveness',
  database: 'Database Check',
  risk: 'Risk Assessment',
};

export const PIPELINE_STAGE_DESCRIPTIONS: Record<PipelineStageKey, string> = {
  quality: 'Blur, glare, resolution and document visibility',
  ocr: 'Field-level text extraction with confidence',
  mrz: 'Machine-readable zone parse and check digits',
  validation: 'Deterministic document rules',
  tampering: 'Forensic manipulation signals',
  face: 'Document photograph vs. live capture',
  liveness: 'Presentation-attack challenge',
  database: 'Document status, watchlist and duplicates',
  risk: 'Evidence aggregation and explainable scoring',
};

export interface PipelineStageState {
  key: PipelineStageKey;
  status: StageStatus;
  /** Milliseconds the stage took, once it has settled. */
  durationMs?: number;
  /** Officer-facing message for FAILED / PARTIAL states. */
  message?: string;
  /** Retry is offered when the failure is transient. */
  retryable?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Analyser results                                                           */
/* -------------------------------------------------------------------------- */

export interface OcrResult {
  status: StageStatus;
  fields: DocumentField[];
  /** Mean field confidence, 0–1. */
  overallConfidence: number;
  /** Raw text block, shown behind a disclosure for auditors. */
  rawText?: string;
  engine?: string;
  message?: string;
}

export interface MrzResult {
  status: StageStatus;
  /** True only when the MRZ was found, parsed and all check digits validated. */
  valid: boolean;
  /** ICAO 9303 format actually detected. */
  format?: 'TD1' | 'TD2' | 'TD3' | 'MRVA' | 'MRVB' | 'UNKNOWN';
  /** The MRZ lines exactly as read, rendered in a monospace block. */
  lines: string[];
  fields: DocumentField[];
  checkDigits: MrzCheckDigit[];
  message?: string;
}

export interface MrzCheckDigit {
  field: string;
  label: string;
  expected: string;
  found: string;
  valid: boolean;
}

/** One row of the OCR vs MRZ comparison table. */
export type ComparisonStatus = 'MATCH' | 'MISMATCH' | 'UNAVAILABLE';

export interface FieldComparison {
  key: string;
  label: string;
  ocrValue: string | null;
  mrzValue: string | null;
  /** Normalised MRZ value when it differs in representation (`120100`). */
  mrzRawValue?: string;
  status: ComparisonStatus;
  note?: string;
}

export interface CrossCheckResult {
  status: StageStatus;
  comparisons: FieldComparison[];
  mismatchCount: number;
}

/* --- Deterministic document validation ------------------------------------ */

export type ValidationOutcome = 'PASS' | 'FAIL' | 'WARN' | 'NOT_APPLICABLE';

export interface ValidationCheck {
  key: string;
  label: string;
  outcome: ValidationOutcome;
  /** Plain-language statement of what the rule asserts. */
  rule: string;
  /** Observed value that produced the outcome. */
  detail?: string;
}

export interface ValidationResult {
  status: StageStatus;
  checks: ValidationCheck[];
  failedCount: number;
  rulesetVersion?: string;
  message?: string;
}

/* --- Tampering ------------------------------------------------------------- */

export type TamperCategory = 'PHOTO' | 'TEXT' | 'METADATA' | 'STRUCTURE';

export interface TamperRegion {
  id: string;
  label: string;
  category: TamperCategory;
  /** 0–1 confidence that this region was manipulated. */
  confidence: number;
  box: BoundingBox;
}

export interface TamperingResult {
  status: StageStatus;
  /** Overall manipulation probability, 0–1. */
  score: number;
  photoScore?: number;
  textScore?: number;
  metadataScore?: number;
  regions: TamperRegion[];
  /** Optional heatmap overlay URL supplied by the backend. */
  heatmapUrl?: string;
  modelVersion?: string;
  message?: string;
}

/* --- Identity -------------------------------------------------------------- */

export type FaceQuality = 'GOOD' | 'ACCEPTABLE' | 'POOR';
export type FaceMatchOutcome = 'MATCH' | 'NO_MATCH' | 'INCONCLUSIVE';

export interface FaceVerificationResult {
  status: StageStatus;
  /** Cosine similarity expressed 0–1. */
  similarity: number;
  /** Decision threshold the backend applied, 0–1. */
  threshold: number;
  outcome: FaceMatchOutcome;
  documentFaceUrl?: string;
  liveFaceUrl?: string;
  documentFaceQuality?: FaceQuality;
  liveFaceQuality?: FaceQuality;
  modelVersion?: string;
  message?: string;
}

export const LIVENESS_CHALLENGES = ['BLINK', 'TURN_LEFT', 'TURN_RIGHT', 'SMILE'] as const;
export type LivenessChallenge = (typeof LIVENESS_CHALLENGES)[number];

export const LIVENESS_CHALLENGE_PROMPTS: Record<LivenessChallenge, string> = {
  BLINK: 'Blink slowly, twice',
  TURN_LEFT: 'Turn your head slightly left',
  TURN_RIGHT: 'Turn your head slightly right',
  SMILE: 'Smile, then return to a neutral expression',
};

export interface LivenessStep {
  key: 'face_detected' | 'movement_detected' | 'challenge_completed';
  label: string;
  completed: boolean;
}

export interface LivenessResult {
  status: StageStatus;
  passed: boolean;
  challenge: LivenessChallenge;
  steps: LivenessStep[];
  /** 0–1 confidence that a live subject was presented. */
  confidence?: number;
  message?: string;
}

/* --- Database / watchlist -------------------------------------------------- */

export const DOCUMENT_DB_STATUSES = [
  'VALID',
  'EXPIRED',
  'FLAGGED',
  'REVOKED',
  'REVIEW_REQUIRED',
  'NOT_FOUND',
] as const;
export type DocumentDbStatus = (typeof DOCUMENT_DB_STATUSES)[number];

export type WatchlistOutcome = 'CLEAR' | 'POSSIBLE_MATCH' | 'REVIEW_REQUIRED';

export interface WatchlistResult {
  status: StageStatus;
  documentStatus: DocumentDbStatus;
  watchlist: WatchlistOutcome;
  /** Always surfaced in the UI so nobody mistakes prototype data for live data. */
  source: string;
  checkedAt?: string;
  notes?: string[];
  message?: string;
}

export interface DuplicateCandidate {
  candidateId: string;
  label: string;
  /** 0–1 similarity to the presented identity. */
  similarity: number;
  /** Date the candidate identity was first recorded. */
  firstSeenAt?: string;
  matchedOn: string[];
}

export interface DuplicateIdentityResult {
  status: StageStatus;
  /** `true` means "possible match, requires review" — never "confirmed". */
  possibleMatch: boolean;
  candidates: DuplicateCandidate[];
  message?: string;
}

/* --- Evidence summary ------------------------------------------------------ */

export type EvidenceVerdict = 'OK' | 'ATTENTION' | 'INCOMPLETE';

export interface EvidenceItem {
  label: string;
  verdict: EvidenceVerdict;
  detail?: string;
}

export interface EvidenceGroup {
  category: RiskCategoryKey;
  items: EvidenceItem[];
}

/* -------------------------------------------------------------------------- */
/* The aggregate screening record                                             */
/* -------------------------------------------------------------------------- */

export const CASE_STATUSES = [
  'DRAFT',
  'PROCESSING',
  'AWAITING_REVIEW',
  'REVIEWED',
  'ESCALATED',
  'RECAPTURE_REQUESTED',
  'FAILED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: 'Draft',
  PROCESSING: 'Processing',
  AWAITING_REVIEW: 'Awaiting Review',
  REVIEWED: 'Reviewed',
  ESCALATED: 'Escalated',
  RECAPTURE_REQUESTED: 'Re-capture Requested',
  FAILED: 'Failed',
};

export interface ScreeningDocumentSummary {
  documentId: string;
  type: DocumentType;
  imageUrl: string;
  /** Normalised document number, used as the case's human-readable subject. */
  documentNumber?: string;
  holderName?: string;
  fields: DocumentField[];
}

export interface ScreeningResult {
  caseId: string;
  status: CaseStatus;
  createdAt: string;
  completedAt?: string;
  /** Total wall-clock pipeline time in milliseconds. */
  processingTimeMs?: number;
  createdBy: { id: string; name: string; role: string };

  document: ScreeningDocumentSummary;
  quality: QualityReport & { status: StageStatus };
  stages: PipelineStageState[];

  ocr: OcrResult;
  mrz: MrzResult;
  crossCheck: CrossCheckResult;
  validation: ValidationResult;
  tampering: TamperingResult;
  face: FaceVerificationResult;
  liveness: LivenessResult;
  watchlist: WatchlistResult;
  duplicate: DuplicateIdentityResult;

  risk: RiskAssessment;
  evidence: EvidenceGroup[];

  review?: CaseReview;
  /** Model / ruleset stamps for the audit trail. */
  versions?: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/* Officer review                                                             */
/* -------------------------------------------------------------------------- */

export const REVIEW_ACTIONS = [
  'MARK_REVIEWED',
  'ESCALATE',
  'REQUEST_RECAPTURE',
  'ADD_NOTE',
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  MARK_REVIEWED: 'Mark as Reviewed',
  ESCALATE: 'Escalate Case',
  REQUEST_RECAPTURE: 'Request Re-Capture',
  ADD_NOTE: 'Add Note',
};

export interface CaseNote {
  id: string;
  author: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface CaseReview {
  outcome?: Exclude<ReviewAction, 'ADD_NOTE'>;
  reviewedBy?: string;
  reviewedAt?: string;
  notes: CaseNote[];
}

export interface SubmitReviewPayload {
  caseId: string;
  action: ReviewAction;
  note?: string;
  /** Required when escalating, so the supervisor has context. */
  reason?: string;
}

/* -------------------------------------------------------------------------- */
/* Screening submission                                                       */
/* -------------------------------------------------------------------------- */

export interface RunScreeningPayload {
  documentId: string;
  documentType: DocumentType;
  faceCaptureId?: string;
  livenessChallenge?: LivenessChallenge;
  /** Demo-mode only: selects one of the scripted SIH scenarios. */
  demoScenario?: DemoScenario;
  /** Demo-mode only: carries locally captured imagery into the result. */
  documentImageUrl?: string;
  liveFaceImageUrl?: string;
}

export const DEMO_SCENARIOS = [
  'GENUINE',
  'TAMPERED',
  'IMPERSONATION',
  'DUPLICATE_IDENTITY',
  'PARTIAL_FAILURE',
] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export const DEMO_SCENARIO_LABELS: Record<DemoScenario, string> = {
  GENUINE: 'Genuine document',
  TAMPERED: 'Tampered document',
  IMPERSONATION: 'Impersonation attempt',
  DUPLICATE_IDENTITY: 'Possible duplicate identity',
  PARTIAL_FAILURE: 'Analyser outage (partial analysis)',
};

export const DEMO_SCENARIO_DESCRIPTIONS: Record<DemoScenario, string> = {
  GENUINE: 'All checks consistent — expect LOW risk.',
  TAMPERED: 'DOB inconsistency plus local text anomaly — expect HIGH risk.',
  IMPERSONATION: 'Valid document, presented face does not match — expect HIGH risk.',
  DUPLICATE_IDENTITY: 'Clean document matching an existing synthetic identity.',
  PARTIAL_FAILURE: 'Tamper analyser unavailable — exercises the partial-analysis state.',
};
