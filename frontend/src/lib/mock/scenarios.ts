/**
 * Demo screening construction.
 *
 * Builds complete, internally consistent `ScreeningResult` objects for the SIH
 * demonstration. "Internally consistent" is the whole point: category points and
 * escalation rules are *derived from the analyser outputs*, and the reasons cite
 * those same outputs. Nothing is scored independently of the evidence, so the
 * result page can never contradict the panels above it.
 *
 * This file only shapes demo data. Real scoring belongs to the backend risk
 * engine — see `lib/api/screening.ts` for the live path.
 */

import {
  RISK_CATEGORY_ORIGIN,
  RISK_RECOMMENDED_ACTION,
  RISK_THRESHOLDS,
  type RiskAssessment,
  type RiskBreakdownItem,
  type RiskCategoryKey,
  type RiskEscalation,
  type RiskLevel,
  type RiskReason,
} from '@/lib/types/risk';
import {
  PIPELINE_STAGES,
  type CrossCheckResult,
  type DemoScenario,
  type DuplicateIdentityResult,
  type EvidenceGroup,
  type FaceVerificationResult,
  type FieldComparison,
  type LivenessChallenge,
  type LivenessResult,
  type MrzCheckDigit,
  type MrzResult,
  type OcrResult,
  type PipelineStageState,
  type ScreeningResult,
  type StageStatus,
  type TamperingResult,
  type ValidationCheck,
  type ValidationResult,
  type WatchlistResult,
} from '@/lib/types/screening';
import type { DocumentField, DocumentType, QualityReport } from '@/lib/types/document';
import { formatDocumentDate } from '@/lib/utils/dates';
import { clamp } from '@/lib/utils/formatters';
import {
  buildMrvbMrz,
  buildTd3Mrz,
  makeIdentity,
  toMrzDate,
  type MrzBuildResult,
  type SyntheticIdentity,
} from './identities';
import { documentSvgDataUri, faceSvgDataUri } from './svg';
import { hashString, makeRng, rngFloat, rngInt } from './seed';

/* -------------------------------------------------------------------------- */
/* Scoring configuration                                                      */
/* -------------------------------------------------------------------------- */

/** Maximum points each evidence category can contribute to the aggregate. */
export const CATEGORY_MAX: Record<RiskCategoryKey, number> = {
  document_validity: 30,
  ocr_mrz_consistency: 25,
  tampering: 35,
  identity: 30,
  liveness: 25,
  database: 40,
};

/** Fields whose OCR/MRZ disagreement is decisive rather than merely additive. */
const PRIMARY_IDENTITY_FIELDS = new Set(['dateOfBirth', 'documentNumber', 'surname']);

/** Face similarity decision threshold the prototype applies. */
const FACE_THRESHOLD = 0.62;

/* -------------------------------------------------------------------------- */
/* Options                                                                    */
/* -------------------------------------------------------------------------- */

