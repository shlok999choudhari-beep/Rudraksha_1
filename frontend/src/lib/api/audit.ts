/**
 * Audit log.
 *
 * The audit trail is append-only from the frontend's point of view: entries can
 * be listed and filtered, never edited or deleted. Only the Auditor and Admin
 * roles reach this API, and the backend must enforce that independently.
 */

import type { AuditLogEntry, AuditQuery } from '@/lib/types/audit';
import type { Paginated } from '@/lib/types/case';
import { queryAudit, recordAudit } from '@/lib/mock/store';
import { DEMO_LATENCY, DEMO_MODE, apiGet, apiPost, camelize, delay } from './client';

/** `GET /api/audit-logs` */
export async function listAuditLogs(query: AuditQuery = {}): Promise<Paginated<AuditLogEntry>> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.fast);
    return queryAudit(query);
  }
  return camelize<Paginated<AuditLogEntry>>(
    await apiGet<unknown>('/api/audit-logs', {
      params: {
        search: query.search,
        action: query.action === 'ALL' ? undefined : query.action,
        case_id: query.caseId,
        from: query.from,
        to: query.to,
        page: query.page,
        page_size: query.pageSize,
      },
    }),
  );
}

/** Every entry for one case, oldest first — the case timeline. */
export async function listCaseTimeline(caseId: string): Promise<AuditLogEntry[]> {
  const page = await listAuditLogs({ caseId, pageSize: 200 });
  return [...page.items].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export interface RecordEventInput {
  action: AuditLogEntry['action'];
  actor: { name: string; role: string };
  caseId?: string;
  detail?: string;
}

/**
 * Records a client-observable event.
 *
 * Only events the backend cannot see on its own belong here (a report being
 * opened, a capture being retaken). Anything the server already handles is
 * logged server-side, where it cannot be suppressed by the client.
 */
export async function recordAuditEvent(input: RecordEventInput): Promise<void> {
  if (DEMO_MODE) {
    recordAudit(input);
    return;
  }
  try {
    await apiPost('/api/audit-logs', {
      action: input.action,
      case_id: input.caseId,
      detail: input.detail,
    });
  } catch {
    // Never let an audit write failure interrupt the officer's workflow.
  }
}
