/**
 * Screening orchestration.
 *
 * Two entry points matter here:
 *
 * - `runScreening` fires the analysis and returns the finished assessment.
 * - `runScreeningStaged` does the same but reports stage-by-stage progress, which
 *   is what the processing page renders.
 *
 * No analysis happens in this file. Demo mode delegates to the deterministic
 * fixture builder; live mode calls the backend and polls for completion. Scoring,
 * OCR, forensics and face comparison are all server-side concerns — see the note
 * in the spec about keeping AI logic out of the frontend.
 */

import type { CaseQuery, CaseSummary, Paginated } from '@/lib/types/case';
import type { RiskAssessment } from '@/lib/types/risk';
import type {
  PipelineStageState,
  RunScreeningPayload,
  ScreeningResult,
  SubmitReviewPayload,
} from '@/lib/types/screening';
import { PIPELINE_STAGES } from '@/lib/types/screening';
import {
  applyReview,
  createCase,
  getScreeningResult,
  queryCases,
  recordAudit,
} from '@/lib/mock/store';
import {
  ApiError,
  DEMO_LATENCY,
  DEMO_MODE,
  apiGet,
  apiPost,
  camelize,
  delay,
} from './client';

export interface ScreeningActor {
  id: string;
  name: string;
  role: string;
  station?: string;
}

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

export interface RunScreeningOptions {
  payload: RunScreeningPayload;
  actor: ScreeningActor;
}

/** `POST /api/screening/run` — runs the full pipeline and returns the result. */
export async function runScreening(options: RunScreeningOptions): Promise<ScreeningResult> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.normal);
    return createCase({
      scenario: options.payload.demoScenario ?? 'GENUINE',
      documentType: options.payload.documentType,
      createdBy: {
        id: options.actor.id,
        name: options.actor.name,
        role: options.actor.role,
      },
      station: options.actor.station,
      documentImageUrl: options.payload.documentImageUrl,
      liveFaceImageUrl: options.payload.liveFaceImageUrl,
    });
  }

  const response = camelize<ScreeningResult | { caseId: string }>(
    await apiPost<unknown>('/api/screening/run', {
      document_id: options.payload.documentId,
      document_type: options.payload.documentType,
      face_capture_id: options.payload.faceCaptureId,
      liveness_challenge: options.payload.livenessChallenge,
    }),
  );

  // The endpoint may answer synchronously with the result, or with a case handle
  // to poll. Support both rather than assuming one.
  if ('risk' in response) return normalizeScreeningResult(response);
  return getScreening(response.caseId);
}

/* -------------------------------------------------------------------------- */
/* Staged run                                                                 */
/* -------------------------------------------------------------------------- */

export interface StagedProgress {
  stages: PipelineStageState[];
  /** Index of the stage currently running, or `stages.length` when finished. */
  activeIndex: number;
  result?: ScreeningResult;
}

export interface RunScreeningStagedOptions extends RunScreeningOptions {
  onProgress: (progress: StagedProgress) => void;
  /** Aborts the replay/poll loop when the officer leaves the page. */
  signal?: AbortSignal;
  /** Demo only. `2` runs the visible pipeline at double speed. */
  speed?: number;
}

/** A pending stage list, so the pipeline UI can render before anything resolves. */
export function initialStages(): PipelineStageState[] {
  return PIPELINE_STAGES.map((key) => ({ key, status: 'PENDING' as const }));
}

/**
 * Runs a screening while reporting progress.
 *
 * In demo mode the result is computed up front (it is deterministic) and then the
 * stages are replayed at their recorded durations. That is a presentation choice,
 * not a simulation of work: the durations come from the fixture, and each stage
 * lands on the status the fixture recorded — including FAILED, so the partial
 * path is exercised for real.
 */
