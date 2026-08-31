'use client';

import * as React from 'react';
import { AlertTriangle, Users, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { DuplicateIdentityResult } from '@/lib/types/screening';
import { formatDateShort } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

export interface DuplicateIdentityProps {
  duplicate: DuplicateIdentityResult;
  className?: string;
}

export function DuplicateIdentity({ duplicate, className }: DuplicateIdentityProps) {
  const hasMatch = duplicate.possibleMatch;

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Duplicate Identity & Synthetic ID Detection
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-mono font-semibold border',
                hasMatch
                  ? 'bg-risk-high/15 text-risk-high border-risk-high/40'
                  : 'bg-risk-low/10 text-risk-low border-risk-low/30'
              )}
            >
              {hasMatch ? (
                <>
                  <AlertTriangle className="size-3" />
                  POSSIBLE DUPLICATE LEAD
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3" />
                  NO DUPLICATES FOUND
                </>
              )}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Biometric and demographic clustering across historical records to catch aliases or synthetic identities
          </p>
        </div>
      </div>

      {hasMatch && duplicate.candidates && duplicate.candidates.length > 0 ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-risk-high/30 bg-risk-high/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-risk-high">
                Potential Duplicate Candidate Identified (Requires Human Review)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                Investigation Lead Only
              </span>
            </div>

            <div className="space-y-2">
              {duplicate.candidates.map((c) => (
                <div
                  key={c.candidateId}
                  className="rounded-lg border border-border bg-surface/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground">{c.label}</div>
                    <div className="text-2xs text-muted-foreground font-mono mt-0.5">
                      Candidate ID: {c.candidateId} {c.firstSeenAt ? `· First Seen: ${formatDateShort(c.firstSeenAt)}` : ''}
                    </div>
                    {c.matchedOn && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {c.matchedOn.map((m, i) => (
                          <span
                            key={i}
                            className="bg-surface-muted text-foreground text-[10px] font-mono px-2 py-0.5 rounded border border-border"
                          >
                            Match: {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right sm:border-l sm:border-border sm:pl-4">
                    <span className="text-2xs font-mono text-muted-foreground block">Similarity</span>
                    <span className="font-mono text-base font-bold text-risk-high">
                      {Math.round(c.similarity * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-muted/30 p-4 text-xs text-muted-foreground">
          No existing traveller records share conflicting biometric hashes or demographic vectors.
        </div>
      )}
    </div>
  );
}
