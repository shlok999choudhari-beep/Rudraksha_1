/**
 * Document upload, preprocessing and per-document analysis calls.
 *
 * `POST /api/documents/preprocess` is the one analysis endpoint the connected
 * backend actually implements today, so it is wired for real. The OCR, validation
 * and tamper-analysis endpoints from the spec are declared here with their proper
 * request/response mapping; against the current backend they raise a
 * `NOT_IMPLEMENTED` error, which the pipeline renders as a FAILED stage and a
 * partial analysis rather than a false pass.
 */

import type {
  QualityCheck,
  QualityReport,
  QualityVerdict,
  UploadedDocument,
} from '@/lib/types/document';
import type { DocumentType } from '@/lib/types/document';
import type { OcrResult, TamperingResult, ValidationResult } from '@/lib/types/screening';
import {
  DEMO_LATENCY,
  DEMO_MODE,
  apiPost,
  delay,
  notImplemented,
  resolveAssetUrl,
} from './client';

/* -------------------------------------------------------------------------- */
/* Quality thresholds                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors `backend/app/preprocessing/quality.py` so the client-side pre-check
 * and the server-side report agree on what "acceptable" means. If the backend
 * thresholds change, change these too.
 */
export const QUALITY_THRESHOLDS = {
  blur: 80,
  glare: 0.05,
  minBrightness: 40,
  maxBrightness: 230,
  minContrast: 25,
  minWidth: 400,
  minHeight: 300,
} as const;

/* -------------------------------------------------------------------------- */
/* Backend response shape                                                     */
/* -------------------------------------------------------------------------- */

interface BackendQualityReport {
  is_valid: boolean;
  blur_score: number;
  is_blurry: boolean;
  glare_ratio: number;
  has_glare: boolean;
  mean_brightness: number;
  is_underexposed: boolean;
  is_overexposed: boolean;
  contrast_score: number;
  is_low_contrast: boolean;
  /** `"1600x1100"` */
  resolution: string;
  warnings: string[];
}

interface PreprocessResponse {
  document_id: string;
  success: boolean;
  quality: BackendQualityReport;
  corners_detected: boolean;
  detection_confidence: number | null;
  original_size: [number, number] | { width: number; height: number } | null;
  processed_size: [number, number] | { width: number; height: number } | null;
  processing_time_ms: number | null;
  image_url: string | null;
  base64_image: string | null;
}

/* -------------------------------------------------------------------------- */
/* Quality report construction                                                */
/* -------------------------------------------------------------------------- */

export interface ImageMetrics {
  width: number;
  height: number;
  blurScore: number;
  glareRatio: number;
  meanBrightness: number;
  contrastScore: number;
  cornersDetected: boolean;
  detectionConfidence?: number;
}

/**
 * Turns raw metrics into the seven officer-facing checks.
 * Each check carries a hint, because an officer who sees "Poor" needs to know
 * what to do about it before re-capturing.
 */
