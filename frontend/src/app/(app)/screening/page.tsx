'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { ScanLine, ShieldCheck, ClipboardList } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { RecentCases } from '@/components/dashboard/RecentCases';
import { useCases } from '@/lib/hooks/useCases';
import OfficerCockpitPage from '@/pages/OfficerCockpitPage';

export default function ScreeningQueuePage() {
  const [activeTab, setActiveTab] = useState<'cockpit' | 'queue'>('cockpit');
  const { data: awaitingCases } = useCases({
    status: 'AWAITING_REVIEW',
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      {/* Switcher bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('cockpit')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'cockpit'
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="size-4" />
              <span>Live Officer Cockpit</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'queue'
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ClipboardList className="size-4" />
              <span>Awaiting Review Queue</span>
              {awaitingCases?.total ? (
                <span className="rounded-full bg-foreground text-background px-1.5 py-0.2 text-[10px] font-mono">
                  {awaitingCases.total}
                </span>
              ) : null}
            </button>
          </div>

          <Link href="/screening/new">
            <Button variant="default" size="sm" className="shadow-sm">
              <ScanLine className="size-3.5 mr-1.5" />
              <span>Full Multi-Step Wizard</span>
            </Button>
          </Link>
        </div>
      </div>

      {activeTab === 'cockpit' ? (
        <OfficerCockpitPage />
      ) : (
        <PageContainer
          title="Screening Review Queue"
          description="Screenings awaiting secondary examination, supervisor referral, or officer disposition"
        >
          <div className="space-y-6">
            <RecentCases
              cases={awaitingCases?.items ?? []}
              title="Cases Awaiting Review"
              subtitle="Real-time queue of cases requiring human officer review"
              viewAllHref="/cases?status=AWAITING_REVIEW"
            />
          </div>
        </PageContainer>
      )}
    </div>
  );
}
