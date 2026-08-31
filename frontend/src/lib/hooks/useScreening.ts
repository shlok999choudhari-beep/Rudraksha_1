'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PipelineStageState, RunScreeningPayload, ReviewAction, ScreeningResult } from '@/lib/types/screening';
import { REVIEW_ACTION_LABELS } from '@/lib/types/screening';
import {
  getScreening,
  initialStages,
  recordReportViewed,
  runScreeningStaged,
  submitReview,
} from '@/lib/api/screening';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { queryKeys } from './queryKeys';

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

export function useScreeningResult(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.screening.detail(caseId ?? 'none'),
    queryFn: () => getScreening(caseId as string),
    enabled: Boolean(caseId),
  });
}

/** Records that the officer opened this result, once per mount. */
export function useRecordReportViewed(caseId: string | undefined) {
  const { user } = useAuth();
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    if (!caseId || !user || recorded.current === caseId) return;
    recorded.current = caseId;
    void recordReportViewed(caseId, { name: user.name, role: user.role });
  }, [caseId, user]);
}

/* -------------------------------------------------------------------------- */
/* Staged run                                                                 */
/* -------------------------------------------------------------------------- */

export type RunPhase = 'idle' | 'running' | 'completed' | 'failed';

export interface UseRunScreeningState {
  phase: RunPhase;
  stages: PipelineStageState[];
  activeIndex: number;
  result: ScreeningResult | null;
  error: string | null;
  /** 0–1 across the whole pipeline, for the top-level progress bar. */
  progress: number;
  start: (payload: RunScreeningPayload) => Promise<ScreeningResult | null>;
  cancel: () => void;
  reset: () => void;
}

/**
 * Drives the processing page.
 *
 * Stage transitions arrive from the API layer; this hook only holds them and
 * exposes cancellation. A stage that fails does not abort the run — the pipeline
 * continues and the result comes back marked partial, which is the behaviour the
 * spec requires: never a false pass, but never a blank page either.
 */
export function useRunScreening(): UseRunScreeningState {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [phase, setPhase] = useState<RunPhase>('idle');
  const [stages, setStages] = useState<PipelineStageState[]>(initialStages);
  const [activeIndex, setActiveIndex] = useState(0);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      // Leaving the page mid-run stops the replay loop rather than letting it
      // keep calling setState on an unmounted tree.
      abortRef.current?.abort();
    },
    [],
  );

  const start = useCallback(
    async (payload: RunScreeningPayload) => {
      if (!user) {
        setError('Sign in before starting a screening.');
        return null;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setPhase('running');
      setError(null);
      setResult(null);
      setStages(initialStages());
      setActiveIndex(0);

      try {
        const finished = await runScreeningStaged({
          payload,
          actor: {
            id: user.id,
            name: user.name,
            role: user.role,
            station: user.station,
          },
          signal: controller.signal,
          onProgress: (progress) => {
            setStages(progress.stages);
            setActiveIndex(progress.activeIndex);
          },
        });

        setResult(finished);
        setPhase('completed');

        void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });

        if (finished.risk.partial) {
          toast.push({
            tone: 'warning',
            title: 'Analysis completed with gaps',
            description:
              'One or more services did not respond. The risk score is not conclusive.',
          });
        }

        return finished;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'The screening could not run.';
        setError(message);
        setPhase('failed');
        toast.push({ tone: 'danger', title: 'Screening could not complete', description: message });
        return null;
      } finally {
        abortRef.current = null;
      }
    },
    [queryClient, toast, user],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setStages(initialStages());
    setActiveIndex(0);
    setResult(null);
    setError(null);
  }, []);

  const progress = useMemo(() => {
    if (stages.length === 0) return 0;
    const settled = stages.filter(
      (s) => s.status !== 'PENDING' && s.status !== 'PROCESSING',
    ).length;
    return Math.min(1, settled / stages.length);
  }, [stages]);

  return { phase, stages, activeIndex, result, error, progress, start, cancel, reset };
}

/* -------------------------------------------------------------------------- */
/* Officer actions                                                            */
/* -------------------------------------------------------------------------- */

export interface ReviewInput {
  action: ReviewAction;
  note?: string;
  reason?: string;
}

export function useSubmitReview(caseId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();

  return useMutation({
    mutationFn: (input: ReviewInput) =>
      submitReview({
        payload: { caseId, action: input.action, note: input.note, reason: input.reason },
        actor: { name: user?.name ?? 'Unknown', role: user?.role ?? 'OFFICER' },
      }),
    onSuccess: (_data, input) => {
      toast.push({
        tone: input.action === 'ESCALATE' ? 'warning' : 'success',
        title: `${REVIEW_ACTION_LABELS[input.action]} recorded`,
        description: `Case ${caseId} updated and written to the audit trail.`,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.screening.detail(caseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.timeline(caseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
    onError: (caught: Error) => {
      toast.push({
        tone: 'danger',
        title: 'Action not recorded',
        description: caught.message,
      });
    },
  });
}
