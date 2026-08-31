'use client';

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ScanLine,
  ArrowLeft,
  ArrowRight,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import {
  ScreeningStepper,
  type ScreeningStep,
  DocumentTypeSelector,
  DocumentUploader,
  DocumentPreview,
  QualityCheck,
  CameraCapture,
  LivenessChallenge,
  ProcessingPipeline,
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
  DemoScenarioPicker,
} from '@/components/screening';
import { useDocumentUpload } from '@/lib/hooks/useDocumentUpload';
import { useRunScreening, useSubmitReview } from '@/lib/hooks/useScreening';
import type { DocumentType } from '@/lib/types/document';
import type { DemoScenario, LivenessChallenge as ChallengeType, ScreeningResult } from '@/lib/types/screening';
import { documentSvgDataUri } from '@/lib/mock/svg';

export default function NewScreeningPage() {
  const router = useRouter();

  // Workflow step state
  const [currentStep, setCurrentStep] = useState<ScreeningStep>(1);

  // Configuration state
  const [documentType, setDocumentType] = useState<DocumentType>('PASSPORT');
  const [scenario, setScenario] = useState<DemoScenario>('GENUINE');
  const [challenge, setChallenge] = useState<ChallengeType>('TURN_LEFT');

  // Captured assets
  const { document, uploading, error: uploadError, upload, clear: clearDoc } = useDocumentUpload();
  const [liveFaceDataUrl, setLiveFaceDataUrl] = useState<string | null>(null);

  // Pipeline hook
  const {
    phase,
    stages,
    activeIndex,
    result,
    error: pipelineError,
    progress,
    start: startScreening,
    reset: resetScreening,
  } = useRunScreening();

  // Completed result state
  const [screeningResult, setScreeningResult] = useState<ScreeningResult | null>(null);

  // Review submission
  const submitReviewMutation = useSubmitReview(screeningResult?.caseId ?? '');

  // Handle specimen 1-click load
  const handleLoadSpecimen = (specimenType: 'GENUINE' | 'TAMPERED' | 'VISA') => {
    let docType: DocumentType = 'PASSPORT';
    let chosenScenario: DemoScenario = 'GENUINE';

    if (specimenType === 'TAMPERED') {
      chosenScenario = 'TAMPERED';
    } else if (specimenType === 'VISA') {
      docType = 'VISA';
      chosenScenario = 'GENUINE';
    }

    setDocumentType(docType);
    setScenario(chosenScenario);

    // Create virtual File from specimen SVG
    const svgData = documentSvgDataUri({
      documentType: docType,
      surname: chosenScenario === 'TAMPERED' ? 'SHARMA' : 'DOE',
      givenNames: chosenScenario === 'TAMPERED' ? 'ANANYA' : 'JOHN',
      dateOfBirth: chosenScenario === 'TAMPERED' ? '12 JAN 2001' : '12 JAN 2000',
      nationality: 'IND',
      documentNumber: docType === 'VISA' ? 'V8829103' : 'P1234567',
      sex: 'M',
      placeOfBirth: 'DELHI',
      issueDate: '15 MAR 2024',
      expiryDate: '15 MAR 2034',
      issuingAuthority: 'PASSPORT OFFICE DELHI',
      mrzLines:
        docType === 'VISA'
          ? [
              'V<INDDOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
              'V8829103<4IND0001128M3403158<<<<<<<<<<<<<<04',
            ]
          : [
              'P<INDDOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
              'P1234567<4IND0001128M3403158<<<<<<<<<<<<<<04',
            ],
      tamperHints: chosenScenario === 'TAMPERED' ? { dob: true } : undefined,
    });

    // Create a dummy File object
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const file = new File([blob], `${docType.toLowerCase()}_specimen.svg`, { type: 'image/svg+xml' });
    void upload(file, docType);
  };

  // Step 1 -> Step 2
  const handleProceedToFace = () => {
    if (!document) return;
    setCurrentStep(2);
  };

  // Step 2 Face Captured -> Step 3
  const handleFaceCaptured = (frame: { dataUrl: string; challenge: ChallengeType }) => {
    setLiveFaceDataUrl(frame.dataUrl);
    setChallenge(frame.challenge);
  };

  const handleStartAnalysis = async () => {
    if (!document) return;
    setCurrentStep(3);

    const res = await startScreening({
      documentId: document.documentId,
      documentType,
      demoScenario: scenario,
      livenessChallenge: challenge,
      documentImageUrl: document.imageUrl,
      liveFaceImageUrl: liveFaceDataUrl ?? undefined,
    });

    if (res) {
      setScreeningResult(res);
      setCurrentStep(4);
    }
  };

  // Review submission
  const handleReview = async (payload: { action: any; note?: string; reason?: string }) => {
    if (!screeningResult) return;
    await submitReviewMutation.mutateAsync(payload);
    setScreeningResult((prev) =>
      prev
        ? {
            ...prev,
            status:
              payload.action === 'ESCALATE'
                ? 'ESCALATED'
                : payload.action === 'REQUEST_RECAPTURE'
                  ? 'RECAPTURE_REQUESTED'
                  : 'REVIEWED',
          }
        : null
    );
  };

  const handleStartAnother = () => {
    clearDoc();
    setLiveFaceDataUrl(null);
    resetScreening();
    setScreeningResult(null);
    setCurrentStep(1);
  };

  return (
    <PageContainer
      title="New Screening Case"
      description="Multi-stage document capture, live face challenge, and explainable forensic analysis"
      actions={
        currentStep === 4 && screeningResult ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleStartAnother}>
              <RefreshCw className="size-3.5 mr-1" />
              <span>Start Another Screening</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`/cases/${screeningResult.caseId}`)}
            >
              <span>View in Case Archive</span>
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Step Progress Stepper */}
        <ScreeningStepper
          currentStep={currentStep}
          onStepClick={(step) => {
            if (step < currentStep) setCurrentStep(step);
          }}
          canNavigateBack={currentStep < 4}
        />

        {/* STEP 1: DOCUMENT UPLOAD & QUALITY */}
        {currentStep === 1 && (
          <div className="space-y-5">
            {/* SIH Scenario Quick-Picker */}
            <DemoScenarioPicker
              selectedScenario={scenario}
              onSelectScenario={(s) => setScenario(s)}
            />

            {/* Document Type Selector */}
            <DocumentTypeSelector
              value={documentType}
              onChange={(t) => setDocumentType(t)}
            />

            {/* Document Upload or Preview */}
            {!document ? (
              <DocumentUploader
                documentType={documentType}
                uploadedDocument={document}
                onUpload={(f) => upload(f, documentType)}
                onClear={clearDoc}
                onLoadSpecimen={handleLoadSpecimen}
                isUploading={uploading}
                error={uploadError}
              />
            ) : (
              <div className="space-y-4">
                <DocumentPreview
                  document={document}
                  onReplace={clearDoc}
                  onContinue={handleProceedToFace}
                  canContinue={document.quality.isAcceptable}
                />

                {/* Quality Check Results */}
                <QualityCheck
                  report={document.quality}
                  onRetry={clearDoc}
                />

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleProceedToFace}
                    disabled={!document.quality.isAcceptable}
                    className="shadow-md shadow-primary/20"
                  >
                    <span>Proceed to Live Face Capture</span>
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: LIVE FACE & LIVENESS */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <CameraCapture
              activeChallenge={challenge}
              onCapture={handleFaceCaptured}
              onUseSample={(variant) => {
                if (variant === 'IMPERSONATION') setScenario('IMPERSONATION');
                else if (variant === 'DUPLICATE') setScenario('DUPLICATE_IDENTITY');
              }}
            />

            <LivenessChallenge challenge={challenge} />

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                size="default"
                onClick={() => setCurrentStep(1)}
              >
                <ArrowLeft className="size-4 mr-1.5" />
                <span>Back to Document</span>
              </Button>

              <Button
                variant="default"
                size="lg"
                onClick={handleStartAnalysis}
                className="shadow-md shadow-primary/20"
              >
                <Cpu className="size-4 mr-2" />
                <span>Run Forensic Analysis Pipeline</span>
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PROCESSING PIPELINE */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <ProcessingPipeline
              stages={stages}
              activeIndex={activeIndex}
              progress={progress}
              isPartial={result?.risk.partial}
              onViewResults={() => {
                if (result) {
                  setScreeningResult(result);
                  setCurrentStep(4);
                }
              }}
            />
          </div>
        )}

        {/* STEP 4: SCREENING REPORT & EVIDENCE */}
        {currentStep === 4 && screeningResult && (
          <div className="space-y-6">
            {/* Hero Risk Assessment Header */}
            <RiskScore assessment={screeningResult.risk} />

            {/* Evidence Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (8 cols): Deep Forensics & Verifications */}
              <div className="lg:col-span-8 space-y-6">
                {/* Tampering Forensic Image Analysis */}
                <TamperAnalysis
                  tampering={screeningResult.tampering}
                  documentImageUrl={screeningResult.document.imageUrl}
                />

                {/* Face Biometrics Comparison */}
                <FaceVerification face={screeningResult.face} />

                {/* OCR vs MRZ Cross Validation */}
                <CrossCheckResults crossCheck={screeningResult.crossCheck} />

                {/* Deterministic Document Rules */}
                <ValidationResults validation={screeningResult.validation} />

                {/* OCR Extracted Fields */}
                <OCRResults ocr={screeningResult.ocr} />

                {/* MRZ Details & Check Digits */}
                <MRZResults mrz={screeningResult.mrz} />

                {/* Liveness Verification */}
                <LivenessResult liveness={screeningResult.liveness} />

                {/* Database & Watchlist Check */}
                <WatchlistResult watchlist={screeningResult.watchlist} />

                {/* Duplicate Identity */}
                <DuplicateIdentity duplicate={screeningResult.duplicate} />
              </div>

              {/* Right Column (4 cols): Risk Breakdown, Evidence Summary & Officer Review */}
              <div className="lg:col-span-4 space-y-6">
                {/* Evidence Summary List */}
                <EvidenceSummary
                  evidence={screeningResult.evidence}
                  reasons={screeningResult.risk.reasons}
                />

                {/* Category Risk Breakdown */}
                <RiskBreakdown items={screeningResult.risk.breakdown} />

                {/* Officer Action & Review Box */}
                <OfficerActions
                  caseId={screeningResult.caseId}
                  status={screeningResult.status}
                  review={screeningResult.review}
                  onSubmitReview={handleReview}
                  isSubmitting={submitReviewMutation.isPending}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
