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
  if ('risk' in response) return response;
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

  /* Live mode: start the run, then poll until the case settles. */
  const started = camelize<ScreeningResult | { caseId: string }>(
    await apiPost<unknown>('/api/screening/run', {
      document_id: options.payload.documentId,
      document_type: options.payload.documentType,
      face_capture_id: options.payload.faceCaptureId,
      liveness_challenge: options.payload.livenessChallenge,
    }),
  );

  if ('risk' in started) {
    onProgress({ stages: started.stages, activeIndex: started.stages.length, result: started });
    return started;
  }

  const caseId = started.caseId;
  const POLL_INTERVAL_MS = 1_200;
  const MAX_POLLS = 60; // ~72 s before we stop waiting.

  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    if (signal?.aborted) throw new ApiError('UNKNOWN', 'Screening cancelled.');

    const snapshot = await getScreening(caseId);
    const activeIndex = snapshot.stages.findIndex(
      (s) => s.status === 'PENDING' || s.status === 'PROCESSING',
    );
    const settled = activeIndex === -1;

    onProgress({
      stages: snapshot.stages,
      activeIndex: settled ? snapshot.stages.length : activeIndex,
      result: settled ? snapshot : undefined,
    });

    if (settled) return snapshot;
    await delay(POLL_INTERVAL_MS);
  }

  throw new ApiError(
    'TIMEOUT',
    'The screening did not finish in time. Open the case to see the partial analysis.',
  );
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
  return camelize<ScreeningResult>(await apiGet<unknown>(`/api/screening/${caseId}`));
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
