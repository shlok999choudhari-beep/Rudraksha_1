import React from 'react';
import {
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  RotateCcw,
  Download,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import type { RiskAssessment } from '@/types/screening';

interface TopHeaderProps {
  assessment: RiskAssessment | null;
  screeningId: string | null;
  onReset: () => void;
}

export function TopHeader({ assessment, screeningId, onReset }: TopHeaderProps) {
  if (!assessment) {
    return (
      <header className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="grid size-11 place-items-center rounded-xl bg-foreground text-background font-bold">
              <ShieldCheck className="size-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  VeriGuard — Officer Cockpit
                </h1>
                <span className="rounded border border-border-strong bg-surface-muted px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                  Standby
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload passport/ID document to run multi-layer forensic, ICAO 9303, and biometric integrity screening.
              </p>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const isApproved = assessment.screening_decision === 'APPROVED_FOR_CLEARANCE';
  const isHighRisk = assessment.overall_risk_level === 'HIGH';
  const isMediumRisk = assessment.overall_risk_level === 'MEDIUM';

  const score = assessment.overall_trust_score;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(assessment, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit_report_${screeningId || 'case'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <header className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left: Decision Badge & Case details */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Trust Score Circular Gauge */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="size-20 transform -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="text-surface-muted stroke-current"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                className={`stroke-current transition-all duration-1000 ${
                  isApproved ? 'text-emerald-600' : isHighRisk ? 'text-rose-600' : 'text-amber-500'
                }`}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="font-mono text-base font-bold text-foreground">
                {Math.round(score)}%
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground -mt-0.5">
                Trust
              </span>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              {isApproved ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 font-mono">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  🟢 CLEARANCE APPROVED
                </span>
              ) : isHighRisk ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 font-mono">
                  <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                  🔴 SECONDARY INSPECTION REQUIRED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 font-mono">
                  <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                  🟡 RECAPTURE / REVIEW RECOMMENDED
                </span>
              )}

              {screeningId && (
                <span className="rounded border border-border bg-surface-muted px-2 py-0.5 font-mono text-2xs text-muted-foreground">
                  ID: {screeningId}
                </span>
              )}
            </div>

            <p className="mt-2 text-xs font-medium text-foreground max-w-xl">
              {assessment.recommendation}
            </p>
          </div>
        </div>

        {/* Right: Officer Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {isApproved ? (
            <button
              type="button"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground text-background px-4 py-2 text-xs font-semibold hover:bg-foreground/90 transition-colors shadow-sm"
              onClick={() => alert(`Officer Clearance Logged for Case ${screeningId || 'Active'}`)}
            >
              <FileCheck className="size-4" />
              <span>Confirm Admission</span>
            </button>
          ) : (
            <button
              type="button"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 text-white px-4 py-2 text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm"
              onClick={() => alert(`Escalated to Secondary Inspection Officer (${screeningId || 'Active'})`)}
            >
              <ShieldAlert className="size-4" />
              <span>Escalate Case</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-muted transition-colors shadow-sm"
            title="Download Audit JSON File"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export Audit JSON</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors shadow-sm"
            title="Start New Screening"
          >
            <RotateCcw className="size-3.5" />
            <span>New Case</span>
          </button>
        </div>
      </div>
    </header>
  );
}
