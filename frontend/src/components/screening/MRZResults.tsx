'use client';

import * as React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Scan, ShieldCheck } from 'lucide-react';
import type { MrzResult } from '@/lib/types/screening';
import { cn } from '@/lib/utils/cn';

export interface MRZResultsProps {
  mrz: MrzResult;
  className?: string;
}

export function MRZResults({ mrz, className }: MRZResultsProps) {
  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              MRZ (Machine Readable Zone) Analysis
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-mono font-semibold border',
                mrz.valid
                  ? 'bg-risk-low/10 text-risk-low border-risk-low/30'
                  : 'bg-risk-high/10 text-risk-high border-risk-high/30'
              )}
            >
              {mrz.valid ? (
                <>
                  <CheckCircle2 className="size-3" />
                  MRZ Valid & Verified
                </>
              ) : (
                <>
                  <XCircle className="size-3" />
                  Check Digits Mismatch
                </>
              )}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            ICAO Doc 9303 parser and mathematical 7-3-1 modulo checksum validator
          </p>
        </div>

        {mrz.format && (
          <span className="font-mono text-2xs bg-surface-muted px-2 py-1 rounded border border-border text-muted-foreground">
            Format: <strong className="text-foreground">{mrz.format}</strong>
          </span>
        )}
      </div>

      {/* Raw MRZ Monospace Block */}
      {mrz.lines && mrz.lines.length > 0 && (
        <div className="rounded-xl border border-border bg-black/60 p-4 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Raw MRZ Lines
          </div>
          {mrz.lines.map((line, idx) => (
            <div
              key={idx}
              className="font-mono text-xs sm:text-sm tracking-[0.2em] font-semibold text-emerald-400 bg-emerald-950/20 px-3 py-1.5 rounded border border-emerald-900/30 overflow-x-auto"
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Check Digits Verification Table */}
      {mrz.checkDigits && mrz.checkDigits.length > 0 && (
        <div className="space-y-2">
          <div className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
            ICAO Modulo 10 Check Digits
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted/60 border-b border-border text-2xs font-mono text-muted-foreground uppercase">
                <tr>
                  <th className="py-2.5 px-4">Checksum Field</th>
                  <th className="py-2.5 px-4 font-center">Expected</th>
                  <th className="py-2.5 px-4 font-center">Computed</th>
                  <th className="py-2.5 px-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mrz.checkDigits.map((cd) => (
                  <tr key={cd.field} className="hover:bg-surface-muted/30">
                    <td className="py-2 px-4 font-medium text-foreground">{cd.label}</td>
                    <td className="py-2 px-4 font-mono text-foreground">{cd.expected}</td>
                    <td className="py-2 px-4 font-mono text-foreground">{cd.found}</td>
                    <td className="py-2 px-4 text-right">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-mono text-2xs font-semibold px-2 py-0.5 rounded',
                          cd.valid
                            ? 'bg-risk-low/10 text-risk-low'
                            : 'bg-risk-high/10 text-risk-high'
                        )}
                      >
                        {cd.valid ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                        {cd.valid ? 'VALID' : 'MISMATCH'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