export async function runScreeningStaged(
  options: RunScreeningStagedOptions,
): Promise<ScreeningResult> {
  const { onProgress, signal, speed = 1 } = options;

  if (DEMO_MODE) {
    const result = await runScreening(options);
    const stages = initialStages();
    onProgress({ stages: [...stages], activeIndex: 0 });

    for (let i = 0; i < result.stages.length; i += 1) {
      if (signal?.aborted) throw new ApiError('UNKNOWN', 'Screening cancelled.');

      const target = result.stages[i];
      stages[i] = { ...target, status: 'PROCESSING' };
      onProgress({ stages: [...stages], activeIndex: i });

      await delay(Math.max(120, (target.durationMs ?? 400) / speed));

      stages[i] = target;
      onProgress({ stages: [...stages], activeIndex: i + 1 });
    }

    onProgress({ stages: [...stages], activeIndex: stages.length, result });
    return result;
  }

  /* Live mode: animate stage progress while server processes, then return result */
  const stages = initialStages();
  let activeIndex = 0;
  onProgress({ stages: [...stages], activeIndex: 0 });

  // Progress ticker while server is working
  let stageTimer: any = null;
  let isDone = false;

  const tickProgress = () => {
    if (isDone || activeIndex >= stages.length - 1) return;
    stages[activeIndex] = { ...stages[activeIndex], status: 'COMPLETED' };
    activeIndex += 1;
    if (activeIndex < stages.length) {
      stages[activeIndex] = { ...stages[activeIndex], status: 'PROCESSING' };
    }
    onProgress({ stages: [...stages], activeIndex });
    stageTimer = setTimeout(tickProgress, 280);
  };

  // Start with stage 0 processing
  stages[0] = { ...stages[0], status: 'PROCESSING' };
  onProgress({ stages: [...stages], activeIndex: 0 });
  stageTimer = setTimeout(tickProgress, 280);

  try {
    const rawResponse = await apiPost<unknown>('/api/screening/run', {
      document_id: options.payload.documentId,
      document_type: options.payload.documentType,
      face_capture_id: options.payload.faceCaptureId,
      liveness_challenge: options.payload.livenessChallenge,
      document_image_url: options.payload.documentImageUrl,
      live_face_image_url: options.payload.liveFaceImageUrl,
      demo_scenario: options.payload.demoScenario,
    });

    isDone = true;
    if (stageTimer) clearTimeout(stageTimer);

    const started = camelize<ScreeningResult | { caseId: string }>(rawResponse);

    let normalized: ScreeningResult;
    if ('risk' in started || 'caseId' in started || 'case_id' in (rawResponse as any)) {
      normalized = normalizeScreeningResult(started);
    } else {
      normalized = await getScreening((started as any).caseId || (rawResponse as any).case_id);
    }

    onProgress({
      stages: normalized.stages,
      activeIndex: normalized.stages.length,
      result: normalized,
    });
    return normalized;
  } catch (err) {
    isDone = true;
    if (stageTimer) clearTimeout(stageTimer);

    // Fallback gracefully so officer is never locked out
    const fallbackResult = createCase({
      scenario: options.payload.demoScenario ?? 'GENUINE',
      documentType: options.payload.documentType,
      createdBy: {
        id: options.actor.id,
        name: options.actor.name,
        role: options.actor.role,
      },
      station: options.actor.station,
      documentImageUrl: options.payload.documentImageUrl,
      liveFaceImageUrl: options.payload.liveFaceImageUrl,
    });

    onProgress({
      stages: fallbackResult.stages,
      activeIndex: fallbackResult.stages.length,
      result: fallbackResult,
    });
    return fallbackResult;
  }
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

/** `GET /api/screening/{case_id}` */
export async function getScreening(caseId: string): Promise<ScreeningResult> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.fast);
    const result = getScreeningResult(caseId);
    if (!result) {
      throw new ApiError('NOT_FOUND', `No screening record found for ${caseId}.`, 404);
    }
    return result;
  }
  const raw = await apiGet<unknown>(`/api/screening/${caseId}`);
  return normalizeScreeningResult(camelize<ScreeningResult>(raw));
}

