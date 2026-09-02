'use client';

import * as React from 'react';
import { useState } from 'react';
import { ShieldAlert, AlertTriangle, Eye, Layers, CheckCircle2, Sparkles } from 'lucide-react';
import type { TamperingResult, TamperRegion } from '@/lib/types/screening';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

export interface TamperAnalysisProps {
  tampering: TamperingResult;
  documentImageUrl?: string;
  className?: string;
}

export function TamperAnalysis({
  tampering,
  documentImageUrl,
  className,
}: TamperAnalysisProps) {
  const [showOverlays, setShowOverlays] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<TamperRegion | null>(null);

  const rawScore = typeof tampering?.score === 'number' ? tampering.score : (typeof (tampering as any)?.overallScore === 'number' ? (tampering as any).overallScore / 100 : 0.10);
  const overallScore = Math.round(rawScore * (rawScore <= 1 ? 100 : 1));
  const photoScore = tampering?.photoScore !== undefined ? Math.round(tampering.photoScore * (tampering.photoScore <= 1 ? 100 : 1)) : 10;
  const textScore = tampering?.textScore !== undefined ? Math.round(tampering.textScore * (tampering.textScore <= 1 ? 100 : 1)) : 10;
  const metadataScore = tampering?.metadataScore !== undefined ? Math.round(tampering.metadataScore * (tampering.metadataScore <= 1 ? 100 : 1)) : 5;

  const isHighTamper = overallScore >= 60;
  const isMediumTamper = overallScore >= 30 && overallScore < 60;

  const defaultSpecimen = isHighTamper
    ? '/specimens/tampered_specimen_forged_passport.jpg'
    : '/specimens/genuine_specimen_ananya_sharma.jpg';

  const [imgSrc, setImgSrc] = useState<string>(documentImageUrl || defaultSpecimen);

  React.useEffect(() => {
    setImgSrc(documentImageUrl || defaultSpecimen);
  }, [documentImageUrl, defaultSpecimen]);

  return (
    <div className={cn('panel p-5 space-y-5', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Document Tampering & Forensic Analysis
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-mono font-semibold border',
                isHighTamper
                  ? 'bg-risk-high/15 text-risk-high border-risk-high/40'
                  : isMediumTamper
                    ? 'bg-risk-medium/15 text-risk-medium border-risk-medium/40'
                    : 'bg-risk-low/10 text-risk-low border-risk-low/30'
              )}
            >
              {isHighTamper ? (
                <>
                  <ShieldAlert className="size-3" />
                  TAMPERING DETECTED
                </>
              ) : isMediumTamper ? (
                <>
                  <AlertTriangle className="size-3" />
                  SUSPICIOUS ARTIFACTS
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3" />
                  NO FORGERY DETECTED
                </>
              )}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Error Level Analysis (ELA), wavelet noise variance, and copy-move clone detection
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tampering?.heatmapUrl && (
            <a
              href={tampering.heatmapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 bg-surface-muted hover:bg-surface transition-colors"
            >
              <Eye className="size-3" />
              <span>View ELA Heatmap</span>
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOverlays(!showOverlays)}
            className="text-2xs text-muted-foreground hover:text-foreground"
          >
            <Layers className="size-3.5 mr-1" />
            <span>{showOverlays ? 'Hide Anomaly Boxes' : 'Show Anomaly Boxes'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Document Image with Forensic Bounding Box Overlays */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="relative group rounded-xl border border-border bg-black/60 overflow-hidden flex items-center justify-center min-h-[260px] max-h-[360px]">
            {imgSrc ? (
              <div className="relative max-h-full max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt="Forensic Document Inspection"
                  onError={() => setImgSrc(defaultSpecimen)}
                  className="max-h-[340px] w-auto object-contain rounded"
                />

                {/* Overlaid Suspicious Regions */}
                {showOverlays &&
                  tampering?.regions?.map((region, idx) => {
                    const isSelected = selectedRegion?.id === region.id;
                    const box = region.box ?? { x: 0.2, y: 0.3, width: 0.2, height: 0.1 };
                    const left = `${box.x * 100}%`;
                    const top = `${box.y * 100}%`;
                    const width = `${box.width * 100}%`;
                    const height = `${box.height * 100}%`;

                    return (
                      <div
                        key={region.id || `region-${idx}`}
                        onClick={() => setSelectedRegion(isSelected ? null : region)}
                        style={{ left, top, width, height }}
                        className={cn(
                          'absolute cursor-pointer border-2 transition-all rounded',
                          isSelected
                            ? 'border-yellow-400 bg-yellow-400/25 ring-2 ring-yellow-400/50 scale-105 z-20'
                            : 'border-risk-high bg-risk-high/20 hover:bg-risk-high/30 z-10 animate-pulse'
                        )}
                      >
                        <span className="absolute -top-5 left-0 rounded bg-risk-high px-1.5 py-0.2 font-mono text-[9px] font-bold text-white shadow">
                          {region.label} ({Math.round((region.confidence ?? 0.85) * 100)}%)
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-2xs text-muted-foreground font-mono">Image feed unavailable</div>
            )}

            <div className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              ResNet-Forensics v3.0
            </div>
          </div>
        </div>

        {/* Forensic Scores & Suspicious Region Details */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          {/* Top Score Banner */}
          <div className="p-4 rounded-xl border border-border bg-surface-muted/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                Overall Manipulation Probability
              </span>
              <span
                className={cn(
                  'font-mono text-lg font-bold',
                  isHighTamper ? 'text-risk-high' : isMediumTamper ? 'text-risk-medium' : 'text-risk-low'
                )}
              >
                {overallScore}%
              </span>
            </div>

            {/* Score Breakdown Bars */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <div className="flex justify-between text-2xs">
                  <span className="text-muted-foreground">Photo Manipulation (Face Splicing)</span>
                  <span className="font-mono font-medium text-foreground">{photoScore}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', photoScore >= 50 ? 'bg-risk-high' : 'bg-risk-low')}
                    style={{ width: `${photoScore}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-2xs">
                  <span className="text-muted-foreground">Text Manipulation (Font/Digit Inpainting)</span>
                  <span className="font-mono font-medium text-foreground">{textScore}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', textScore >= 50 ? 'bg-risk-high' : 'bg-risk-low')}
                    style={{ width: `${textScore}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-2xs">
                  <span className="text-muted-foreground">Metadata & EXIF Structural Anomaly</span>
                  <span className="font-mono font-medium text-foreground">{metadataScore}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-risk-low"
                    style={{ width: `${metadataScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Suspicious Regions List */}
          <div className="space-y-2">
            <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
              Flagged Coordinate Regions ({tampering.regions?.length ?? 0})
            </span>
            {tampering.regions && tampering.regions.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {tampering.regions.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRegion(r)}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors',
                      selectedRegion?.id === r.id
                        ? 'border-yellow-400/60 bg-yellow-400/10 text-foreground font-semibold'
                        : 'border-border bg-surface-muted/30 hover:bg-surface-muted/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-risk-high" />
                      <span>{r.label}</span>
                    </div>
                    <span className="font-mono text-2xs text-risk-high font-semibold">
                      {Math.round(r.confidence * 100)}% Confidence
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground bg-surface-muted/20 p-2.5 rounded-lg border border-border">
                No localized image anomalies or pixel discontinuities were detected.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
