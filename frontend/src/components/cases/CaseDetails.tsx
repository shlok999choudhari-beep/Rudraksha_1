'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  History,
  ShieldCheck,
  Printer,
  ChevronLeft,
  ChevronRight,
  Code,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  RiskScore,
  RiskBreakdown,
  EvidenceSummary,
  OCRResults,
  MRZResults,
  CrossCheckResults,
  ValidationResults,
  TamperAnalysis,
  FaceVerification,
  LivenessResult,
  WatchlistResult,
  DuplicateIdentity,
  OfficerActions,
} from '@/components/screening';
import type { ScreeningResult } from '@/lib/types/screening';
import type { AuditLogEntry } from '@/lib/types/audit';
import { formatDateShort, formatRelative } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

export interface CaseDetailsProps {
  screening: ScreeningResult;
  timeline?: AuditLogEntry[];
  neighbours?: { previous?: string; next?: string };
  onSubmitReview: (payload: { action: any; note?: string; reason?: string }) => Promise<void>;
  isSubmitting?: boolean;
  className?: string;
}

export function CaseDetails({
  screening,
  timeline = [],
  neighbours,
  onSubmitReview,
  isSubmitting = false,
  className,
}: CaseDetailsProps) {
  const [activeTab, setActiveTab] = useState<'evidence' | 'timeline' | 'metadata'>('evidence');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Top Breadcrumb / Nav Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/cases">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="size-3.5 mr-1" />
              <span>All Cases</span>
            </Button>
          </Link>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <span className="font-mono text-xs text-muted-foreground">
            Case: <strong className="text-foreground">{screening.caseId}</strong>
          </span>
        </div>

        {/* Previous / Next Case navigation */}
        {neighbours && (
          <div className="flex items-center gap-2">
            {neighbours.previous && (
              <Link href={`/cases/${neighbours.previous}`}>
                <Button variant="ghost" size="sm" className="text-xs">
                  <ChevronLeft className="size-3.5 mr-1" />
                  <span>Prev Case</span>
                </Button>
              </Link>
            )}
            {neighbours.next && (
              <Link href={`/cases/${neighbours.next}`}>
                <Button variant="ghost" size="sm" className="text-xs">
                  <span>Next Case</span>
                  <ChevronRight className="size-3.5 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setActiveTab('evidence')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all',
            activeTab === 'evidence'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <ShieldCheck className="size-4" />
          <span>Screening Report & Forensics</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all',
            activeTab === 'timeline'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <History className="size-4" />
          <span>Audit Trail ({timeline.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('metadata')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all',
            activeTab === 'metadata'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Code className="size-4" />
          <span>Raw Metadata & Versions</span>
        </button>
      </div>

      {/* TAB 1: EVIDENCE & FORENSICS */}
      {activeTab === 'evidence' && (
        <div className="space-y-6">
          <RiskScore assessment={screening.risk} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (8 cols): Forensics */}
            <div className="lg:col-span-8 space-y-6">
              <TamperAnalysis
                tampering={screening.tampering}
                documentImageUrl={screening.document.imageUrl}
              />

              <FaceVerification face={screening.face} />

              <CrossCheckResults crossCheck={screening.crossCheck} />

              <ValidationResults validation={screening.validation} />

              <OCRResults ocr={screening.ocr} />

              <MRZResults mrz={screening.mrz} />

              <LivenessResult liveness={screening.liveness} />

              <WatchlistResult watchlist={screening.watchlist} />

              <DuplicateIdentity duplicate={screening.duplicate} />
            </div>

            {/* Right Column (4 cols): Summary & Actions */}
            <div className="lg:col-span-4 space-y-6">
              <EvidenceSummary
                evidence={screening.evidence}
                reasons={screening.risk.reasons}
              />

              <RiskBreakdown items={screening.risk.breakdown} />

              <OfficerActions
                caseId={screening.caseId}
                status={screening.status}
                review={screening.review}
                onSubmitReview={onSubmitReview}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="panel p-6 space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Chain of Custody & Audit Timeline
            </h4>
            <p className="text-2xs text-muted-foreground mt-0.5">
              Chronological log of capture, model inference, review dispositions, and officer notes
            </p>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {timeline.map((entry) => (
              <div key={entry.id} className="relative space-y-1">
                <span className="absolute -left-[1.65rem] top-1 size-3 rounded-full border-2 border-background bg-primary" />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-foreground">
                    {entry.action.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground" title={entry.timestamp}>
                    {new Date(entry.timestamp).toLocaleTimeString()} ({formatRelative(entry.timestamp)})
                  </span>
                </div>

                <div className="text-2xs text-muted-foreground font-mono">
                  Actor: <strong className="text-foreground">{entry.actor.name}</strong> ({entry.actor.role})
                  {entry.ipAddress && ` · IP: ${entry.ipAddress}`}
                </div>

                {entry.detail && (
                  <p className="text-xs text-foreground/90 bg-surface-muted/40 p-2.5 rounded-lg border border-border mt-1">
                    {entry.detail}
                  </p>
                )}

                {entry.versions && (
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-muted-foreground pt-1">
                    {Object.entries(entry.versions).map(([k, v]) => (
                      <span key={k} className="bg-surface-muted px-1.5 py-0.5 rounded border border-border">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RAW METADATA & MODEL VERSIONS */}
      {activeTab === 'metadata' && (
        <div className="space-y-6">
          <div className="panel p-5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Model & Engine Versions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
                <div className="text-2xs font-mono text-muted-foreground">OCR Engine</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">PaddleOCR / Tesseract v2.4</div>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
                <div className="text-2xs font-mono text-muted-foreground">Forensics Model</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">ResNet-Forensics v3.0</div>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
                <div className="text-2xs font-mono text-muted-foreground">Face Biometrics</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">DeepFace FaceNet-512 v1.2</div>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
                <div className="text-2xs font-mono text-muted-foreground">Deterministic Rules</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">ICAO-Doc9303 Ruleset v2.1</div>
              </div>
            </div>
          </div>

          <div className="panel p-5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Raw JSON Screening Payload
            </h4>
            <pre className="bg-black/60 p-4 rounded-xl text-2xs font-mono text-foreground/90 overflow-x-auto max-h-96 leading-relaxed border border-border">
              {JSON.stringify(screening, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
