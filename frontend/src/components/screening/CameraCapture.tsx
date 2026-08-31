'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  Camera,
  RefreshCw,
  VideoOff,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCamera, type CapturedFrame } from '@/lib/hooks/useCamera';
import type { LivenessChallenge as ChallengeType } from '@/lib/types/screening';
import { LIVENESS_CHALLENGE_PROMPTS } from '@/lib/types/screening';
import { faceSvgDataUri } from '@/lib/mock/svg';
import { cn } from '@/lib/utils/cn';

export interface CameraCaptureProps {
  onCapture: (frame: { dataUrl: string; blob?: Blob; challenge: ChallengeType }) => void;
  onUseSample?: (variant: 'MATCHING' | 'IMPERSONATION' | 'DUPLICATE') => void;
  activeChallenge?: ChallengeType;
  className?: string;
}

export function CameraCapture({
  onCapture,
  onUseSample,
  activeChallenge = 'TURN_LEFT',
  className,
}: CameraCaptureProps) {
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeType>(activeChallenge);
  const [mirror, setMirror] = useState(true);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);

  const {
    state,
    videoRef,
    error,
    devices,
    activeDeviceId,
    start,
    stop,
    capture,
    selectDevice,
  } = useCamera({ autoStart: true });

  const challengePrompt = LIVENESS_CHALLENGE_PROMPTS[selectedChallenge];

  const handleTakeSnapshot = async () => {
    const frame = await capture({ mirror: false, quality: 0.92 });
    if (frame) {
      setPreviewFrame(frame.dataUrl);
      onCapture({ dataUrl: frame.dataUrl, blob: frame.blob, challenge: selectedChallenge });
    }
  };

  const handleRetake = () => {
    setPreviewFrame(null);
    void start();
  };

  const handleSamplePick = (variant: 'MATCHING' | 'IMPERSONATION' | 'DUPLICATE') => {
    const sampleUri = faceSvgDataUri({
      seed: variant === 'IMPERSONATION' ? 'impostor-face-99' : 'subject-face-01',
      variant: 'live',
    });
    setPreviewFrame(sampleUri);
    onCapture({ dataUrl: sampleUri, challenge: selectedChallenge });
    if (onUseSample) onUseSample(variant);
  };

  return (
    <div className={cn('panel p-5 space-y-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
            Live Subject Camera & Liveness Verification
          </h4>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Capture live face photograph and confirm active presentation challenge
          </p>
        </div>

        {/* Camera Selector */}
        {devices.length > 1 && state === 'ready' && (
          <select
            value={activeDeviceId ?? ''}
            onChange={(e) => selectDevice(e.target.value)}
            className="text-xs bg-surface-muted border border-border rounded-lg px-2.5 py-1 text-foreground"
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Camera Stage Viewport */}
      <div className="relative rounded-2xl border border-border bg-black overflow-hidden aspect-[4/3] max-h-[440px] flex items-center justify-center">
        {previewFrame ? (
          /* Captured Frame Preview */
          <div className="relative size-full flex items-center justify-center bg-black/90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewFrame}
              alt="Live Face Capture"
              className="max-h-full max-w-full object-contain rounded-xl"
            />
            <div className="absolute top-4 left-4 rounded-lg bg-surface/90 backdrop-blur border border-border px-3 py-1 text-xs font-mono text-risk-low flex items-center gap-1.5 shadow-lg">
              <CheckCircle2 className="size-4" />
              <span>Face Frame Acquired</span>
            </div>
          </div>
        ) : state === 'ready' ? (
          /* Live Stream */
          <div className="relative size-full flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cn(
                'size-full object-cover rounded-xl',
                mirror && 'scale-x-[-1]'
              )}
            />

            {/* Biometric Oval Guide Overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative w-48 sm:w-56 h-64 sm:h-72 rounded-[50%] border-2 border-dashed border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="size-6 border-t-2 border-l-2 border-primary/80 absolute top-4 left-4" />
                  <span className="size-6 border-t-2 border-r-2 border-primary/80 absolute top-4 right-4" />
                  <span className="size-6 border-b-2 border-l-2 border-primary/80 absolute bottom-4 left-4" />
                  <span className="size-6 border-b-2 border-r-2 border-primary/80 absolute bottom-4 right-4" />
                </div>
              </div>
              <p className="mt-3 font-mono text-2xs uppercase tracking-widest text-primary-foreground font-semibold bg-black/60 px-3 py-1 rounded-full border border-primary/30">
                Fit face inside oval
              </p>
            </div>
          </div>
        ) : state === 'requesting' ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center text-muted-foreground">
            <RefreshCw className="size-8 animate-spin text-primary" />
            <p className="text-xs">Initializing camera feed...</p>
          </div>
        ) : (
          /* Camera Error / Fallback Screen */
          <div className="flex flex-col items-center gap-3.5 p-8 text-center max-w-md">
            <div className="grid size-12 place-items-center rounded-xl bg-risk-high/10 text-risk-high border border-risk-high/30">
              <VideoOff className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {state === 'denied' ? 'Camera Access Denied' : 'Camera Feed Inactive'}
              </p>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                {error ?? 'Please check browser device permissions, or use a simulated specimen below for SIH testing.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Button size="sm" variant="secondary" onClick={() => start()}>
                <RefreshCw className="size-3.5 mr-1" />
                <span>Retry Permission</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Liveness Challenge Prompt & Actions Bar */}
      <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Liveness Challenge Prompt
              </span>
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-sm font-bold text-foreground">
              &quot;{challengePrompt}&quot;
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {previewFrame ? (
              <Button variant="secondary" size="default" onClick={handleRetake}>
                <RefreshCw className="size-4 mr-1.5" />
                <span>Retake Face</span>
              </Button>
            ) : (
              <Button
                variant="default"
                size="default"
                onClick={handleTakeSnapshot}
                disabled={state !== 'ready'}
                className="shadow-md shadow-primary/25"
              >
                <Camera className="size-4 mr-1.5" />
                <span>Capture Live Face</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Demo Specimen Avatars */}
      <div className="rounded-xl border border-border/80 bg-surface/50 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-3.5 text-primary" />
            <span>Preset Face Samples for Evaluation</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            SIH Demo Helpers
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleSamplePick('MATCHING')}
            className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-risk-low/40 text-left transition-colors"
          >
            <div>
              <div className="text-xs font-medium text-foreground">Matching Face</div>
              <div className="text-[10px] text-risk-low font-medium">96%+ Similarity (Genuine)</div>
            </div>
            <UserCheck className="size-4 text-risk-low" />
          </button>

          <button
            type="button"
            onClick={() => handleSamplePick('IMPERSONATION')}
            className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-risk-high/40 text-left transition-colors"
          >
            <div>
              <div className="text-xs font-medium text-foreground">Different Subject</div>
              <div className="text-[10px] text-risk-high font-medium">Low Similarity (Mismatch)</div>
            </div>
            <AlertTriangle className="size-4 text-risk-high" />
          </button>

          <button
            type="button"
            onClick={() => handleSamplePick('DUPLICATE')}
            className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 text-left transition-colors"
          >
            <div>
              <div className="text-xs font-medium text-foreground">Watchlist Synthetic</div>
              <div className="text-[10px] text-primary font-medium">Triggers Duplicate Lead</div>
            </div>
            <ShieldCheck className="size-4 text-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}