export interface BuildScenarioOptions {
  scenario: DemoScenario;
  caseId: string;
  documentType: DocumentType;
  /** Seeds the synthetic identity and every jittered metric. */
  seed?: string;
  createdAt?: Date;
  createdBy?: { id: string; name: string; role: string };
  livenessChallenge?: LivenessChallenge;
  /** Officer-supplied imagery; falls back to a generated specimen. */
  documentImageUrl?: string;
  liveFaceImageUrl?: string;
  processingTimeMs?: number;
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

export function buildScreeningResult(options: BuildScenarioOptions): ScreeningResult {
  const {
    scenario,
    caseId,
    documentType,
    seed = caseId,
    createdAt = new Date(),
    createdBy = { id: 'u-officer', name: 'A. Sharma', role: 'OFFICER' },
    livenessChallenge = 'TURN_RIGHT',
    documentImageUrl,
    liveFaceImageUrl,
    processingTimeMs,
  } = options;

  const rng = makeRng(hashString(`${seed}:${scenario}`));
  const identity = makeIdentity(`${seed}:identity`);

  const tampered = scenario === 'TAMPERED';
  const impersonation = scenario === 'IMPERSONATION';
  const duplicated = scenario === 'DUPLICATE_IDENTITY';
  const partialFailure = scenario === 'PARTIAL_FAILURE';

  /* --- Printed values vs machine-readable zone --------------------------- */
  // In the tampered scenario the *printed* birth year was altered while the MRZ
  // still encodes the original. That single asymmetry drives the DOB mismatch,
  // the failed deterministic rule, the low-confidence OCR field and the tamper
  // region: one cause, four visible consequences.
  const printedDob = tampered ? shiftYear(identity.dateOfBirth, 1) : identity.dateOfBirth;

  const mrzBuild: MrzBuildResult =
    documentType === 'PASSPORT' ? buildTd3Mrz(identity) : buildMrvbMrz(identity);

  /* --- Analysers -------------------------------------------------------- */
  const ocr = buildOcr(identity, printedDob, documentType, rng, tampered);
  const mrz = buildMrz(identity, mrzBuild, documentType);
  const crossCheck = buildCrossCheck(ocr, mrz);
  const validation = buildValidation(identity, documentType, createdAt, crossCheck, mrz);
  const tampering = partialFailure ? failedTampering() : buildTampering(rng, tampered);
  const face = buildFace(identity, rng, impersonation, liveFaceImageUrl);
  const liveness = buildLiveness(livenessChallenge, rng);
  const watchlist = buildWatchlist(tampered, createdAt);
  const duplicate = buildDuplicate(rng, duplicated);
  const quality = buildQuality(rng);

  const imageUrl =
    documentImageUrl ??
    documentSvgDataUri({
      documentType,
      surname: identity.surname,
      givenNames: identity.givenNames,
      dateOfBirth: formatDocumentDate(printedDob),
      nationality: identity.nationality,
      documentNumber: identity.documentNumber,
      sex: identity.sex,
      placeOfBirth: identity.placeOfBirth,
      issueDate: formatDocumentDate(identity.issueDate),
      expiryDate: formatDocumentDate(identity.expiryDate),
      issuingAuthority: identity.issuingAuthority,
      mrzLines: mrzBuild.lines,
      tamperHints: tampered ? { dob: true } : undefined,
    });

  /* --- Risk ------------------------------------------------------------- */
  const ctx: RiskContext = {
    createdAt,
    ocr,
    crossCheck,
    validation,
    tampering,
    face,
    liveness,
    watchlist,
    duplicate,
  };
  const risk = buildRisk(ctx);

  /* --- Stages ----------------------------------------------------------- */
  const stages = buildStages(
    {
      quality: 'COMPLETED',
      ocr: ocr.status,
      mrz: mrz.status,
      validation: validation.status,
      tampering: tampering.status,
      face: face.status,
      liveness: liveness.status,
      database: watchlist.status,
      risk: risk.partial ? 'PARTIAL' : 'COMPLETED',
    },
    rng,
  );

  const totalMs = processingTimeMs ?? stages.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

  return {
    caseId,
    status: 'AWAITING_REVIEW',
    createdAt: createdAt.toISOString(),
    completedAt: new Date(createdAt.getTime() + totalMs).toISOString(),
    processingTimeMs: totalMs,
    createdBy,
    document: {
      documentId: `doc-${caseId.toLowerCase()}`,
      type: documentType,
      imageUrl,
      documentNumber: identity.documentNumber,
      holderName: `${identity.givenNames} ${identity.surname}`,
      fields: ocr.fields,
    },
    quality: { ...quality, status: 'COMPLETED' },
    stages,
    ocr,
    mrz,
    crossCheck,
    validation,
    tampering,
    face,
    liveness,
    watchlist,
    duplicate,
    risk,
    evidence: buildEvidence(ctx),
    review: { notes: [] },
    versions: {
      'risk-engine': 'v0.4.1-prototype',
      ruleset: 'icao-9303/2026.02',
      'tamper-model': partialFailure ? 'unavailable' : 'vg-tamper-cnn v0.3.0',
      'face-model': 'vg-face-embed v1.2.0',
      'liveness-model': 'vg-challenge v0.2.0',
      database: 'simulated-prototype-db v0.1',
    },
  };
}

/* -------------------------------------------------------------------------- */
/* OCR                                                                        */
/* -------------------------------------------------------------------------- */

function buildOcr(
  identity: SyntheticIdentity,
  printedDob: string,
  documentType: DocumentType,
  rng: () => number,
  tampered: boolean,
): OcrResult {
  const conf = (base: number) => rngFloat(rng, base, Math.min(0.998, base + 0.035));

  const fields: DocumentField[] = [
    {
      key: 'surname',
      label: 'Surname',
      value: identity.surname,
      confidence: conf(0.962),
      boundingBox: { x: 0.294, y: 0.312, width: 0.34, height: 0.062 },
    },
    {
      key: 'givenNames',
      label: 'Given Names',
      value: identity.givenNames,
      confidence: conf(0.951),
      boundingBox: { x: 0.294, y: 0.4, width: 0.38, height: 0.062 },
    },
    {
      key: 'dateOfBirth',
      label: 'Date of Birth',
      value: formatDocumentDate(printedDob),
      // A retouched field reads with visibly lower confidence — the signal an
      // officer should notice before they ever reach the risk score.
      confidence: tampered ? rngFloat(rng, 0.712, 0.784) : conf(0.954),
      boundingBox: { x: 0.625, y: 0.488, width: 0.17, height: 0.058 },
    },
    {
      key: 'nationality',
      label: 'Nationality',
      value: identity.nationality,
      confidence: conf(0.971),
      boundingBox: { x: 0.294, y: 0.488, width: 0.14, height: 0.058 },
    },
    {
      key: 'sex',
      label: 'Sex',
      value: identity.sex,
      confidence: conf(0.98),
      boundingBox: { x: 0.524, y: 0.488, width: 0.055, height: 0.058 },
    },
    {
      key: 'documentNumber',
      label: documentType === 'PASSPORT' ? 'Passport Number' : 'Visa Number',
      value: identity.documentNumber,
      confidence: conf(0.974),
      boundingBox: { x: 0.524, y: 0.224, width: 0.2, height: 0.062 },
    },
    {
      key: 'placeOfBirth',
      label: 'Place of Birth',
      value: identity.placeOfBirth,
      confidence: conf(0.928),
      boundingBox: { x: 0.294, y: 0.576, width: 0.28, height: 0.058 },
    },
    {
      key: 'issueDate',
      label: 'Date of Issue',
      value: formatDocumentDate(identity.issueDate),
      confidence: conf(0.947),
      boundingBox: { x: 0.294, y: 0.664, width: 0.17, height: 0.058 },
    },
    {
      key: 'expiryDate',
      label: 'Date of Expiry',
      value: formatDocumentDate(identity.expiryDate),
      confidence: conf(0.952),
      boundingBox: { x: 0.524, y: 0.664, width: 0.17, height: 0.058 },
    },
    {
      key: 'issuingAuthority',
      label: 'Issuing Authority',
      value: identity.issuingAuthority,
      confidence: conf(0.897),
      boundingBox: { x: 0.734, y: 0.664, width: 0.24, height: 0.058 },
    },
  ];

  const overall = fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length;

  return {
    status: 'COMPLETED',
    fields,
    overallConfidence: Math.round(overall * 1000) / 1000,
    engine: 'tesseract 5.3 + field templates',
    rawText: fields.map((f) => `${f.label.toUpperCase()}: ${f.value}`).join('\n'),
  };
}

/* -------------------------------------------------------------------------- */
/* MRZ                                                                        */
/* -------------------------------------------------------------------------- */

function buildMrz(
  identity: SyntheticIdentity,
  build: MrzBuildResult,
  documentType: DocumentType,
): MrzResult {
  const fields: DocumentField[] = [
    { key: 'surname', label: 'Surname', value: identity.surname, confidence: 0.998 },
    { key: 'givenNames', label: 'Given Names', value: identity.givenNames, confidence: 0.998 },
    {
      key: 'dateOfBirth',
      label: 'Date of Birth',
      value: formatDocumentDate(build.encodedDateOfBirth),
      rawValue: toMrzDate(build.encodedDateOfBirth),
      confidence: 0.998,
    },
    { key: 'nationality', label: 'Nationality', value: identity.nationality, confidence: 0.998 },
    { key: 'sex', label: 'Sex', value: identity.sex, confidence: 0.998 },
    {
      key: 'documentNumber',
      label: documentType === 'PASSPORT' ? 'Passport Number' : 'Visa Number',
      value: identity.documentNumber,
      confidence: 0.998,
    },
    {
      key: 'expiryDate',
      label: 'Date of Expiry',
      value: formatDocumentDate(identity.expiryDate),
      rawValue: toMrzDate(identity.expiryDate),
      confidence: 0.998,
    },
  ];

  const cd = build.checkDigits;
  const checkDigits: MrzCheckDigit[] = [
    {
      field: 'documentNumber',
      label: 'Document Number',
      expected: cd.documentNumber,
      found: cd.documentNumber,
      valid: true,
    },
    {
      field: 'dateOfBirth',
      label: 'Date of Birth',
      expected: cd.dateOfBirth,
      found: cd.dateOfBirth,
      valid: true,
    },
    {
      field: 'expiryDate',
      label: 'Date of Expiry',
      expected: cd.expiryDate,
      found: cd.expiryDate,
      valid: true,
    },
  ];

  if (build.format === 'TD3') {
    checkDigits.push({
      field: 'composite',
      label: 'Composite',
      expected: cd.composite,
      found: cd.composite,
      valid: true,
    });
  }

  return {
    status: 'COMPLETED',
    valid: checkDigits.every((c) => c.valid),
    format: build.format,
    lines: build.lines,
    fields,
    checkDigits,
  };
}

/* -------------------------------------------------------------------------- */
/* OCR vs MRZ cross-check                                                     */
/* -------------------------------------------------------------------------- */

const COMPARED_FIELDS: { key: string; label: string }[] = [
  { key: 'surname', label: 'Surname' },
  { key: 'givenNames', label: 'Given Names' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'sex', label: 'Sex' },
  { key: 'documentNumber', label: 'Document Number' },
  { key: 'expiryDate', label: 'Date of Expiry' },
];

function buildCrossCheck(ocr: OcrResult, mrz: MrzResult): CrossCheckResult {
  const ocrBy = new Map(ocr.fields.map((f) => [f.key, f]));
  const mrzBy = new Map(mrz.fields.map((f) => [f.key, f]));

  const comparisons: FieldComparison[] = COMPARED_FIELDS.map(({ key, label }) => {
    const o = ocrBy.get(key);
    const m = mrzBy.get(key);

    if (!o || !m) {
      return {
        key,
        label,
        ocrValue: o?.value ?? null,
        mrzValue: m?.value ?? null,
        status: 'UNAVAILABLE',
        note: 'Field is not present in both sources.',
      };
    }

    const match = normalise(o.value) === normalise(m.value);
    return {
      key,
      label,
      ocrValue: o.value,
      mrzValue: m.value,
      mrzRawValue: m.rawValue,
      status: match ? 'MATCH' : 'MISMATCH',
      // Deliberate wording: a mismatch is an inconsistency, not a finding of fraud.
      note: match ? undefined : 'Printed value and machine-readable zone disagree.',
    };
  });

  return {
    status: 'COMPLETED',
    comparisons,
    mismatchCount: comparisons.filter((c) => c.status === 'MISMATCH').length,
  };
}

function normalise(value: string): string {
  return value.replace(/[\s<]+/g, '').toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Deterministic validation                                                   */
/* -------------------------------------------------------------------------- */

function buildValidation(
  identity: SyntheticIdentity,
  documentType: DocumentType,
  now: Date,
  crossCheck: CrossCheckResult,
  mrz: MrzResult,
): ValidationResult {
  const expiry = new Date(identity.expiryDate);
  const issue = new Date(identity.issueDate);
  const expired = expiry.getTime() < now.getTime();
  const validityYears = Math.round(
    (expiry.getTime() - issue.getTime()) / (365.25 * 86_400_000),
  );
  const dobMismatch =
    crossCheck.comparisons.find((c) => c.key === 'dateOfBirth')?.status === 'MISMATCH';
  const failedDigits = mrz.checkDigits.filter((c) => !c.valid);

  const checks: ValidationCheck[] = [
    {
      key: 'expiry',
      label: 'Expiry Date',
      outcome: expired ? 'FAIL' : 'PASS',
      rule: 'Document expiry date must be later than the date of screening.',
      detail: expired
        ? `Expired on ${formatDocumentDate(identity.expiryDate)}`
        : `Valid until ${formatDocumentDate(identity.expiryDate)}`,
    },
    {
      key: 'document_number_format',
      label: 'Document Number Format',
      outcome: /^[A-Z]\d{7}$/.test(identity.documentNumber) ? 'PASS' : 'FAIL',
      rule: 'One alphabetic character followed by seven digits.',
      detail: identity.documentNumber,
    },
    {
      key: 'issue_expiry_relationship',
      label: 'Issue / Expiry Relationship',
      outcome: validityYears >= 1 && validityYears <= 10 ? 'PASS' : 'FAIL',
      rule: 'Validity period must fall between 1 and 10 years.',
      detail: `${validityYears}-year validity period`,
    },
    {
      key: 'dob_consistency',
      label: 'Date of Birth Consistency',
      outcome: dobMismatch ? 'FAIL' : 'PASS',
      rule: 'Printed date of birth must equal the value encoded in the MRZ.',
      detail: dobMismatch
        ? 'Printed value differs from the machine-readable zone'
        : 'Printed value agrees with the machine-readable zone',
    },
    {
      key: 'mrz_checksum',
      label: 'MRZ Check Digits',
      outcome: failedDigits.length === 0 ? 'PASS' : 'FAIL',
      rule: 'All ICAO 9303 check digits must validate (7-3-1 weighting, modulo 10).',
      detail:
        failedDigits.length === 0
          ? `All ${mrz.checkDigits.length} check digits validate`
          : `${failedDigits.length} check digit(s) did not validate`,
    },
    documentType === 'VISA'
      ? {
          key: 'visa_stay_dates',
          label: 'Visa Stay Dates',
          outcome: 'PASS',
          rule: 'Permitted stay must fall entirely within the visa validity window.',
          detail: 'Stay window falls within validity',
        }
      : {
          key: 'visa_stay_dates',
          label: 'Visa Stay Dates',
          outcome: 'NOT_APPLICABLE',
          rule: 'Applies to visa documents only.',
          detail: 'Not a visa document',
        },
    {
      key: 'issuing_authority',
      label: 'Issuing Authority',
      outcome: 'PASS',
      rule: 'Issuing authority must appear in the recognised authority list.',
      detail: identity.issuingAuthority,
    },
  ];

  const failedCount = checks.filter((c) => c.outcome === 'FAIL').length;

  return {
    status: 'COMPLETED',
    checks,
    failedCount,
    rulesetVersion: 'icao-9303/2026.02',
    message:
      failedCount > 0
        ? `${failedCount} deterministic rule${failedCount > 1 ? 's' : ''} did not pass.`
        : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Tampering                                                                  */
/* -------------------------------------------------------------------------- */

function buildTampering(rng: () => number, tampered: boolean): TamperingResult {
  if (!tampered) {
    const photoScore = rngFloat(rng, 0.03, 0.11);
    const textScore = rngFloat(rng, 0.04, 0.12);
    const metadataScore = rngFloat(rng, 0.06, 0.19);
    return {
      status: 'COMPLETED',
      score: Math.max(photoScore, textScore),
      photoScore,
      textScore,
      metadataScore,
      regions: [],
      modelVersion: 'vg-tamper-cnn v0.3.0',
    };
  }

  // Comfortably above the 0.7 escalation threshold, so the demo does not depend
  // on where the RNG happens to land.
  const textScore = rngFloat(rng, 0.82, 0.89);
  const photoScore = rngFloat(rng, 0.14, 0.27);
  const metadataScore = rngFloat(rng, 0.38, 0.52);

  return {
    status: 'COMPLETED',
    // The headline figure follows the strongest localised signal rather than an
    // average — averaging would bury a single decisive anomaly.
    score: Math.max(textScore, photoScore),
    photoScore,
    textScore,
    metadataScore,
    regions: [
      {
        id: 'r1',
        label: 'Date of birth field',
        category: 'TEXT',
        confidence: textScore,
        box: { x: 0.615, y: 0.478, width: 0.185, height: 0.075 },
      },
      {
        id: 'r2',
        label: 'MRZ line 2 — birth date group',
        category: 'TEXT',
        confidence: rngFloat(rng, 0.58, 0.7),
        box: { x: 0.16, y: 0.925, width: 0.14, height: 0.05 },
      },
      {
        id: 'r3',
        label: 'Laminate texture discontinuity',
        category: 'STRUCTURE',
        confidence: rngFloat(rng, 0.44, 0.56),
        box: { x: 0.58, y: 0.44, width: 0.26, height: 0.14 },
      },
    ],
    modelVersion: 'vg-tamper-cnn v0.3.0',
  };
}

function failedTampering(): TamperingResult {
  return {
    status: 'FAILED',
    score: 0,
    regions: [],
    message:
      'Tamper analysis service did not respond. No manipulation assessment is available for this document.',
  };
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

function buildFace(
  identity: SyntheticIdentity,
  rng: () => number,
  impersonation: boolean,
  liveFaceImageUrl?: string,
): FaceVerificationResult {
  const similarity = impersonation ? rngFloat(rng, 0.33, 0.47) : rngFloat(rng, 0.89, 0.968);

  return {
    status: 'COMPLETED',
    similarity,
    threshold: FACE_THRESHOLD,
    outcome: similarity >= FACE_THRESHOLD ? 'MATCH' : 'NO_MATCH',
    documentFaceUrl: faceSvgDataUri({ seed: identity.documentNumber, variant: 'document' }),
    liveFaceUrl:
      liveFaceImageUrl ??
      faceSvgDataUri({
        // A different seed for impersonation renders a visibly different person,
        // so the side-by-side comparison reads clearly on a projector.
        seed: impersonation ? `${identity.documentNumber}-alt` : identity.documentNumber,
        variant: 'live',
      }),
    documentFaceQuality: 'GOOD',
    liveFaceQuality: rng() > 0.75 ? 'ACCEPTABLE' : 'GOOD',
    modelVersion: 'vg-face-embed v1.2.0',
  };
}

function buildLiveness(challenge: LivenessChallenge, rng: () => number): LivenessResult {
  return {
    status: 'COMPLETED',
    passed: true,
    challenge,
    steps: [
      { key: 'face_detected', label: 'Face tracked', completed: true },
      { key: 'movement_detected', label: 'Movement detected', completed: true },
      { key: 'challenge_completed', label: 'Challenge completed', completed: true },
    ],
    confidence: rngFloat(rng, 0.9, 0.977),
  };
}

/* -------------------------------------------------------------------------- */
/* Database / watchlist                                                       */
/* -------------------------------------------------------------------------- */

const SIMULATED_SOURCE = 'Simulated Prototype Database';

function buildWatchlist(tampered: boolean, now: Date): WatchlistResult {
  if (tampered) {
    return {
      status: 'COMPLETED',
      documentStatus: 'REVIEW_REQUIRED',
      watchlist: 'REVIEW_REQUIRED',
      source: SIMULATED_SOURCE,
      checkedAt: now.toISOString(),
      notes: [
        'A record exists for this document number, but the stored date of birth does not match the presented document.',
        'Record flagged for manual reconciliation.',
      ],
    };
  }
  return {
    status: 'COMPLETED',
    documentStatus: 'VALID',
    watchlist: 'CLEAR',
    source: SIMULATED_SOURCE,
    checkedAt: now.toISOString(),
    notes: ['No adverse entries returned for the presented document number.'],
  };
}

function buildDuplicate(rng: () => number, duplicated: boolean): DuplicateIdentityResult {
  if (!duplicated) {
    return { status: 'COMPLETED', possibleMatch: false, candidates: [] };
  }

  const firstId = rngInt(rng, 100, 199);
  const secondId = rngInt(rng, 200, 299);

  return {
    status: 'COMPLETED',
    possibleMatch: true,
    candidates: [
      {
        candidateId: `SYN-${firstId}`,
        label: `Synthetic Identity #${firstId}`,
        similarity: rngFloat(rng, 0.92, 0.956),
        firstSeenAt: new Date(Date.UTC(2026, 2, 14, 9, 22)).toISOString(),
        matchedOn: ['Facial embedding', 'Date of birth', 'Place of birth'],
      },
      {
        candidateId: `SYN-${secondId}`,
        label: `Synthetic Identity #${secondId}`,
        similarity: rngFloat(rng, 0.78, 0.86),
        firstSeenAt: new Date(Date.UTC(2026, 5, 2, 16, 40)).toISOString(),
        matchedOn: ['Facial embedding'],
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Quality                                                                    */
/* -------------------------------------------------------------------------- */

function buildQuality(rng: () => number): QualityReport {
  const blurVariance = rngFloat(rng, 118, 264, 1);
  const glare = rngFloat(rng, 0.004, 0.026, 4);
  const width = 1654;
  const height = 1122;

  const checks: QualityReport['checks'] = [
    { key: 'resolution', label: 'Resolution', verdict: 'GOOD', detail: `${width} × ${height} px` },
    {
      key: 'document_visibility',
      label: 'Document Visibility',
      verdict: 'GOOD',
      detail: 'All four corners detected',
    },
    {
      key: 'blur',
      label: 'Blur',
      verdict: blurVariance > 150 ? 'GOOD' : 'ACCEPTABLE',
      detail: `Laplacian variance ${blurVariance}`,
      hint:
        blurVariance > 150
          ? undefined
          : 'Hold the document steady and re-capture for a sharper image.',
    },
    {
      key: 'glare',
      label: 'Glare',
      verdict: glare < 0.02 ? 'GOOD' : 'ACCEPTABLE',
      detail: `${(glare * 100).toFixed(2)}% specular pixels`,
      hint: glare < 0.02 ? undefined : 'Tilt the document away from the light source.',
    },
    {
      key: 'perspective',
      label: 'Perspective',
      verdict: 'GOOD',
      detail: 'Corrected to a rectangular, front-on view',
    },
    {
      key: 'brightness',
      label: 'Brightness',
      verdict: 'GOOD',
      detail: `Mean luminance ${rngInt(rng, 112, 158)}`,
    },
    {
      key: 'contrast',
      label: 'Contrast',
      verdict: 'GOOD',
      detail: `Standard deviation ${rngInt(rng, 46, 72)}`,
    },
  ];

  return {
    isAcceptable: true,
    checks,
    warnings: checks.filter((c) => c.verdict !== 'GOOD').map((c) => `${c.label}: ${c.detail}`),
  };
}

/* -------------------------------------------------------------------------- */
/* Risk aggregation                                                           */
/* -------------------------------------------------------------------------- */

interface RiskContext {
  createdAt: Date;
  ocr: OcrResult;
  crossCheck: CrossCheckResult;
  validation: ValidationResult;
  tampering: TamperingResult;
  face: FaceVerificationResult;
  liveness: LivenessResult;
  watchlist: WatchlistResult;
  duplicate: DuplicateIdentityResult;
}

/**
 * Category points, derived entirely from the analyser outputs.
 *
 * `null` means the analyser did not complete: the category is then excluded from
 * the denominator rather than scored zero. Scoring an unavailable check as zero
 * would flatter a document nobody actually checked.
 */
function categoryPoints(ctx: RiskContext): Record<RiskCategoryKey, number | null> {
  const { ocr, crossCheck, validation, tampering, face, liveness, watchlist, duplicate } = ctx;

  // Deterministic rule failures are the least ambiguous evidence available.
  const validityPoints =
    validation.status === 'COMPLETED'
      ? Math.min(CATEGORY_MAX.document_validity, validation.failedCount * 20)
      : null;

  // Field-level disagreement, plus a small penalty when extraction confidence was
  // low enough to make the comparison itself less reliable.
  const consistencyPoints =
    crossCheck.status === 'COMPLETED'
      ? Math.min(
          CATEGORY_MAX.ocr_mrz_consistency,
          crossCheck.mismatchCount * 20 + Math.round((1 - ocr.overallConfidence) * 24),
        )
      : null;

  const tamperingPoints =
    tampering.status === 'COMPLETED'
      ? Math.round(tampering.score * CATEGORY_MAX.tampering)
      : null;

  // Below threshold is near-maximal. Above it, points taper toward zero as the
  // margin widens, so a marginal pass still registers as something.
  const identityPoints =
    face.status === 'COMPLETED'
      ? face.outcome === 'NO_MATCH'
        ? CATEGORY_MAX.identity - 1
        : Math.round(clamp((face.threshold + 0.18 - face.similarity) / 0.18, 0, 1) * 9)
      : null;

  const livenessPoints =
    liveness.status === 'COMPLETED' ? (liveness.passed ? 0 : CATEGORY_MAX.liveness) : null;

  let databasePoints: number | null = null;
  if (watchlist.status === 'COMPLETED') {
    databasePoints = 0;
    if (watchlist.documentStatus === 'REVOKED' || watchlist.documentStatus === 'FLAGGED') {
      databasePoints += 34;
    } else if (
      watchlist.documentStatus === 'REVIEW_REQUIRED' ||
      watchlist.documentStatus === 'NOT_FOUND'
    ) {
      databasePoints += 18;
    }
    if (watchlist.watchlist === 'POSSIBLE_MATCH') databasePoints += 30;
    else if (watchlist.watchlist === 'REVIEW_REQUIRED') databasePoints += 10;
    if (duplicate.possibleMatch) databasePoints += 30;
    databasePoints = Math.min(CATEGORY_MAX.database, databasePoints);
  }

  return {
    document_validity: validityPoints,
    ocr_mrz_consistency: consistencyPoints,
    tampering: tamperingPoints,
    identity: identityPoints,
    liveness: livenessPoints,
    database: databasePoints,
  };
}

/**
 * Escalation rules, also derived from the evidence.
 *
 * A weighted average across six categories always dilutes one decisive finding —
 * an impersonation attempt with an otherwise flawless document scores low on five
 * of six categories. These rules enforce a floor so a single conclusive signal
 * reaches the officer at its true weight. The UI shows `baseScore` alongside
 * `score`, so an escalation is never a black box.
 */
function deriveEscalations(ctx: RiskContext, partial: boolean): RiskEscalation[] {
  const { crossCheck, tampering, face, liveness, watchlist, duplicate } = ctx;
  const rules: RiskEscalation[] = [];

  const primaryMismatch = crossCheck.comparisons.filter(
    (c) => c.status === 'MISMATCH' && PRIMARY_IDENTITY_FIELDS.has(c.key),
  );
  if (primaryMismatch.length > 0) {
    rules.push({
      rule: 'PRIMARY_FIELD_INCONSISTENCY',
      label: `The printed page and the machine-readable zone disagree on a primary identity field (${primaryMismatch
        .map((c) => c.label.toLowerCase())
        .join(', ')}). A genuine document should be internally consistent.`,
      floorScore: 70,
      appliedLevel: 'HIGH',
    });
  }

  if (tampering.status === 'COMPLETED' && tampering.score >= 0.7) {
    rules.push({
      rule: 'LOCALISED_TAMPER_SIGNAL',
      label:
        'The forensic model reports a strong localised manipulation signal. This is a probabilistic indication and calls for physical inspection of the document.',
      floorScore: 72,
      appliedLevel: 'HIGH',
    });
  }

  if (face.status === 'COMPLETED' && face.outcome === 'NO_MATCH') {
    rules.push({
      rule: 'IDENTITY_NON_MATCH',
      label:
        'Face similarity falls below the decision threshold. A possible identity mismatch is decisive on its own and is not offset by a clean document.',
      floorScore: 74,
      appliedLevel: 'HIGH',
    });
  }

  if (liveness.status === 'COMPLETED' && !liveness.passed) {
    rules.push({
      rule: 'LIVENESS_NOT_COMPLETED',
      label:
        'The liveness challenge was not completed, so the face comparison cannot be attributed to the person present.',
      floorScore: 62,
      appliedLevel: 'HIGH',
    });
  }

  if (watchlist.documentStatus === 'REVOKED' || watchlist.documentStatus === 'FLAGGED') {
    rules.push({
      rule: 'DOCUMENT_STATUS_ADVERSE',
      label: `The prototype database returns document status ${humanise(watchlist.documentStatus)}.`,
      floorScore: 80,
      appliedLevel: 'HIGH',
    });
  }

  if (duplicate.possibleMatch) {
    rules.push({
      rule: 'DUPLICATE_POSSIBLE_MATCH',
      label:
        'A previously recorded identity is a possible match. This is an investigative lead for an officer to reconcile, not a confirmed duplicate.',
      floorScore: 52,
      appliedLevel: 'MEDIUM',
    });
  }

  if (partial) {
    rules.push({
      rule: 'ANALYSIS_INCOMPLETE',
      label:
        'One or more analysers did not complete. The aggregate covers only the checks that ran and cannot be treated as a successful verification.',
      floorScore: 34,
      appliedLevel: 'MEDIUM',
    });
  }

  return rules;
}

function buildRisk(ctx: RiskContext): RiskAssessment {
  const points = categoryPoints(ctx);

  const breakdown: RiskBreakdownItem[] = (Object.keys(CATEGORY_MAX) as RiskCategoryKey[]).map(
    (category) => {
      const value = points[category];
      return {
        category,
        score: value ?? 0,
        maxScore: CATEGORY_MAX[category],
        origin: RISK_CATEGORY_ORIGIN[category],
        incomplete: value === null,
        note: categoryNote(category, ctx, value === null),
      };
    },
  );

  const scored = breakdown.filter((b) => !b.incomplete);
  const availableMax = scored.reduce((sum, b) => sum + b.maxScore, 0);
  const earned = scored.reduce((sum, b) => sum + b.score, 0);
  const baseScore = availableMax > 0 ? Math.round((earned / availableMax) * 100) : 0;

  const partial = breakdown.some((b) => b.incomplete);
  const escalations = deriveEscalations(ctx, partial);
  const floor = escalations.reduce((max, e) => Math.max(max, e.floorScore), 0);
  const score = clamp(Math.max(baseScore, floor), 0, 100);

  const level: RiskLevel =
    score >= RISK_THRESHOLDS.HIGH.min
      ? 'HIGH'
      : score >= RISK_THRESHOLDS.MEDIUM.min
        ? 'MEDIUM'
        : 'LOW';

  return {
    score,
    baseScore,
    level,
    recommendedAction: partial
      ? 'Re-run Analysis or Perform Secondary Verification'
      : RISK_RECOMMENDED_ACTION[level],
    reasons: buildReasons(ctx, partial),
    breakdown,
    escalations,
    partial,
    engineVersion: 'v0.4.1-prototype',
    rulesetVersion: 'icao-9303/2026.02',
    evaluatedAt: ctx.createdAt.toISOString(),
  };
}

function categoryNote(
  category: RiskCategoryKey,
  ctx: RiskContext,
  isIncomplete: boolean,
): string | undefined {
  if (isIncomplete) return 'Analyser did not complete — excluded from the aggregate.';

  const { crossCheck, validation, tampering, face, liveness, watchlist, duplicate } = ctx;

  switch (category) {
    case 'document_validity':
      return validation.failedCount > 0
        ? `${validation.failedCount} of ${validation.checks.length} deterministic rules did not pass.`
        : 'All deterministic document rules passed.';
    case 'ocr_mrz_consistency':
      return crossCheck.mismatchCount > 0
        ? `${crossCheck.mismatchCount} field${crossCheck.mismatchCount > 1 ? 's' : ''} disagree between the printed page and the MRZ.`
        : 'Printed fields agree with the machine-readable zone.';
    case 'tampering':
      return `Manipulation probability ${Math.round(tampering.score * 100)}%${
        tampering.regions.length > 0 ? `, ${tampering.regions.length} region(s) flagged` : ''
      }.`;
    case 'identity':
      return `Face similarity ${(face.similarity * 100).toFixed(1)}% against a ${(face.threshold * 100).toFixed(0)}% threshold.`;
    case 'liveness':
      return liveness.passed
        ? 'Liveness challenge completed.'
        : 'Liveness challenge was not completed.';
    case 'database':
      return duplicate.possibleMatch
        ? `Possible duplicate identity returned (${duplicate.candidates.length} candidate(s)).`
        : `Document status ${humanise(watchlist.documentStatus)}, watchlist ${humanise(watchlist.watchlist)}.`;
    default:
      return undefined;
  }
}

function humanise(token: string): string {
  return token.replace(/_/g, ' ').toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Explainable reasons                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Officer-facing reason list. The ordering is deliberate: deterministic findings
 * first because they are unambiguous, then probabilistic ones. No entry here may
 * assert fraud — see the prohibited-language rules in the spec.
 */
function buildReasons(ctx: RiskContext, partial: boolean): RiskReason[] {
  const { crossCheck, validation, tampering, face, liveness, watchlist, duplicate } = ctx;
  const reasons: RiskReason[] = [];

  for (const check of validation.checks) {
    if (check.outcome === 'FAIL') {
      reasons.push({
        id: `validation-${check.key}`,
        label: `Document rule not satisfied: ${check.label.toLowerCase()}`,
        severity: 'CRITICAL',
        category: 'document_validity',
        detail: check.detail,
      });
    }
  }

  for (const cmp of crossCheck.comparisons) {
    if (cmp.status === 'MISMATCH') {
      reasons.push({
        id: `crosscheck-${cmp.key}`,
        label: `${cmp.label} mismatch between the printed page and the MRZ`,
        severity: PRIMARY_IDENTITY_FIELDS.has(cmp.key) ? 'CRITICAL' : 'WARNING',
        category: 'ocr_mrz_consistency',
        detail: `OCR: ${cmp.ocrValue} · MRZ: ${cmp.mrzValue}`,
      });
    }
  }

  if (tampering.status === 'FAILED') {
    reasons.push({
      id: 'tampering-unavailable',
      label: 'Tamper analysis could not be completed',
      severity: 'WARNING',
      category: 'tampering',
      detail: 'No manipulation assessment is available. This is not a pass.',
    });
  } else if (tampering.score >= 0.6) {
    const top = [...tampering.regions].sort((a, b) => b.confidence - a.confidence)[0];
    reasons.push({
      id: 'tampering-high',
      label: 'Suspicious evidence of localised text manipulation',
      severity: 'CRITICAL',
      category: 'tampering',
      detail: top
        ? `Strongest signal in the ${top.label.toLowerCase()} (${Math.round(top.confidence * 100)}%)`
        : `Overall manipulation probability ${Math.round(tampering.score * 100)}%`,
    });
  } else if (tampering.score >= 0.35) {
    reasons.push({
      id: 'tampering-medium',
      label: 'Weak manipulation signal present',
      severity: 'WARNING',
      category: 'tampering',
      detail: `Overall manipulation probability ${Math.round(tampering.score * 100)}%`,
    });
  }

  if (face.outcome === 'NO_MATCH') {
    reasons.push({
      id: 'face-no-match',
      label: 'Possible identity mismatch with the document photograph',
      severity: 'CRITICAL',
      category: 'identity',
      detail: `Similarity ${(face.similarity * 100).toFixed(1)}% against a ${(face.threshold * 100).toFixed(0)}% decision threshold`,
    });
  } else if (face.similarity < face.threshold + 0.12) {
    reasons.push({
      id: 'face-marginal',
      label: 'Face similarity is close to the decision threshold',
      severity: 'WARNING',
      category: 'identity',
      detail: `Similarity ${(face.similarity * 100).toFixed(1)}%`,
    });
  }

  if (!liveness.passed) {
    reasons.push({
      id: 'liveness-failed',
      label: 'Liveness challenge was not completed',
      severity: 'CRITICAL',
      category: 'liveness',
      detail: 'A fresh capture is required before the identity check can be relied upon.',
    });
  }

  if (watchlist.documentStatus === 'REVOKED' || watchlist.documentStatus === 'FLAGGED') {
    reasons.push({
      id: 'database-adverse',
      label: `Document status returned as ${humanise(watchlist.documentStatus)}`,
      severity: 'CRITICAL',
      category: 'database',
      detail: watchlist.source,
    });
  } else if (
    watchlist.documentStatus === 'REVIEW_REQUIRED' ||
    watchlist.watchlist === 'REVIEW_REQUIRED'
  ) {
    reasons.push({
      id: 'database-review',
      label: 'Database record requires review',
      severity: 'WARNING',
      category: 'database',
      detail: watchlist.notes?.[0],
    });
  }

  if (duplicate.possibleMatch) {
    const top = duplicate.candidates[0];
    reasons.push({
      id: 'duplicate-possible',
      label: 'Possible duplicate identity found',
      severity: 'WARNING',
      category: 'database',
      detail: top
        ? `${top.label} at ${(top.similarity * 100).toFixed(1)}% similarity — requires human review`
        : 'Requires human review',
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      id: 'no-adverse',
      label: 'No adverse evidence identified across the checks that ran',
      severity: 'INFO',
      category: 'document_validity',
      detail: 'All completed checks were mutually consistent.',
    });
  }

  if (partial) {
    reasons.unshift({
      id: 'partial-analysis',
      label: 'Analysis is incomplete',
      severity: 'WARNING',
      category: 'tampering',
      detail: 'At least one analyser did not run. Treat this result as provisional.',
    });
  }

  return reasons;
}

/* -------------------------------------------------------------------------- */
/* Evidence summary                                                           */
/* -------------------------------------------------------------------------- */

function buildEvidence(ctx: RiskContext): EvidenceGroup[] {
  const { crossCheck, validation, tampering, face, liveness, watchlist, duplicate } = ctx;

  const expiryCheck = validation.checks.find((c) => c.key === 'expiry');
  const formatCheck = validation.checks.find((c) => c.key === 'document_number_format');
  const digitCheck = validation.checks.find((c) => c.key === 'mrz_checksum');
  const dobCmp = crossCheck.comparisons.find((c) => c.key === 'dateOfBirth');
  const otherMismatches = crossCheck.mismatchCount - (dobCmp?.status === 'MISMATCH' ? 1 : 0);

  return [
    {
      category: 'document_validity',
      items: [
        {
          label: 'Document number format',
          verdict: formatCheck?.outcome === 'PASS' ? 'OK' : 'ATTENTION',
          detail: formatCheck?.detail,
        },
        {
          label: 'Expiry date',
          verdict: expiryCheck?.outcome === 'PASS' ? 'OK' : 'ATTENTION',
          detail: expiryCheck?.detail,
        },
        {
          label: 'MRZ check digits',
          verdict: digitCheck?.outcome === 'PASS' ? 'OK' : 'ATTENTION',
          detail: digitCheck?.detail,
        },
      ],
    },
    {
      category: 'ocr_mrz_consistency',
      items: [
        {
          label: 'Date of birth',
          verdict: dobCmp?.status === 'MATCH' ? 'OK' : 'ATTENTION',
          detail:
            dobCmp?.status === 'MATCH'
              ? 'Printed value agrees with the MRZ'
              : `OCR ${dobCmp?.ocrValue} · MRZ ${dobCmp?.mrzValue}`,
        },
        {
          label: 'Remaining fields',
          verdict: otherMismatches === 0 ? 'OK' : 'ATTENTION',
          detail: `${crossCheck.comparisons.length - crossCheck.mismatchCount} of ${crossCheck.comparisons.length} compared fields agree`,
        },
      ],
    },
    {
      category: 'tampering',
      items: [
        {
          label: 'Manipulation signal',
          verdict:
            tampering.status !== 'COMPLETED'
              ? 'INCOMPLETE'
              : tampering.score >= 0.35
                ? 'ATTENTION'
                : 'OK',
          detail:
            tampering.status !== 'COMPLETED'
              ? 'Analyser unavailable — no assessment produced'
              : `Overall probability ${Math.round(tampering.score * 100)}%`,
        },
        {
          label: 'Suspicious regions',
          verdict:
            tampering.status !== 'COMPLETED'
              ? 'INCOMPLETE'
              : tampering.regions.length > 0
                ? 'ATTENTION'
                : 'OK',
          detail:
            tampering.status !== 'COMPLETED'
              ? 'Not assessed'
              : tampering.regions.length > 0
                ? `${tampering.regions.length} region${tampering.regions.length > 1 ? 's' : ''} flagged`
                : 'None flagged',
        },
      ],
    },
    {
      category: 'identity',
      items: [
        {
          label: 'Face similarity',
          verdict:
            face.status !== 'COMPLETED'
              ? 'INCOMPLETE'
              : face.outcome === 'MATCH'
                ? 'OK'
                : 'ATTENTION',
          detail: `${(face.similarity * 100).toFixed(1)}% (threshold ${(face.threshold * 100).toFixed(0)}%)`,
        },
        {
          label: 'Capture quality',
          verdict: face.liveFaceQuality === 'POOR' ? 'ATTENTION' : 'OK',
          detail: `Document ${humanise(face.documentFaceQuality ?? 'n/a')} · live ${humanise(face.liveFaceQuality ?? 'n/a')}`,
        },
      ],
    },
    {
      category: 'liveness',
      items: [
        {
          label: 'Challenge',
          verdict: liveness.passed ? 'OK' : 'ATTENTION',
          detail: liveness.passed ? 'Completed successfully' : 'Not completed',
        },
      ],
    },
    {
      category: 'database',
      items: [
        {
          label: 'Document status',
          verdict: watchlist.documentStatus === 'VALID' ? 'OK' : 'ATTENTION',
          detail: humanise(watchlist.documentStatus),
        },
        {
          label: 'Watchlist',
          verdict: watchlist.watchlist === 'CLEAR' ? 'OK' : 'ATTENTION',
          detail: humanise(watchlist.watchlist),
        },
        {
          label: 'Duplicate identity',
          verdict: duplicate.possibleMatch ? 'ATTENTION' : 'OK',
          detail: duplicate.possibleMatch
            ? `${duplicate.candidates.length} possible match${duplicate.candidates.length > 1 ? 'es' : ''}`
            : 'None found',
        },
      ],
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Stage timings                                                              */
/* -------------------------------------------------------------------------- */

const STAGE_BASE_MS: Record<string, [number, number]> = {
  quality: [90, 190],
  ocr: [620, 1150],
  mrz: [110, 240],
  validation: [30, 90],
  tampering: [780, 1420],
  face: [340, 690],
  liveness: [180, 380],
  database: [140, 320],
  risk: [40, 110],
};

function buildStages(
  statuses: Record<string, StageStatus>,
  rng: () => number,
): PipelineStageState[] {
  return PIPELINE_STAGES.map((key) => {
    const status = statuses[key] ?? 'PENDING';
    const [lo, hi] = STAGE_BASE_MS[key] ?? [100, 300];
    const settled = status === 'COMPLETED' || status === 'PARTIAL' || status === 'FAILED';
    return {
      key,
      status,
      durationMs: settled ? rngInt(rng, lo, hi) : undefined,
      message:
        status === 'FAILED'
          ? 'Service did not respond within the request timeout.'
          : status === 'PARTIAL'
            ? 'Aggregated from the checks that completed.'
            : undefined,
      retryable: status === 'FAILED',
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function shiftYear(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split('-');
  return `${Number(y) + years}-${m}-${d}`;
}