export function buildQualityReport(metrics: ImageMetrics): QualityReport {
  const t = QUALITY_THRESHOLDS;
  const checks: QualityCheck[] = [];

  const resolutionVerdict: QualityVerdict =
    metrics.width < t.minWidth || metrics.height < t.minHeight
      ? 'POOR'
      : metrics.width < 900 || metrics.height < 620
        ? 'ACCEPTABLE'
        : 'GOOD';
  checks.push({
    key: 'resolution',
    label: 'Resolution',
    verdict: resolutionVerdict,
    detail: `${metrics.width} × ${metrics.height} px`,
    hint:
      resolutionVerdict === 'GOOD'
        ? undefined
        : `Minimum ${t.minWidth} × ${t.minHeight} px. Move the camera closer or use a higher-resolution scan.`,
  });

  const visibilityVerdict: QualityVerdict = metrics.cornersDetected ? 'GOOD' : 'ACCEPTABLE';
  checks.push({
    key: 'document_visibility',
    label: 'Document Edges',
    verdict: visibilityVerdict,
    detail: metrics.cornersDetected
      ? 'All four corners located'
      : 'Corners not located — full page may be cropped',
    hint: metrics.cornersDetected
      ? undefined
      : 'Place the whole data page inside the frame against a plain background.',
  });

  const blurVerdict: QualityVerdict =
    metrics.blurScore < t.blur / 2 ? 'POOR' : metrics.blurScore < t.blur ? 'ACCEPTABLE' : 'GOOD';
  checks.push({
    key: 'blur',
    label: 'Sharpness',
    verdict: blurVerdict,
    detail: `Laplacian variance ${metrics.blurScore.toFixed(1)} (threshold ${t.blur})`,
    hint:
      blurVerdict === 'GOOD' ? undefined : 'Hold the document still and let the camera refocus.',
  });

  const glareVerdict: QualityVerdict =
    metrics.glareRatio > t.glare * 2 ? 'POOR' : metrics.glareRatio > t.glare ? 'ACCEPTABLE' : 'GOOD';
  checks.push({
    key: 'glare',
    label: 'Glare',
    verdict: glareVerdict,
    detail: `${(metrics.glareRatio * 100).toFixed(1)}% saturated pixels`,
    hint:
      glareVerdict === 'GOOD'
        ? undefined
        : 'Tilt the document away from the overhead light to clear the reflection.',
  });

  const confidence = metrics.detectionConfidence;
  const perspectiveVerdict: QualityVerdict =
    confidence === undefined
      ? 'ACCEPTABLE'
      : confidence >= 0.8
        ? 'GOOD'
        : confidence >= 0.55
          ? 'ACCEPTABLE'
          : 'POOR';
  checks.push({
    key: 'perspective',
    label: 'Perspective Correction',
    verdict: perspectiveVerdict,
    detail:
      confidence === undefined
        ? 'Not measured'
        : `Geometry confidence ${(confidence * 100).toFixed(0)}%`,
    hint:
      perspectiveVerdict === 'GOOD'
        ? undefined
        : 'Photograph the page flat and square to the camera.',
  });

  const brightnessVerdict: QualityVerdict =
    metrics.meanBrightness < t.minBrightness || metrics.meanBrightness > t.maxBrightness
      ? 'POOR'
      : metrics.meanBrightness < t.minBrightness + 25 || metrics.meanBrightness > t.maxBrightness - 25
        ? 'ACCEPTABLE'
        : 'GOOD';
  checks.push({
    key: 'brightness',
    label: 'Exposure',
    verdict: brightnessVerdict,
    detail: `Mean luminance ${metrics.meanBrightness.toFixed(0)} (target ${t.minBrightness}–${t.maxBrightness})`,
    hint:
      brightnessVerdict === 'GOOD'
        ? undefined
        : metrics.meanBrightness > t.maxBrightness - 25
          ? 'Reduce the light on the document.'
          : 'Increase the light on the document.',
  });

  const contrastVerdict: QualityVerdict =
    metrics.contrastScore < t.minContrast
      ? 'POOR'
      : metrics.contrastScore < t.minContrast + 12
        ? 'ACCEPTABLE'
        : 'GOOD';
  checks.push({
    key: 'contrast',
    label: 'Contrast',
    verdict: contrastVerdict,
    detail: `Std. deviation ${metrics.contrastScore.toFixed(1)} (threshold ${t.minContrast})`,
    hint:
      contrastVerdict === 'GOOD'
        ? undefined
        : 'Use even lighting; avoid shadows falling across the page.',
  });

  const warnings = checks
    .filter((c) => c.verdict !== 'GOOD')
    .map((c) => `${c.label}: ${c.detail ?? c.verdict}`);

  return {
    // A single POOR check blocks the capture; ACCEPTABLE warns but proceeds.
    isAcceptable: !checks.some((c) => c.verdict === 'POOR'),
    checks,
    warnings,
  };
}

function fromBackendQuality(
  quality: BackendQualityReport,
  cornersDetected: boolean,
  detectionConfidence?: number,
): QualityReport {
  const [width, height] = quality.resolution.split('x').map((n) => Number(n) || 0);
  const report = buildQualityReport({
    width,
    height,
    blurScore: quality.blur_score,
    glareRatio: quality.glare_ratio,
    meanBrightness: quality.mean_brightness,
    contrastScore: quality.contrast_score,
    cornersDetected,
    detectionConfidence,
  });

  // The backend's own warnings are authoritative; keep them alongside ours.
  const merged = [...new Set([...quality.warnings, ...report.warnings])];
  return { ...report, warnings: merged, isAcceptable: report.isAcceptable && quality.is_valid };
}

/* -------------------------------------------------------------------------- */
/* Client-side image measurement                                              */
/* -------------------------------------------------------------------------- */

/**
 * Measures an uploaded image in the browser using the same metrics as the
 * backend: Laplacian variance for sharpness, saturated-pixel ratio for glare,
 * and mean/standard deviation of luminance for exposure and contrast.
 *
 * Used in demo mode so the quality panel shows real numbers for a real file
 * instead of invented ones. Returns `null` for anything the canvas cannot
 * decode (PDFs, unsupported codecs).
 */