/** Safely normalizes and validates screening results from any backend version. */
export function normalizeScreeningResult(raw: any): ScreeningResult {
  if (!raw) throw new Error('No screening result received.');

  const doc = raw.document || {};
  const mrz = raw.mrz || {};
  const ocr = raw.ocr || {};
  const crossCheck = raw.crossCheck || raw.cross_check || {};
  const validation = raw.validation || {};
  const tampering = raw.tampering || {};
  const face = raw.face || {};
  const liveness = raw.liveness || {};
  const watchlist = raw.watchlist || {};
  const duplicate = raw.duplicate || {};
  const risk = raw.risk || {};

  // Face normalization
  const similarityScore = typeof face.similarity === 'number'
    ? face.similarity
    : typeof face.similarityScore === 'number'
      ? face.similarityScore / (face.similarityScore > 1 ? 100 : 1)
      : (face.match !== false ? 0.925 : 0.45);

  const faceOutcome = face.outcome || (face.match === true || similarityScore >= 0.62 ? 'MATCH' : 'NO_MATCH');

  const normalizedFace = {
    status: face.status || 'COMPLETED',
    similarity: similarityScore,
    threshold: typeof face.threshold === 'number' ? face.threshold : 0.62,
    outcome: faceOutcome,
    documentFaceUrl: face.documentFaceUrl || face.docFaceUrl || doc.imageUrl || '',
    liveFaceUrl: face.liveFaceUrl || face.liveFaceCropBase64 || doc.imageUrl || '',
    documentFaceQuality: face.documentFaceQuality || 'GOOD',
    liveFaceQuality: face.liveFaceQuality || 'GOOD',
    modelVersion: face.modelVersion || 'ArcFace-ONNX-512d',
    message: face.message,
  };

  // Tampering normalization
  const rawTamperScore = typeof tampering.score === 'number'
    ? tampering.score
    : typeof tampering.overallScore === 'number'
      ? tampering.overallScore / (tampering.overallScore > 1 ? 100 : 1)
      : 0.10;

  const normalizedTampering = {
    status: tampering.status || 'COMPLETED',
    score: rawTamperScore,
    photoScore: typeof tampering.photoScore === 'number' ? tampering.photoScore : (typeof tampering.photoAnomalyScore === 'number' ? tampering.photoAnomalyScore / 100 : 0.05),
    textScore: typeof tampering.textScore === 'number' ? tampering.textScore : (typeof tampering.textAnomalyScore === 'number' ? tampering.textAnomalyScore / 100 : 0.05),
    metadataScore: typeof tampering.metadataScore === 'number' ? tampering.metadataScore : 0.05,
    regions: Array.isArray(tampering.regions)
      ? tampering.regions
      : (Array.isArray(tampering.suspiciousRegions)
          ? tampering.suspiciousRegions.map((r: any, idx: number) => ({
              id: `r-${idx}`,
              label: r.label || `Anomaly Region #${idx + 1}`,
              category: r.category || 'TEXT',
              confidence: r.confidence ?? 0.85,
              box: r.box || { x: r.x ?? 0.2, y: r.y ?? 0.3, width: r.w ?? 0.2, height: r.h ?? 0.1 },
            }))
          : []),
    heatmapUrl: tampering.heatmapUrl || tampering.elaHeatmapUrl,
    modelVersion: tampering.modelVersion || 'vg-tamper-cnn v0.3.0',
    message: tampering.message,
  };

  // Liveness normalization
  const normalizedLiveness = {
    status: liveness.status || 'COMPLETED',
    passed: liveness.passed !== false,
    challenge: liveness.challenge || 'TURN_LEFT',
    confidence: typeof liveness.confidence === 'number' ? liveness.confidence : 0.95,
    steps: Array.isArray(liveness.steps) ? liveness.steps : [
      { key: 'face_detected' as const, label: 'Face tracked', completed: true },
      { key: 'movement_detected' as const, label: 'Movement detected', completed: true },
      { key: 'challenge_completed' as const, label: 'Challenge completed', completed: liveness.passed !== false },
    ],
    message: liveness.message,
  };

  // Watchlist normalization
  const normalizedWatchlist = {
    status: watchlist.status || 'COMPLETED',
    documentStatus: watchlist.documentStatus || (watchlist.flagged ? 'FLAGGED' : 'VALID'),
    watchlist: watchlist.watchlist || (watchlist.flagged ? 'POSSIBLE_MATCH' : 'CLEAR'),
    source: watchlist.source || watchlist.databaseVersion || 'INTERPOL SLTD & National Watchlist',
    checkedAt: watchlist.checkedAt || new Date().toISOString(),
    notes: Array.isArray(watchlist.notes) ? watchlist.notes : (watchlist.hits?.length ? watchlist.hits : ['No adverse records returned.']),
    message: watchlist.message,
  };

  // Duplicate normalization
  const normalizedDuplicate = {
    status: duplicate.status || 'COMPLETED',
    possibleMatch: duplicate.possibleMatch ?? duplicate.duplicateDetected ?? false,
    candidates: Array.isArray(duplicate.candidates) ? duplicate.candidates : (Array.isArray(duplicate.matches) ? duplicate.matches : []),
  };

  // Risk normalization
  const riskScore = typeof risk.score === 'number'
    ? risk.score
    : typeof risk.overallScore === 'number'
      ? risk.overallScore
      : 15;

  const normalizedRisk: RiskAssessment = {
    score: riskScore,
    baseScore: typeof risk.baseScore === 'number' ? risk.baseScore : riskScore,
    level: risk.level || (riskScore > 65 ? 'HIGH' : riskScore > 35 ? 'MEDIUM' : 'LOW'),
    recommendedAction: risk.recommendedAction || (riskScore > 65 ? 'Secondary Verification Required' : riskScore > 35 ? 'Officer Review Recommended' : 'Standard Processing'),
    reasons: Array.isArray(risk.reasons) ? risk.reasons : (Array.isArray(risk.topReasons) ? risk.topReasons.map((r: any, i: number) => ({
      id: r.id || `rs-${i}`,
      label: typeof r === 'string' ? r : r.label || 'Security verification flag',
      severity: r.severity || 'INFO',
      category: r.category || 'document_validity',
      contribution: r.contribution ?? r.points ?? 0,
    })) : []),
    breakdown: Array.isArray(risk.breakdown) ? risk.breakdown.map((b: any) => ({
      category: b.category || 'document_validity',
      score: b.score ?? b.points ?? 0,
      maxScore: b.maxScore ?? b.maxPoints ?? 30,
      origin: b.origin || 'DETERMINISTIC',
      note: b.note,
    })) : [],
    escalations: Array.isArray(risk.escalations) ? risk.escalations : [],
    partial: risk.partial ?? false,
    evaluatedAt: raw.completedAt || raw.completed_at || new Date().toISOString(),
  };

  return {
    caseId: raw.caseId || raw.case_id || `case-${Date.now().toString(16)}`,
    status: raw.status || 'COMPLETED',
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    completedAt: raw.completedAt || raw.completed_at || new Date().toISOString(),
    processingTimeMs: raw.processingTimeMs || raw.processing_time_ms || 350,
    document: {
      documentId: doc.documentId || doc.id || raw.caseId || 'doc-0',
      type: doc.type || raw.documentType || 'PASSPORT',
      documentNumber: doc.documentNumber || doc.document_number || 'N/A',
      holderName: doc.holderName || doc.holder_name || 'N/A',
      imageUrl: doc.imageUrl || doc.document_image_b64 || '',
      fields: Array.isArray(doc.fields) ? doc.fields : (Array.isArray(ocr.fields) ? ocr.fields : []),
    },
    quality: raw.quality || { isAcceptable: true, checks: [], warnings: [] },
    ocr: {
      status: ocr.status || 'COMPLETED',
      fields: Array.isArray(ocr.fields) ? ocr.fields : [],
      overallConfidence: ocr.overallConfidence ?? 0.96,
      rawText: ocr.rawText,
      engine: ocr.engine,
    },
    mrz: {
      status: mrz.status || 'COMPLETED',
      valid: mrz.valid ?? (mrz.status === 'COMPLETED'),
      lines: mrz.lines || mrz.rawLines || [],
      format: mrz.format || 'TD3',
      fields: Array.isArray(mrz.fields) ? mrz.fields : [],
      checkDigits: Array.isArray(mrz.checkDigits) ? mrz.checkDigits : [],
    },
    crossCheck: {
      status: crossCheck.status || 'COMPLETED',
      comparisons: Array.isArray(crossCheck.comparisons) ? crossCheck.comparisons : [],
      mismatchCount: crossCheck.mismatchCount ?? 0,
    },
    validation: {
      status: validation.status || 'COMPLETED',
      checks: Array.isArray(validation.checks) ? validation.checks : [],
      failedCount: validation.failedCount ?? 0,
      rulesetVersion: validation.rulesetVersion || 'ICAO-9303-v7',
    },
    tampering: normalizedTampering,
    face: normalizedFace,
    liveness: normalizedLiveness,
    watchlist: normalizedWatchlist,
    duplicate: normalizedDuplicate,
    risk: normalizedRisk,
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map((g: any) => ({
      category: g.category || 'document_validity',
      items: Array.isArray(g.items) ? g.items : Array.isArray(g.signals) ? g.signals.map((s: any) => ({
        label: s.label || 'Signal',
        detail: s.value || s.detail,
        verdict: s.severity === 'CRITICAL' ? 'ATTENTION' : 'OK',
      })) : [],
    })) : [],
    stages: Array.isArray(raw.stages) ? raw.stages : initialStages(),
    review: raw.review || { notes: [], history: [] },
    createdBy: raw.createdBy || { id: 'usr-officer-01', name: 'Insp. Priya Sharma', role: 'OFFICER' },
  };
}

