'use client';

import * as React from 'react';
import { CheckCircle2, AlertTriangle, Database, ShieldCheck, AlertCircle } from 'lucide-react';
import type { WatchlistResult as WatchlistResultType, DocumentDbStatus, WatchlistOutcome } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface WatchlistResultProps {
  watchlist: WatchlistResultType;
  className?: string;
}

const DOC_STATUS_CONFIG: Record<
  DocumentDbStatus,
  { label: string; style: string }
> = {
  VALID: { label: 'VALID', style: 'bg-risk-low/10 text-risk-low border-risk-low/30' },
  EXPIRED: { label: 'EXPIRED', style: 'bg-risk-high/15 text-risk-high border-risk-high/40' },
  FLAGGED: { label: 'FLAGGED', style: 'bg-risk-high/15 text-risk-high border-risk-high/40' },
  REVOKED: { label: 'REVOKED', style: 'bg-risk-high/20 text-risk-high border-risk-high/50 font-bold' },
  REVIEW_REQUIRED: { label: 'REVIEW REQUIRED', style: 'bg-risk-medium/15 text-risk-medium border-risk-medium/40' },
  NOT_FOUND: { label: 'RECORD NOT FOUND', style: 'bg-surface-muted text-muted-foreground border-border' },
};

const WATCHLIST_CONFIG: Record<
  WatchlistOutcome,
  { label: string; style: string }
> = {
  CLEAR: { label: 'CLEAR (No Matches)', style: 'bg-risk-low/10 text-risk-low border-risk-low/30' },
  POSSIBLE_MATCH: { label: 'POSSIBLE MATCH', style: 'bg-risk-high/15 text-risk-high border-risk-high/40' },
  REVIEW_REQUIRED: { label: 'REVIEW REQUIRED', style: 'bg-risk-medium/15 text-risk-medium border-risk-medium/40' },
};

export function WatchlistResult({ watchlist, className }: WatchlistResultProps) {
  const docStatusCfg = DOC_STATUS_CONFIG[watchlist.documentStatus] ?? DOC_STATUS_CONFIG.VALID;
  const watchCfg = WATCHLIST_CONFIG[watchlist.watchlist] ?? WATCHLIST_CONFIG.CLEAR;

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Database & Watchlist Registry Cross-Check
            </h4>
            <span className="font-mono text-[10px] text-muted-foreground bg-surface-muted px-2 py-0.5 rounded border border-border">
              {watchlist.source}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Query against national issuance database, lost/stolen document index & security watchlists
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Document Registry Status */}
        <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Document Status in Registry</span>
            <span className={cn('font-mono text-2xs font-semibold px-2 py-0.5 rounded border', docStatusCfg.style)}>
              {docStatusCfg.label}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground">
            {watchlist.documentStatus === 'VALID'
              ? 'Document serial number is officially registered and active.'
              : 'Document status flagged in repository — officer verification required.'}
          </p>
        </div>

        {/* Watchlist Status */}
        <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Security Watchlist Index</span>
            <span className={cn('font-mono text-2xs font-semibold px-2 py-0.5 rounded border', watchCfg.style)}>
              {watchCfg.label}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground">
            {watchlist.watchlist === 'CLEAR'
              ? 'No adverse flags or law enforcement notices found for this subject.'
              : 'Potential candidate match identified — refer to supervisor.'}
          </p>
        </div>
      </div>

      {watchlist.notes && watchlist.notes.length > 0 && (
        <div className="rounded-lg border border-border/80 bg-surface/50 p-3 space-y-1 text-2xs text-muted-foreground font-mono">
          <span className="font-semibold text-foreground">Registry Notes:</span>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            {watchlist.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
