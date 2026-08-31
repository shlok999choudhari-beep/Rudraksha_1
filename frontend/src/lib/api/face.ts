/**
 * Face verification and liveness.
 *
 * Spec §43 governs this module. The frontend sends a capture and receives a
 * similarity score, a threshold and an outcome — never an embedding, never a
 * model configuration, never the stored reference image. Comparison happens
 * server-side; the console only renders the verdict and the two crops the
 * officer needs in order to judge it themselves.
 */

import type { FaceVerificationResult, LivenessChallenge, LivenessResult } from '@/lib/types/screening';
import { DEMO_LATENCY, DEMO_MODE, apiPost, camelize, delay, notImplemented } from './client';

export interface FaceCapture {
  captureId: string;
  /** Local preview only. In live mode the frame is uploaded, not kept. */
  previewUrl: string;
  capturedAt: string;
  width: number;
  height: number;
}

/**
 * Registers a captured frame with the backend and returns a handle.
 *
 * The returned `previewUrl` is a local object URL for the officer's own review.
 * It is deliberately not persisted with the case: the raw frame belongs on the
 * server, and a data URL in localStorage would be exactly the leak §43 forbids.
 */
export async function submitFaceCapture(blob: Blob, dimensions: { width: number; height: number }): Promise<FaceCapture> {
  const capturedAt = new Date().toISOString();

  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.fast);
    return {
      captureId: `cap-${capturedAt.replace(/\D/g, '').slice(0, 14)}`,
      previewUrl: typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '',
      capturedAt,
      ...dimensions,
    };
  }

  const form = new FormData();
  form.append('file', blob, 'capture.jpg');
  const response = camelize<{ captureId: string }>(
    await apiPost<unknown>('/api/face/capture', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );

  return {
    captureId: response.captureId,
    previewUrl: typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '',
    capturedAt,
    ...dimensions,
  };
}

export interface VerifyFaceInput {
  documentId: string;
  captureId: string;
}

/**
 * `POST /api/face/verify`
 *
 * Not implemented by the connected backend. Demo mode produces this inside the
 * screening runner; live mode surfaces the gap as a FAILED stage so the officer
 * sees "identity comparison unavailable" instead of an implied match.
 */
export async function verifyFace(input: VerifyFaceInput): Promise<FaceVerificationResult> {
  if (DEMO_MODE) throw notImplemented('face/verify');
  return camelize<FaceVerificationResult>(
    await apiPost<unknown>('/api/face/verify', {
      document_id: input.documentId,
      capture_id: input.captureId,
    }),
  );
}

export interface LivenessInput {
  captureId: string;
  challenge: LivenessChallenge;
  /** Frame handles collected during the challenge, in capture order. */
  frameIds?: string[];
}

/** `POST /api/face/liveness` — challenge-response presentation-attack check. */
export async function checkLiveness(input: LivenessInput): Promise<LivenessResult> {
  if (DEMO_MODE) throw notImplemented('face/liveness');
  return camelize<LivenessResult>(
    await apiPost<unknown>('/api/face/liveness', {
      capture_id: input.captureId,
      challenge: input.challenge,
      frame_ids: input.frameIds,
    }),
  );
}