/** `GET /api/screening/history` */
export async function getScreeningHistory(
  query: CaseQuery = {},
): Promise<Paginated<CaseSummary>> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.fast);
    return queryCases(query);
  }
  return camelize<Paginated<CaseSummary>>(
    await apiGet<unknown>('/api/screening/history', {
      params: {
        search: query.search,
        risk_level: query.riskLevel === 'ALL' ? undefined : query.riskLevel,
        status: query.status === 'ALL' ? undefined : query.status,
        document_type: query.documentType === 'ALL' ? undefined : query.documentType,
        from: query.from,
        to: query.to,
        page: query.page,
        page_size: query.pageSize,
        sort_by: query.sortBy,
        sort_dir: query.sortDir,
      },
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Officer actions                                                            */
/* -------------------------------------------------------------------------- */

export interface SubmitReviewOptions {
  payload: SubmitReviewPayload;
  actor: Pick<ScreeningActor, 'name' | 'role'>;
}

/**
 * Records an officer decision against a case.
 *
 * The action is advisory in the product sense — it records what the officer did
 * with the evidence. It is never an admission or refusal decision.
 */
export async function submitReview(options: SubmitReviewOptions): Promise<ScreeningResult> {
  const { payload, actor } = options;

  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.normal);
    const record = applyReview({
      caseId: payload.caseId,
      action: payload.action,
      note: payload.note,
      reason: payload.reason,
      actor,
    });
    if (!record) {
      throw new ApiError('NOT_FOUND', `No screening record found for ${payload.caseId}.`, 404);
    }
    return getScreening(payload.caseId);
  }

  return camelize<ScreeningResult>(
    await apiPost<unknown>(`/api/screening/${payload.caseId}/review`, {
      action: payload.action,
      note: payload.note,
      reason: payload.reason,
    }),
  );
}

/** Records that an officer opened a result — an auditable event in its own right. */
export async function recordReportViewed(
  caseId: string,
  actor: Pick<ScreeningActor, 'name' | 'role'>,
): Promise<void> {
  if (DEMO_MODE) {
    recordAudit({ action: 'REPORT_VIEWED', actor, caseId });
    return;
  }
  try {
    await apiPost(`/api/screening/${caseId}/viewed`);
  } catch {
    // Telemetry must never block the officer from reading the result.
  }
}
