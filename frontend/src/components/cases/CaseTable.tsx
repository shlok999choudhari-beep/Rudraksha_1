'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateShort, formatRelative } from '@/lib/utils/dates';
import type { CaseSummary, Paginated } from '@/lib/types/case';
import { CASE_STATUS_LABELS, type CaseStatus } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface CaseTableProps {
  data?: Paginated<CaseSummary>;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  className?: string;
}

const CASE_STATUS_STYLES: Record<CaseStatus, string> = {
  AWAITING_REVIEW: 'bg-risk-medium/15 text-risk-medium border-risk-medium/30',
  REVIEWED: 'bg-risk-low/10 text-risk-low border-risk-low/30',
  ESCALATED: 'bg-risk-high/15 text-risk-high border-risk-high/40 font-semibold',
  RECAPTURE_REQUESTED: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  DRAFT: 'bg-surface-muted text-muted-foreground border-border',
  PROCESSING: 'bg-primary/10 text-primary border-primary/30',
  FAILED: 'bg-risk-high/15 text-risk-high border-risk-high/40',
};

export function CaseTable({ data, isLoading = false, onPageChange, className }: CaseTableProps) {
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 15;
  const totalPages = Math.ceil(total / pageSize);

  if (!isLoading && items.length === 0) {
    return (
      <div className={cn('panel p-6', className)}>
        <EmptyState
          title="No screening cases found"
          description="No past screening cases match the active filter criteria. Try adjusting search terms or status filters."
        />
      </div>
    );
  }

  return (
    <div className={cn('panel overflow-hidden space-y-0', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-muted/60 border-b border-border text-2xs uppercase tracking-wider text-muted-foreground font-mono">
            <tr>
              <th className="py-3 px-4 font-medium">Case ID</th>
              <th className="py-3 px-4 font-medium">Traveller / Document</th>
              <th className="py-3 px-4 font-medium">Risk Score</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Station & Officer</th>
              <th className="py-3 px-4 font-medium">Timestamp</th>
              <th className="py-3 px-4 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((c) => (
              <tr
                key={c.caseId}
                className="hover:bg-surface-muted/40 transition-colors group cursor-pointer"
              >
                <td className="py-3.5 px-4 font-mono font-medium text-foreground whitespace-nowrap">
                  <Link
                    href={`/cases/${c.caseId}`}
                    className="hover:text-primary hover:underline"
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

                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <Link
                    href={`/cases/${c.caseId}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground hover:bg-surface-muted hover:border-border-strong transition-colors"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="size-3 text-muted-foreground group-hover:text-foreground" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between p-4 border-t border-border bg-surface-muted/20 text-xs">
          <span className="text-2xs text-muted-foreground font-mono">
            Showing {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total} cases
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="font-mono text-2xs text-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
