'use client';

import * as React from 'react';
import { Search, Filter, X, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { CaseQuery } from '@/lib/types/case';
import type { RiskLevel } from '@/lib/types/risk';
import type { CaseStatus } from '@/lib/types/screening';
import type { DocumentType } from '@/lib/types/document';
import { cn } from '@/lib/utils/cn';

export interface CaseFiltersProps {
  query: CaseQuery;
  onChange: (next: CaseQuery) => void;
  onReset: () => void;
  className?: string;
}

const RISK_OPTIONS: { value: RiskLevel | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Risk' },
  { value: 'LOW', label: 'Low (0-29)' },
  { value: 'MEDIUM', label: 'Medium (30-59)' },
  { value: 'HIGH', label: 'High (60+)' },
];

const STATUS_OPTIONS: { value: CaseStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'AWAITING_REVIEW', label: 'Awaiting Review' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'RECAPTURE_REQUESTED', label: 'Recapture Requested' },
];

const DOC_TYPE_OPTIONS: { value: DocumentType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'VISA', label: 'Visa' },
];

export function CaseFilters({ query, onChange, onReset, className }: CaseFiltersProps) {
  const hasActiveFilters =
    Boolean(query.search) ||
    query.riskLevel !== 'ALL' ||
    query.status !== 'ALL' ||
    query.documentType !== 'ALL' ||
    Boolean(query.from) ||
    Boolean(query.to);

  return (
    <div className={cn('panel p-4 space-y-3', className)}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query.search ?? ''}
            onChange={(e) => onChange({ ...query, search: e.target.value, page: 1 })}
            placeholder="Search by Case ID, Traveller Name, Document Number or Officer..."
            className="pl-9 text-xs"
          />
          {query.search && (
            <button
              onClick={() => onChange({ ...query, search: '', page: 1 })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Risk Level Pills */}
        <div className="flex items-center rounded-lg border border-border bg-surface-muted/60 p-0.5 shrink-0 overflow-x-auto">
          {RISK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...query, riskLevel: opt.value, page: 1 })}
              className={cn(
                'px-2.5 py-1 text-2xs font-medium rounded-md transition-all whitespace-nowrap',
                (query.riskLevel ?? 'ALL') === opt.value
                  ? 'bg-surface text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary Row: Select Dropdowns & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-mono text-muted-foreground">Status:</span>
            <select
              value={query.status ?? 'ALL'}
              onChange={(e) =>
                onChange({ ...query, status: e.target.value as CaseStatus | 'ALL', page: 1 })
              }
              className="text-xs bg-surface-muted border border-border rounded-md px-2 py-1 text-foreground"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Document Type Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-mono text-muted-foreground">Doc Type:</span>
            <select
              value={query.documentType ?? 'ALL'}
              onChange={(e) =>
                onChange({ ...query, documentType: e.target.value as DocumentType | 'ALL', page: 1 })
              }
              className="text-xs bg-surface-muted border border-border rounded-md px-2 py-1 text-foreground"
            >
              {DOC_TYPE_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-2xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3 mr-1" />
            <span>Clear Filters</span>
          </Button>
        )}
      </div>
    </div>
  );
}