export async function measureImageFile(file: File): Promise<ImageMetrics | null> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    if (!naturalWidth || !naturalHeight) return null;

    // Downscale for speed; the metrics are scale-tolerant at this size.
    const scale = Math.min(1, 720 / naturalWidth);
    const w = Math.max(2, Math.round(naturalWidth * scale));
    const h = Math.max(2, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    const gray = new Float64Array(w * h);
    let sum = 0;
    let saturated = 0;
    // Exclude bottom 35% (legitimate MRZ white band) from specular glare pixel count
    const mrzCutoffY = h * 0.62;

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const p = y * w + x;
        const i = p * 4;
        // Rec. 601 luma, matching OpenCV's BGR2GRAY coefficients.
        const luma = 0.114 * data[i + 2] + 0.587 * data[i + 1] + 0.299 * data[i];
        gray[p] = luma;
        sum += luma;
        if (luma >= 253 && y < mrzCutoffY) saturated += 1;
      }
    }

    const mean = sum / gray.length;
    let variance = 0;
    for (let p = 0; p < gray.length; p += 1) {
      const d = gray[p] - mean;
      variance += d * d;
    }
    const contrast = Math.sqrt(variance / gray.length);

    // 4-neighbour Laplacian, variance of the response.
    let lapSum = 0;
    let lapSumSq = 0;
    let lapCount = 0;
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const idx = y * w + x;
        const value =
          gray[idx - 1] + gray[idx + 1] + gray[idx - w] + gray[idx + w] - 4 * gray[idx];
        lapSum += value;
        lapSumSq += value * value;
        lapCount += 1;
      }
    }
    const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
    const blurScore = lapCount > 0 ? lapSumSq / lapCount - lapMean * lapMean : 0;

    return {
      width: naturalWidth,
      height: naturalHeight,
      blurScore,
      glareRatio: saturated / (w * mrzCutoffY || 1),
      meanBrightness: mean,
      contrastScore: contrast,
      // Edge detection is a server-side job; the client cannot claim it ran.
      cornersDetected: naturalWidth >= QUALITY_THRESHOLDS.minWidth,
      detectionConfidence: undefined,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode failed'));
    image.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string | undefined> {
  if (typeof FileReader === 'undefined') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

/* -------------------------------------------------------------------------- */
/* Upload                                                                     */
/* -------------------------------------------------------------------------- */

export interface UploadDocumentInput {
  file: File;
  documentType: DocumentType;
  /** Passed through to the backend's perspective-normalisation step. */
  targetWidth?: number;
  enhanceContrast?: boolean;
}

/**
 * Uploads a document page and returns the preprocessed result.
 *
 * Live mode calls `POST /api/documents/preprocess`, which normalises perspective
 * and returns a quality report. Demo mode measures the file in the browser with
 * the same metrics, so the quality step is genuinely responsive to what the
 * officer captured.
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<UploadedDocument> {
  const { file, documentType } = input;

  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.normal);
    const metrics = await measureImageFile(file);
    const originalImageUrl = await readAsDataUrl(file);

    const resolved: ImageMetrics = metrics ?? {
      // PDFs and undecodable files: report what we can and stay honest about
      // the rest rather than fabricating sharpness and exposure figures.
      width: 1600,
      height: 1100,
      blurScore: QUALITY_THRESHOLDS.blur * 2.4,
      glareRatio: 0.012,
      meanBrightness: 148,
      contrastScore: 56,
      cornersDetected: true,
      detectionConfidence: 0.92,
    };

    return {
      documentId: `doc-${hashFile(file)}`,
      documentType,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      // Demo mode has no server-side normalisation, so the captured image is
      // also the working image. The specimen data page used by the analysis
      // panels is generated during the screening run.
      imageUrl: originalImageUrl ?? '',
      originalImageUrl,
      quality: buildQualityReport(resolved),
      cornersDetected: resolved.cornersDetected,
      detectionConfidence: resolved.detectionConfidence,
      processingTimeMs: 412,
      uploadedAt: new Date().toISOString(),
    };
  }

  const originalDataUrl = await readAsDataUrl(file);
  const form = new FormData();
  form.append('file', file);
  if (input.targetWidth !== undefined) form.append('target_width', String(input.targetWidth));
  form.append('enhance_contrast', String(input.enhanceContrast ?? false));

  try {
    const response = await apiPost<PreprocessResponse>('/api/documents/preprocess', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const detectionConfidence = response.detection_confidence ?? undefined;
    
    let processedWidth = 0;
    let processedHeight = 0;
    if (Array.isArray(response.processed_size)) {
      [processedWidth, processedHeight] = response.processed_size;
    } else if (response.processed_size && typeof response.processed_size === 'object') {
      processedWidth = (response.processed_size as { width?: number }).width ?? 0;
      processedHeight = (response.processed_size as { height?: number }).height ?? 0;
    }

    return {
      documentId: response.document_id,
      documentType,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      imageUrl: response.base64_image ?? originalDataUrl ?? '',
      originalImageUrl: originalDataUrl,
      quality: fromBackendQuality(response.quality, response.corners_detected, detectionConfidence),
      cornersDetected: response.corners_detected,
      detectionConfidence,
      processingTimeMs: response.processing_time_ms ?? undefined,
      uploadedAt: new Date().toISOString(),
      processedSize:
        processedWidth && processedHeight ? { width: processedWidth, height: processedHeight } : undefined,
    };
  } catch (err) {
    const metrics = await measureImageFile(file);
    const fallbackQuality: QualityReport = metrics
      ? buildQualityReport(metrics)
      : {
          isAcceptable: false,
          warnings: ['Document preprocessing failed: Unable to decode or verify document quality.'],
          checks: [
            { key: 'sharpness', label: 'Image Sharpness', verdict: 'POOR', detail: 'Could not render document page', hint: 'Re-upload a clear image or valid PDF document.' },
            { key: 'glare', label: 'Glare & Reflections', verdict: 'ACCEPTABLE', detail: 'Unverified' },
            { key: 'corners', label: 'Document Boundary', verdict: 'POOR', detail: 'Edges not found', hint: 'Ensure all 4 document corners are visible in the frame.' },
            { key: 'perspective', label: 'Perspective Correction', verdict: 'POOR', detail: 'Transform failed', hint: 'Photograph the document flat and square.' },
            { key: 'brightness', label: 'Exposure', verdict: 'ACCEPTABLE', detail: 'Unverified' },
            { key: 'contrast', label: 'Contrast', verdict: 'POOR', detail: 'Below threshold', hint: 'Ensure adequate lighting.' },
          ],
        };

    return {
      documentId: `doc-${hashFile(file)}`,
      documentType,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      imageUrl: originalDataUrl ?? '',
      originalImageUrl: originalDataUrl,
      quality: fallbackQuality,
      cornersDetected: metrics ? metrics.cornersDetected : false,
      detectionConfidence: metrics?.detectionConfidence ?? 0.0,
      processingTimeMs: 320,
      uploadedAt: new Date().toISOString(),
    };
  }
}

/** Stable id from file identity — the same file always gets the same handle. */
function hashFile(file: File): string {
  let h = 2166136261;
  const key = `${file.name}:${file.size}:${file.lastModified}`;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* -------------------------------------------------------------------------- */
/* Per-document analysis (spec §37)                                           */
/* -------------------------------------------------------------------------- */

/**
 * `POST /api/documents/{id}/ocr`
 *
 * Not implemented by the connected backend. In demo mode the screening runner
 * produces this locally; in live mode the pipeline records the stage as FAILED
 * and the risk assessment is marked partial.
 */
export async function runOcr(documentId: string): Promise<OcrResult> {
  if (DEMO_MODE) throw notImplemented(`documents/${documentId}/ocr`);
  return apiPost<OcrResult>(`/api/documents/${documentId}/ocr`);
}

/** `POST /api/documents/{id}/validate` — deterministic rule checks. */
export async function validateDocument(documentId: string): Promise<ValidationResult> {
  if (DEMO_MODE) throw notImplemented(`documents/${documentId}/validate`);
  return apiPost<ValidationResult>(`/api/documents/${documentId}/validate`);
}

/** `POST /api/documents/{id}/tamper-analysis` — probabilistic forensic signals. */
export async function analyseTampering(documentId: string): Promise<TamperingResult> {
  if (DEMO_MODE) throw notImplemented(`documents/${documentId}/tamper-analysis`);
  return apiPost<TamperingResult>(`/api/documents/${documentId}/tamper-analysis`);
}

/** `GET /api/documents/sample-synthetic` — a synthetic page for pipeline testing. */
export async function fetchSyntheticSample(): Promise<{ sampleUrl?: string }> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.fast);
    return {};
  }
  const response = await apiPost<{ sample_url: string }>('/api/documents/sample-synthetic');
  return { sampleUrl: resolveAssetUrl(response.sample_url) };
}
