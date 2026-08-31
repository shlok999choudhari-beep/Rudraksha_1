'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  ScrollText,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AuditLogEntry, AuditQuery, AuditAction } from '@/lib/types/audit';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_SEVERITY,
} from '@/lib/types/audit';
import type { Paginated } from '@/lib/types/case';
import { formatDateShort, formatRelative } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

export interface AuditTableProps {
  data?: Paginated<AuditLogEntry>;
  query: AuditQuery;
  onQueryChange: (next: AuditQuery) => void;
  isLoading?: boolean;
  className?: string;
}

const SEVERITY_STYLES = {
  INFO: 'bg-surface-muted text-muted-foreground border-border',
  NOTABLE: 'bg-primary/10 text-primary border-primary/30',
  CRITICAL: 'bg-risk-high/15 text-risk-high border-risk-high/40 font-semibold',
};

export function AuditTable({
  data,
  query,
  onQueryChange,
  isLoading = false,
  className,
}: AuditTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 25;
  const totalPages = Math.ceil(total / pageSize);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search & Filter Bar */}
      <div className="panel p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query.search ?? ''}
              onChange={(e) => onQueryChange({ ...query, search: e.target.value, page: 1 })}
              placeholder="Search audit trail by Officer, Case ID, or detail..."
              className="pl-9 text-xs"
            />
            {query.search && (
              <button
                onClick={() => onQueryChange({ ...query, search: '', page: 1 })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono text-muted-foreground whitespace-nowrap">
              Action:
            </span>
            <select
              value={query.action ?? 'ALL'}
              onChange={(e) =>
                onQueryChange({ ...query, action: e.target.value as AuditAction | 'ALL', page: 1 })
              }
              className="text-xs bg-surface-muted border border-border rounded-md px-2.5 py-1.5 text-foreground max-w-[200px]"
            >
              <option value="ALL">All Actions</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {AUDIT_ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        {items.length === 0 && !isLoading ? (
          <div className="p-8">
            <EmptyState
              icon={<ScrollText className="size-8 text-muted-foreground" />}
              title="No audit entries found"
              description="No events match your current filter parameters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted/60 border-b border-border text-2xs uppercase tracking-wider text-muted-foreground font-mono">
                <tr>
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Actor & Role</th>
                  <th className="py-3 px-4 font-medium">Action</th>
                  <th className="py-3 px-4 font-medium">Case Reference</th>
                  <th className="py-3 px-4 font-medium">Details</th>
                  <th className="py-3 px-4 text-right font-medium">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((entry) => {
                  const severity = AUDIT_ACTION_SEVERITY[entry.action] ?? 'INFO';
                  const isExpanded = expandedRow === entry.id;

                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        onClick={() => toggleRow(entry.id)}
                        className="hover:bg-surface-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-mono text-2xs text-muted-foreground whitespace-nowrap">
                          <div className="text-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground/70">
                            {formatDateShort(entry.timestamp)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-foreground">{entry.actor.name}</div>
                          <div className="text-2xs font-mono text-muted-foreground">
                            {entry.actor.role}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded text-2xs font-mono border',
                              SEVERITY_STYLES[severity]
                            )}
                          >
                            {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
                          {entry.caseId ? (
                            <Link
                              href={`/cases/${entry.caseId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline font-semibold"
                            >
                              {entry.caseId}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-2xs text-foreground/90 max-w-xs truncate">
                          {entry.detail || '—'}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground p-1"
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Version / IP Drawer */}
                      {isExpanded && (
                        <tr className="bg-surface-muted/20">
                          <td colSpan={6} className="p-4 border-b border-border/80">
                            <div className="space-y-2 text-2xs font-mono text-muted-foreground">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1.5">
                                <span>Audit ID: <strong className="text-foreground">{entry.id}</strong></span>
                                <span>Origin IP: <strong className="text-foreground">{entry.ipAddress ?? '127.0.0.1'}</strong></span>
                                <span>ISO Timestamp: <strong className="text-foreground">{entry.timestamp}</strong></span>
                              </div>

                              {entry.detail && (
                                <div>
                                  <span className="text-muted-foreground">Action Payload: </span>
                                  <span className="text-foreground font-medium">{entry.detail}</span>
                                </div>
                              )}

                              {entry.versions && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  <span className="text-muted-foreground">Model & Ruleset Stamps:</span>
                                  {Object.entries(entry.versions).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="bg-surface-muted px-1.5 py-0.5 rounded border border-border text-foreground"
                                    >
                                      {k}: {v}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-surface-muted/20 text-xs">
            <span className="text-2xs text-muted-foreground font-mono">
              Showing {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total} audit records
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => onQueryChange({ ...query, page: page - 1 })}
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
                onClick={() => onQueryChange({ ...query, page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
