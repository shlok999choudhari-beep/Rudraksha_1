'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateShort, formatRelative } from '@/lib/utils/dates';
import type { CaseSummary } from '@/lib/types/case';
import { CASE_STATUS_LABELS, type CaseStatus } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface RecentCasesProps {
  cases: CaseSummary[];
  title?: string;
  subtitle?: string;
  viewAllHref?: string;
  className?: string;
}

const CASE_STATUS_STYLES: Record<CaseStatus, string> = {
  AWAITING_REVIEW: 'bg-risk-medium/10 text-risk-medium border-risk-medium/30',
  REVIEWED: 'bg-risk-low/10 text-risk-low border-risk-low/30',
  ESCALATED: 'bg-risk-high/10 text-risk-high border-risk-high/30 font-medium',
  RECAPTURE_REQUESTED: 'bg-risk-medium/10 text-risk-medium border-risk-medium/30',
  DRAFT: 'bg-surface-muted text-muted-foreground border-border',
  PROCESSING: 'bg-surface-raised text-foreground border-border-strong',
  FAILED: 'bg-risk-high/10 text-risk-high border-risk-high/30',
};

export function RecentCases({
  cases,
  title = 'Recent High-Risk & Escalated Screenings',
  subtitle = 'Cases flagged for secondary inspection or officer decision',
  viewAllHref = '/cases?riskLevel=HIGH',
  className,
}: RecentCasesProps) {
  if (!cases || cases.length === 0) {
    return (
      <div className={cn('panel p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-2xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <EmptyState
          icon={<CheckCircle2 className="size-8 text-risk-low" />}
          title="No high-risk cases found"
          description="All recent screenings in this period are cleared or within normal tolerance."
        />
      </div>
    );
  }

  return (
    <div className={cn('panel overflow-hidden', className)}>
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <span className="inline-flex items-center rounded-full bg-risk-high/10 px-2 py-0.5 text-2xs font-medium text-risk-high">
              {cases.length} require attention
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="group flex items-center gap-1 text-xs font-medium text-foreground hover:text-muted-foreground transition-colors"
          >
            <span>View all cases</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-muted/50 border-b border-border text-2xs uppercase tracking-wider text-muted-foreground font-mono">
            <tr>
              <th className="py-3 px-5 font-medium">Case ID</th>
              <th className="py-3 px-4 font-medium">Subject / Document</th>
              <th className="py-3 px-4 font-medium">Risk Score</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Station & Officer</th>
              <th className="py-3 px-4 font-medium">Screened</th>
              <th className="py-3 px-5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.map((c) => (
              <tr
                key={c.caseId}
                className="hover:bg-surface-muted/40 transition-colors group cursor-pointer"
              >
                <td className="py-3.5 px-5 font-mono font-medium text-foreground whitespace-nowrap">
                  <Link
                    href={`/screening/${c.caseId}`}
                    className="hover:underline"
                  >
                    {c.caseId}
                  </Link>
                  {c.partial && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-sans" title="Partial Analysis">
                      <AlertTriangle className="size-3" />
                      Partial
                    </span>
                  )}
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="font-medium text-foreground">
                    {c.holderName ?? 'Unknown Subject'}
                  </div>
                  <div className="text-2xs text-muted-foreground font-mono mt-0.5">
                    {c.documentType} {c.documentNumber ? `· ${c.documentNumber}` : ''}
                  </div>
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <RiskBadge level={c.riskLevel} size="sm" />
                    <span className="font-mono text-2xs font-semibold tabular text-muted-foreground">
                      {c.riskScore}/100
                    </span>
                  </div>
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-2xs font-mono border',
                      CASE_STATUS_STYLES[c.status] ?? 'bg-surface-muted text-muted-foreground border-border'
                    )}
                  >
                    {CASE_STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="text-foreground">{c.officerName}</div>
                  {c.station && (
                    <div className="text-2xs text-muted-foreground truncate max-w-[140px]">
                      {c.station}
                    </div>
                  )}
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground text-2xs">
                  <div title={new Date(c.createdAt).toLocaleString()}>
                    {formatRelative(c.createdAt)}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/70">
                    {formatDateShort(c.createdAt)}
                  </div>
                </td>

                <td className="py-3.5 px-5 text-right whitespace-nowrap">
                  <Link
                    href={`/screening/${c.caseId}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground hover:bg-surface-muted hover:border-border-strong transition-colors"
                  >
                    <span>Review</span>
                    <ArrowRight className="size-3 text-muted-foreground group-hover:text-foreground" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
