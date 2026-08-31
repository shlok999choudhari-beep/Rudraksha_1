import React from 'react';
import {
  Check,
  X,
  AlertOctagon,
  AlertTriangle,
  FileSpreadsheet,
  Binary,
  ShieldAlert,
} from 'lucide-react';
import type { ScreeningResponse } from '@/types/screening';

interface AuditTablesProps {
  data: ScreeningResponse;
}

export function AuditTables({ data }: AuditTablesProps) {
  const comparisons = data.cross_validation_report?.field_comparisons || [];
  const checksums = data.mrz_parsed_result?.checksum_breakdown || [];
  const violations = data.risk_assessment?.critical_violations || [];
  const warnings = data.risk_assessment?.warning_flags || [];

  return (
    <div className="space-y-6">
      {/* Violations & Warnings Banner if present */}
      {(violations.length > 0 || warnings.length > 0) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="size-4.5 text-rose-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-rose-900">
              Integrity Flags & Detected Anomalies
            </h3>
          </div>

          <div className="space-y-2">
            {violations.map((v, i) => (
              <div
                key={`v-${i}`}
                className="flex items-start gap-2.5 text-xs text-rose-900 bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs font-medium"
              >
                <AlertOctagon className="size-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{v}</span>
              </div>
            ))}

            {warnings.map((w, i) => (
              <div
                key={`w-${i}`}
                className="flex items-start gap-2.5 text-xs text-amber-900 bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs font-medium"
              >
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of Audit Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: VIZ vs MRZ Field Comparison */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-muted/60">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-foreground">
                  VIZ ↔ MRZ Cross-Validation
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  data.cross_validation_report?.is_consistent
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {data.cross_validation_report?.is_consistent ? 'CONSISTENT' : 'INCONSISTENCY DETECTED'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted/40 border-b border-border text-2xs uppercase tracking-wider text-muted-foreground font-mono">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Field</th>
                    <th className="py-2.5 px-3 font-semibold">Visual Zone (VIZ)</th>
                    <th className="py-2.5 px-3 font-semibold">MRZ Stream</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {comparisons.map((c, i) => (
                    <tr key={i} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="py-2.5 px-4 font-sans font-medium text-foreground whitespace-nowrap">
                        {c.field_name}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {c.viz_value || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-foreground font-semibold whitespace-nowrap">
                        {c.mrz_value || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {c.match ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-200">
                            <Check className="size-3" /> MATCH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-rose-200">
                            <X className="size-3" /> MISMATCH
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 bg-surface-muted/40 border-t border-border text-2xs text-muted-foreground font-mono">
            Optical Character Recognition (OCR) verified against MRZ line standard.
          </div>
        </div>

        {/* Table 2: ICAO Doc 9303 Check Digit Verification */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-muted/60">
              <div className="flex items-center gap-2">
                <Binary className="size-4 text-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-foreground">
                  ICAO 9303 Check Digit Breakdown
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  data.mrz_parsed_result?.is_valid
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {data.mrz_parsed_result?.is_valid ? 'ALL DIGITS VALID' : 'CHECKSUM FAILURE'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted/40 border-b border-border text-2xs uppercase tracking-wider text-muted-foreground font-mono">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Checksum Target</th>
                    <th className="py-2.5 px-3 font-semibold">Weight Algorithm</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Cryptographic Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {checksums.map((cs, i) => (
                    <tr key={i} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="py-2.5 px-4 font-sans font-medium text-foreground whitespace-nowrap">
                        {cs.field_name}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-2xs whitespace-nowrap">
                        Mod 10 (Weight 7, 3, 1)
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {cs.valid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-2xs font-semibold border border-emerald-200">
                            <Check className="size-3" /> VALID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 px-2 py-0.5 rounded text-2xs font-semibold border border-rose-200">
                            <X className="size-3" /> INVALID CHECKSUM
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 bg-surface-muted/40 border-t border-border text-2xs text-muted-foreground font-mono flex items-center justify-between">
            <span>Parsed Document: {data.mrz_parsed_result?.document_number || 'N/A'}</span>
            <span>Subject: {data.mrz_parsed_result?.surname} {data.mrz_parsed_result?.given_names}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
