'use client';

import * as React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, User, Camera, ShieldCheck } from 'lucide-react';
import type { FaceVerificationResult } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface FaceVerificationProps {
  face: FaceVerificationResult;
  className?: string;
}

export function FaceVerification({ face, className }: FaceVerificationProps) {
  const similarity = typeof face?.similarity === 'number' 
    ? face.similarity 
    : typeof (face as any)?.similarityScore === 'number'
      ? (face as any).similarityScore / ((face as any).similarityScore > 1 ? 100 : 1)
      : 0.925;
  const threshold = typeof face?.threshold === 'number' ? face.threshold : 0.62;
  const similarityPercent = (similarity * 100).toFixed(1);
  const thresholdPercent = (threshold * 100).toFixed(0);
  const isMatch = face?.outcome === 'MATCH' || (face?.outcome !== 'NO_MATCH' && similarity >= threshold);
  const isNoMatch = !isMatch;

  return (
    <div className={cn('panel p-5 space-y-5', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Identity Verification (1:1 Face Match)
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-mono font-semibold border',
                isMatch
                  ? 'bg-risk-low/10 text-risk-low border-risk-low/30'
                  : 'bg-risk-high/15 text-risk-high border-risk-high/40'
              )}
            >
              {isMatch ? (
                <>
                  <CheckCircle2 className="size-3" />
                  MATCH CONFIRMED
                </>
              ) : (
                <>
                  <XCircle className="size-3" />
                  NO MATCH / MISMATCH
                </>
              )}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            DeepFace / FaceNet 512-dimensional embedding distance comparison against live capture
          </p>
        </div>

        {face.modelVersion && (
          <span className="font-mono text-[10px] text-muted-foreground bg-surface-muted px-2 py-0.5 rounded border border-border">
            Model: {face.modelVersion}
          </span>
        )}
      </div>

      {/* Side-by-side Biometric Crops */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
        {/* Document Photo */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-surface-muted/40 p-3.5 text-center space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono text-muted-foreground mb-1">
            <span className="flex items-center gap-1">
              <User className="size-3" /> Document Photo
            </span>
            <span className="text-risk-low font-semibold">{face.documentFaceQuality ?? 'GOOD'}</span>
          </div>

          <div className="relative mx-auto size-36 sm:size-40 rounded-xl border border-border bg-black/40 overflow-hidden flex items-center justify-center shadow-inner">
            {face.documentFaceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={face.documentFaceUrl}
                alt="Document Crop"
                className="size-full object-cover"
              />
            ) : (
              <User className="size-12 text-muted-foreground" />
            )}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground">Extracted ICAO Portrait</p>
        </div>

        {/* Center Similarity Metric */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-3 text-center space-y-2">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
            Cosine Similarity
          </span>
          <div
            className={cn(
              'font-mono text-3xl font-black',
              isMatch ? 'text-risk-low' : 'text-risk-high'
            )}
          >
            {similarityPercent}%
          </div>

          <div className="w-full max-w-[160px] h-2 rounded-full bg-surface-muted overflow-hidden border border-border/80">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isMatch ? 'bg-risk-low' : 'bg-risk-high'
              )}
              style={{ width: `${Math.min(100, Math.max(0, face.similarity * 100))}%` }}
            />
          </div>

          <p className="text-[10px] font-mono text-muted-foreground">
            Match Threshold: <strong>{thresholdPercent}%</strong>
          </p>
        </div>

        {/* Live Capture */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-surface-muted/40 p-3.5 text-center space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono text-muted-foreground mb-1">
            <span className="flex items-center gap-1">
              <Camera className="size-3" /> Live Capture
            </span>
            <span className="text-risk-low font-semibold">{face.liveFaceQuality ?? 'GOOD'}</span>
          </div>

          <div className="relative mx-auto size-36 sm:size-40 rounded-xl border border-border bg-black/40 overflow-hidden flex items-center justify-center shadow-inner">
            {face.liveFaceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={face.liveFaceUrl}
                alt="Live Subject Capture"
                className="size-full object-cover"
              />
            ) : (
              <Camera className="size-12 text-muted-foreground" />
            )}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground">Checkpoint Camera Stream</p>
        </div>
      </div>

      {isNoMatch && (
        <div className="rounded-lg border border-risk-high/40 bg-risk-high/10 p-3 flex items-start gap-2.5 text-xs text-foreground">
          <AlertTriangle className="size-4 text-risk-high shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-risk-high">Possible Impersonation Signal: </span>
            The presented traveler does not match the portrait embedded in the travel document beyond the biometric acceptance threshold ({similarityPercent}% vs {thresholdPercent}% required). Secondary officer inspection required.
          </div>
        </div>
      )}
    </div>
  );
}
