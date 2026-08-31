/** Document upload, typing and image-quality contracts. */

export const DOCUMENT_TYPES = ['PASSPORT', 'VISA'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PASSPORT: 'Passport',
  VISA: 'Visa',
};

/** A single extracted field with its own confidence — never a bare string. */
export interface DocumentField {
  key: string;
  label: string;
  value: string;
  /** 0–1. Rendered as a percentage. */
  confidence: number;
  /** Present when the value was normalised (e.g. `12 JAN 2000` from `120100`). */
  rawValue?: string;
  /** Bounding box on the normalised document image, if the backend supplies it. */
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  /** All values are fractions (0–1) of the image width/height. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type QualityVerdict = 'GOOD' | 'ACCEPTABLE' | 'POOR';

/**
 * One row of the pre-analysis quality panel. Mirrors the fields produced by
 * `backend/app/preprocessing/quality.py`.
 */
export interface QualityCheck {
  key:
    | 'resolution'
    | 'document_visibility'
    | 'blur'
    | 'glare'
    | 'perspective'
    | 'brightness'
    | 'contrast';
  label: string;
  verdict: QualityVerdict;
  /** Human-readable measurement, e.g. `1654 × 1122 px` or `Variance 142.3`. */
  detail?: string;
  /** Advice shown when the verdict is not GOOD. */
  hint?: string;
}

export interface QualityReport {
  /** False when the image must be re-captured before analysis can proceed. */
  isAcceptable: boolean;
  checks: QualityCheck[];
  warnings: string[];
}

export interface UploadedDocument {
  documentId: string;
  documentType: DocumentType;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  /** Object URL or backend URL for the normalised (perspective-corrected) image. */
  imageUrl: string;
  /** Original, pre-normalisation preview. */
  originalImageUrl?: string;
  quality: QualityReport;
  cornersDetected: boolean;
  detectionConfidence?: number;
  processingTimeMs?: number;
  uploadedAt: string;
  /** Pixel dimensions after perspective normalisation, when the backend reports them. */
  processedSize?: { width: number; height: number };
}

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
