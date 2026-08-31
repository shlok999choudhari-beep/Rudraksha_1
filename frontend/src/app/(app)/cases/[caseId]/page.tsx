'use client';

import * as React from 'react';
import { useParams } from 'react-router-dom';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { FileCheck, ArrowLeft, ScanLine } from 'lucide-react';
import { CaseDetails } from '@/components/cases';
import { useCase, useCaseTimeline, useCaseNeighbours } from '@/lib/hooks/useCases';
import { useSubmitReview } from '@/lib/hooks/useScreening';

export default function CaseDetailsPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId || '';

  const { data: screening, isLoading, isError, refetch } = useCase(caseId);
  const { data: timeline } = useCaseTimeline(caseId);
  const { data: neighbours } = useCaseNeighbours(caseId);

  const submitReviewMutation = useSubmitReview(caseId);

  const handleReview = async (payload: { action: any; note?: string; reason?: string }) => {
    await submitReviewMutation.mutateAsync(payload);
    void refetch();
  };

  if (isLoading) {
    return (
      <PageContainer title={`Case ${caseId}`} description="Loading case file...">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (isError || !screening) {
    return (
      <PageContainer title="Case Record Not Found">
        <EmptyState
          icon={<FileCheck className="size-10 text-muted-foreground" />}
          title={`Case ${caseId} does not exist`}
          description="The requested screening case record could not be retrieved from the repository."
          action={
            <Link href="/cases">
              <Button variant="default" size="sm">
                <span>Browse Case Archive</span>
              </Button>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`Case File: ${screening.caseId}`}
      description={`${screening.document.type} · ${screening.document.holderName ?? 'Unknown Subject'} · Screened by ${screening.createdBy.name}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/cases">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="size-3.5 mr-1" />
              <span>Back to History</span>
            </Button>
          </Link>
          <Link href="/screening/new">
            <Button variant="default" size="sm" className="shadow-sm shadow-primary/20">
              <ScanLine className="size-3.5 mr-1" />
              <span>New Screening</span>
            </Button>
          </Link>
        </div>
      }
    >
      <CaseDetails
        screening={screening}
        timeline={timeline}
        neighbours={neighbours}
        onSubmitReview={handleReview}
        isSubmitting={submitReviewMutation.isPending}
      />
    </PageContainer>
  );
}
