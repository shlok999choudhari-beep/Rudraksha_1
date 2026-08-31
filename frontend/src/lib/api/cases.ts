/**
 * Case listing and detail.
 *
 * Cases and screenings are the same records viewed differently: `screening.ts`
 * owns running and reviewing, this module owns browsing. Row-level visibility
 * (own cases vs all cases) is a backend decision; `officerName` is passed as a
 * filter hint, never relied on as an access control.
 */

import type { CaseQuery, CaseSummary, Paginated } from '@/lib/types/case';
import type { CaseNote, ScreeningResult } from '@/lib/types/screening';
import { applyReview, findCaseRecord, queryCases } from '@/lib/mock/store';
import { ApiError, DEMO_LATENCY, DEMO_MODE, apiGet, apiPost, camelize, delay } from './client';
import { getScreening } from './screening';

/** `GET /api/cases` (falls back to the screening-history endpoint in the spec). */
export async function listCases(query: CaseQuery = {}): Promise<Paginated<CaseSummary>> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.fast);
    return queryCases(query);
  }
  return camelize<Paginated<CaseSummary>>(
    await apiGet<unknown>('/api/cases', {
      params: {
        search: query.search,
        risk_level: query.riskLevel === 'ALL' ? undefined : query.riskLevel,
        status: query.status === 'ALL' ? undefined : query.status,
        document_type: query.documentType === 'ALL' ? undefined : query.documentType,
        from: query.from,
        to: query.to,
        page: query.page,
        page_size: query.pageSize,
        sort_by: query.sortBy,
        sort_dir: query.sortDir,
      },
    }),
  );
}

/** Full case detail, including the evidence panels and the review trail. */
export async function getCase(caseId: string): Promise<ScreeningResult> {
  return getScreening(caseId);
}

export interface AddCaseNoteInput {
  caseId: string;
  body: string;
  actor: { name: string; role: string };
}

export async function addCaseNote(input: AddCaseNoteInput): Promise<CaseNote[]> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.fast);
    const record = applyReview({
      caseId: input.caseId,
      action: 'ADD_NOTE',
      note: input.body,
      actor: input.actor,
    });
    if (!record) {
      throw new ApiError('NOT_FOUND', `No case found for ${input.caseId}.`, 404);
    }
    return record.review.notes;
  }
  return camelize<CaseNote[]>(
    await apiPost<unknown>(`/api/cases/${input.caseId}/notes`, { body: input.body }),
  );
}

/**
 * Neighbouring case ids, so the detail page can offer prev/next without the
 * officer going back to the table between every record.
 */
export async function getCaseNeighbours(
  caseId: string,
  query: CaseQuery = {},
): Promise<{ previous?: string; next?: string }> {
  if (!DEMO_MODE) return {};

  const page = queryCases({ ...query, page: 1, pageSize: 500 });
  const index = page.items.findIndex((c) => c.caseId === caseId);
  if (index === -1) return {};
  return {
    previous: index > 0 ? page.items[index - 1].caseId : undefined,
    next: index < page.items.length - 1 ? page.items[index + 1].caseId : undefined,
  };
}

/** Whether a case exists locally — used to render a 404 state without a fetch. */
export function caseExists(caseId: string): boolean {
  if (!DEMO_MODE) return true;
  return findCaseRecord(caseId) !== undefined;
}

/**
 * Builds a CSV export of the current case list.
 *
 * Deliberately limited to the summary columns already on screen. Evidence
 * detail, imagery and any model internals stay out of the export.
 */
export function toCsv(rows: CaseSummary[]): string {
  const header = [
    'Case ID',
    'Created',
    'Document Type',
    'Holder',
    'Document Number',
    'Risk Score',
    'Risk Level',
    'Status',
    'Officer',
    'Station',
    'Partial Analysis',
  ];

  const escape = (value: string | number | undefined) => {
    const text = value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = rows.map((row) =>
    [
      row.caseId,
      row.createdAt,
      row.documentType,
      row.holderName,
      row.documentNumber,
      row.riskScore,
      row.riskLevel,
      row.status,
      row.officerName,
      row.station,
      row.partial ? 'yes' : 'no',
    ]
      .map(escape)
      .join(','),
  );

  return [header.join(','), ...lines].join('\n');
}
