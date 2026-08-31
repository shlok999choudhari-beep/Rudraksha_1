'use client';

import * as React from 'react';
import { useParams } from 'react-router-dom';
import Link from 'next/link';
import {
  ArrowLeft,
  ScanLine,
  FileCheck,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
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
import { useScreeningResult, useRecordReportViewed, useSubmitReview } from '@/lib/hooks/useScreening';
import { formatRelative } from '@/lib/utils/dates';

export default function ScreeningResultPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId || '';

  const { data: screening, isLoading, isError, refetch } = useScreeningResult(caseId);
  useRecordReportViewed(caseId);

  const submitReviewMutation = useSubmitReview(caseId);

  const handleReview = async (payload: { action: any; note?: string; reason?: string }) => {
    await submitReviewMutation.mutateAsync(payload);
    void refetch();
  };

  if (isLoading) {
    return (
      <PageContainer title={`Screening Case ${caseId}`} description="Loading forensic evidence and verification report...">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
            <div className="lg:col-span-4 space-y-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (isError || !screening) {
    return (
      <PageContainer title="Case Not Found">
        <EmptyState
          icon={<FileCheck className="size-10 text-muted-foreground" />}
          title={`Case ${caseId} does not exist`}
          description="The requested screening case record could not be retrieved from the repository."
          action={
            <Link href="/cases">
              <Button variant="default" size="sm">
                <span>Browse Case History</span>
              </Button>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`Screening Case ${screening.caseId}`}
      description={`${screening.document.type} · ${screening.document.holderName ?? 'Subject'} · Screened by ${screening.createdBy.name} (${formatRelative(screening.createdAt)})`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/cases">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="size-3.5 mr-1" />
              <span>Back to Cases</span>
            </Button>
          </Link>
          <Link href="/screening/new">
            <Button variant="default" size="sm">
              <ScanLine className="size-3.5 mr-1" />
              <span>New Screening</span>
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Risk Assessment Banner */}
        <RiskScore assessment={screening.risk} />

        {/* Evidence Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Forensics & Signals */}
          <div className="lg:col-span-8 space-y-6">
            {/* Tampering Forensic Image Analysis */}
            <TamperAnalysis
              tampering={screening.tampering}
              documentImageUrl={screening.document.imageUrl}
            />

            {/* Face Biometrics Comparison */}
            <FaceVerification face={screening.face} />

            {/* OCR vs MRZ Cross Validation */}
            <CrossCheckResults crossCheck={screening.crossCheck} />

            {/* Deterministic Document Rules */}
            <ValidationResults validation={screening.validation} />

            {/* OCR Extracted Fields */}
            <OCRResults ocr={screening.ocr} />

            {/* MRZ Details & Check Digits */}
            <MRZResults mrz={screening.mrz} />

            {/* Liveness Verification */}
            <LivenessResult liveness={screening.liveness} />

            {/* Database & Watchlist Check */}
            <WatchlistResult watchlist={screening.watchlist} />

            {/* Duplicate Identity */}
            <DuplicateIdentity duplicate={screening.duplicate} />
          </div>

          {/* Right Column (4 cols): Risk Breakdown, Evidence Summary & Officer Review */}
          <div className="lg:col-span-4 space-y-6">
            {/* Evidence Summary List */}
            <EvidenceSummary
              evidence={screening.evidence}
              reasons={screening.risk.reasons}
            />

            {/* Category Risk Breakdown */}
            <RiskBreakdown items={screening.risk.breakdown} />

            {/* Officer Action & Review Box */}
            <OfficerActions
              caseId={screening.caseId}
              status={screening.status}
              review={screening.review}
              onSubmitReview={handleReview}
              isSubmitting={submitReviewMutation.isPending}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
