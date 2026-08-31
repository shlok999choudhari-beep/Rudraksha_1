/**
 * Demo data store.
 *
 * A synchronous, deterministic stand-in for the backend's persistence layer,
 * used when `NEXT_PUBLIC_DEMO_MODE` is on. It keeps the SIH demo runnable with
 * no server, and it is the only place in the frontend that pretends to be a
 * database — the API layer in `lib/api/` decides whether to call it or the real
 * FastAPI service.
 *
 * Two design notes worth knowing before editing:
 *
 * 1. Full `ScreeningResult` objects are NOT persisted. A case is stored as a
 *    small record (scenario + seed + timestamp), and the result is rebuilt on
 *    demand by `buildScreeningResult`. Because the builder is seeded, the rebuild
 *    is byte-identical, so localStorage stays small and nothing can drift.
 * 2. Nothing here calls `Math.random`, so repeated renders agree.
 */

import type {
  AnalyticsRange,
  AnalyticsSummary,
  DashboardStatistics,
  ProcessingTimePoint,
  RiskDistributionSlice,
  TopRiskReason,
  TrendPoint,
} from '@/lib/types/dashboard';
import type { AuditAction, AuditLogEntry, AuditQuery } from '@/lib/types/audit';
import type { CaseQuery, CaseSummary, Paginated } from '@/lib/types/case';
import type { DocumentType } from '@/lib/types/document';
import type { RiskLevel } from '@/lib/types/risk';
import type {
  CaseNote,
  CaseReview,
  CaseStatus,
  DemoScenario,
  ReviewAction,
  ScreeningResult,
} from '@/lib/types/screening';
import type { Role, User } from '@/lib/types/user';
import { buildScreeningResult } from './scenarios';
import { hashString, makeRng, rngInt, rngPick } from './seed';

/* -------------------------------------------------------------------------- */
/* Demo accounts                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Prototype accounts for the local demo. There is no authentication here — the
 * password is a shared constant so the demo can be driven from any machine, and
 * the real backend must issue and verify its own tokens.
 */
export const DEMO_PASSWORD = 'veriguard';

export const DEMO_USERS: readonly User[] = [
  {
    id: 'u-officer',
    email: 'officer@veriguard.demo',
    name: 'Ananya Sharma',
    role: 'OFFICER',
    station: 'Terminal 3 · Counter 12',
    badgeId: 'IMM-4471',
    avatarInitials: 'AS',
  },
  {
    id: 'u-supervisor',
    email: 'supervisor@veriguard.demo',
    name: 'Rohit Menon',
    role: 'SUPERVISOR',
    station: 'Terminal 3 · Control Desk',
    badgeId: 'IMM-2210',
    avatarInitials: 'RM',
  },
  {
    id: 'u-auditor',
    email: 'auditor@veriguard.demo',
    name: 'Farida Qureshi',
    role: 'AUDITOR',
    station: 'Compliance Office',
    badgeId: 'AUD-0093',
    avatarInitials: 'FQ',
  },
  {
    id: 'u-admin',
    email: 'admin@veriguard.demo',
    name: 'Vikram Iyer',
    role: 'ADMIN',
    station: 'Systems',
    badgeId: 'SYS-0001',
    avatarInitials: 'VI',
  },
] as const;

export function findDemoUserByEmail(email: string): User | undefined {
  const needle = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email.toLowerCase() === needle);
}

export function findDemoUserByRole(role: Role): User | undefined {
  return DEMO_USERS.find((u) => u.role === role);
}

/* -------------------------------------------------------------------------- */
/* Record shapes                                                              */
/* -------------------------------------------------------------------------- */

export interface CaseRecord {
  summary: CaseSummary;
  scenario: DemoScenario;
  /** Seed handed to `buildScreeningResult` — guarantees an identical rebuild. */
  seed: string;
  createdBy: { id: string; name: string; role: string };
  /** Reason labels, cached so analytics does not have to rebuild every case. */
  reasonLabels: string[];
  review: CaseReview;
  /**
   * Imagery captured in-session. Blob URLs are deliberately not persisted —
   * they die with the page — so a reloaded case falls back to the specimen.
   */
  documentImageUrl?: string;
  liveFaceImageUrl?: string;
}

interface StoreShape {
  version: number;
  cases: CaseRecord[];
  audit: AuditLogEntry[];
  sequence: number;
}

const STORAGE_KEY = 'veriguard.demo.store.v1';
const STORE_VERSION = 1;

/* -------------------------------------------------------------------------- */
/* Seed corpus configuration                                                  */
/* -------------------------------------------------------------------------- */

const SEED_CASE_COUNT = 78;
const SEED_WINDOW_DAYS = 45;

const OFFICER_ROSTER: { id: string; name: string; role: string; station: string }[] = [
  { id: 'u-officer', name: 'Ananya Sharma', role: 'OFFICER', station: 'Terminal 3 · Counter 12' },
  { id: 'u-officer-2', name: 'Devansh Rao', role: 'OFFICER', station: 'Terminal 3 · Counter 08' },
  { id: 'u-officer-3', name: 'Nisha Kulkarni', role: 'OFFICER', station: 'Terminal 2 · Counter 04' },
  { id: 'u-officer-4', name: 'Imran Sheikh', role: 'OFFICER', station: 'Terminal 1 · Counter 21' },
  { id: 'u-supervisor', name: 'Rohit Menon', role: 'SUPERVISOR', station: 'Terminal 3 · Control Desk' },
];

/**
 * Scenario mix for the seeded corpus. Weighted so the dashboard looks like a
 * working checkpoint — overwhelmingly routine, with a realistic tail.
 */
const SCENARIO_WEIGHTS: [DemoScenario, number][] = [
  ['GENUINE', 74],
  ['TAMPERED', 8],
  ['IMPERSONATION', 5],
  ['DUPLICATE_IDENTITY', 8],
  ['PARTIAL_FAILURE', 5],
];

function weightedScenario(rng: () => number): DemoScenario {
  const total = SCENARIO_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [scenario, weight] of SCENARIO_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return scenario;
  }
  return 'GENUINE';
}

/* -------------------------------------------------------------------------- */
/* Store lifecycle                                                            */
/* -------------------------------------------------------------------------- */

let store: StoreShape | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadFromStorage(): StoreShape | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoreShape;
    if (parsed.version !== STORE_VERSION) return null;
    return parsed;
  } catch {
    // A corrupt or quota-exceeded store is not worth failing the demo over.
    return null;
  }
}

function persist(): void {
  if (!isBrowser() || !store) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore: the in-memory store remains authoritative for this session.
  }
}

function getStore(): StoreShape {
  if (store) return store;
  store = loadFromStorage() ?? seedStore();
  persist();
  return store;
}

/** Wipes the demo store and reseeds it. Exposed on the settings page. */
export function resetDemoStore(): void {
  store = seedStore();
  persist();
}

/* -------------------------------------------------------------------------- */
/* Seeding                                                                    */
/* -------------------------------------------------------------------------- */

function seedStore(): StoreShape {
  // `now` is captured once. Seeded cases are positioned relative to it so the
  // dashboard always shows a plausible recent window.
  const now = Date.now();
  const rng = makeRng(hashString('veriguard-seed-corpus'));

  const cases: CaseRecord[] = [];
  const audit: AuditLogEntry[] = [];

  for (let i = 0; i < SEED_CASE_COUNT; i += 1) {
    const scenario = weightedScenario(rng);
    const documentType: DocumentType = rng() > 0.78 ? 'VISA' : 'PASSPORT';
    const officer = rngPick(rng, OFFICER_ROSTER);

    // Bias toward recent days so "last 7 days" is well populated.
    const dayOffset = Math.floor(Math.pow(rng(), 1.7) * SEED_WINDOW_DAYS);
    const createdAt = new Date(
      now -
        dayOffset * 86_400_000 -
        rngInt(rng, 0, 13) * 3_600_000 -
        rngInt(rng, 0, 59) * 60_000,
    );

    const caseId = formatCaseId(createdAt, SEED_CASE_COUNT - i);
    const seed = `${caseId}:${scenario}`;

    const result = buildScreeningResult({
      scenario,
      caseId,
      documentType,
      seed,
      createdAt,
      createdBy: { id: officer.id, name: officer.name, role: officer.role },
    });

    const status = seedStatus(result.risk.level, dayOffset, rng);
    const review = seedReview(status, createdAt, officer, rng);

    cases.push({
      summary: toSummary(result, { status, station: officer.station }),
      scenario,
      seed,
      createdBy: result.createdBy,
      reasonLabels: result.risk.reasons.map((r) => r.label),
      review,
    });

    audit.push(...seedAuditForCase(result, status, officer, review));
  }

  // Newest first — every list in the UI reads in this order.
  cases.sort((a, b) => b.summary.createdAt.localeCompare(a.summary.createdAt));
  audit.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    version: STORE_VERSION,
    cases,
    audit,
    sequence: SEED_CASE_COUNT,
  };
}

function formatCaseId(createdAt: Date, sequence: number): string {
  return `VG-${createdAt.getFullYear()}-${String(sequence).padStart(4, '0')}`;
}

function seedStatus(level: RiskLevel, dayOffset: number, rng: () => number): CaseStatus {
  // Anything older than two days has almost certainly been actioned.
  const settled = dayOffset > 2 || rng() > 0.45;
  if (!settled) return 'AWAITING_REVIEW';

  const roll = rng();
  if (level === 'HIGH') {
    if (roll < 0.6) return 'ESCALATED';
    if (roll < 0.85) return 'REVIEWED';
    return 'RECAPTURE_REQUESTED';
  }
  if (level === 'MEDIUM') {
    if (roll < 0.68) return 'REVIEWED';
    if (roll < 0.86) return 'ESCALATED';
    return 'RECAPTURE_REQUESTED';
  }
  return 'REVIEWED';
}

const SEED_NOTES: Record<CaseStatus, string[]> = {
  ESCALATED: [
    'Referred to secondary inspection. Physical document examination requested.',
    'Escalated for supervisor review — evidence is not conclusive from the capture alone.',
  ],
  REVIEWED: [
    'Evidence reviewed against the physical document. No further action taken.',
    'Signals reconciled with the traveller during interview. Standard processing applied.',
  ],
  RECAPTURE_REQUESTED: [
    'Capture quality insufficient for a reliable comparison. Re-capture requested.',
  ],
  AWAITING_REVIEW: [],
  DRAFT: [],
  PROCESSING: [],
  FAILED: [],
};

function seedReview(
  status: CaseStatus,
  createdAt: Date,
  officer: { name: string; role: string },
  rng: () => number,
): CaseReview {
  const templates = SEED_NOTES[status] ?? [];
  if (templates.length === 0) return { notes: [] };

  const reviewedAt = new Date(createdAt.getTime() + rngInt(rng, 3, 52) * 60_000);
  const outcome: Exclude<ReviewAction, 'ADD_NOTE'> =
    status === 'ESCALATED'
      ? 'ESCALATE'
      : status === 'RECAPTURE_REQUESTED'
        ? 'REQUEST_RECAPTURE'
        : 'MARK_REVIEWED';

  const note: CaseNote = {
    id: `note-${hashString(`${createdAt.toISOString()}:${status}`)}`,
    author: officer.name,
    authorRole: officer.role,
    body: rngPick(rng, templates),
    createdAt: reviewedAt.toISOString(),
  };

  return {
    outcome,
    reviewedBy: officer.name,
    reviewedAt: reviewedAt.toISOString(),
    notes: [note],
  };
}

function seedAuditForCase(
  result: ScreeningResult,
  status: CaseStatus,
  officer: { name: string; role: string },
  review: CaseReview,
): AuditLogEntry[] {
  const actor = { name: officer.name, role: officer.role };
  const start = new Date(result.createdAt).getTime();
  const entries: AuditLogEntry[] = [];

  const push = (action: AuditAction, offsetMs: number, detail?: string) => {
    entries.push({
      id: `audit-${hashString(`${result.caseId}:${action}:${offsetMs}`)}`,
      timestamp: new Date(start + offsetMs).toISOString(),
      actor,
      action,
      caseId: result.caseId,
      detail,
      versions: result.versions,
    });
  };

  push('DOCUMENT_UPLOADED', -18_000, `${result.document.type} · ${result.document.documentNumber}`);
  push('FACE_CAPTURED', -6_000, `liveness=${result.liveness.challenge}`);
  push('SCREENING_STARTED', 0);

  const failedStage = result.stages.find((s) => s.status === 'FAILED');
  if (failedStage) {
    push('SCREENING_FAILED', 900, `stage=${failedStage.key} · ${failedStage.message ?? 'no response'}`);
  }

  push(
    'SCREENING_COMPLETED',
    result.processingTimeMs ?? 3_000,
    `risk=${result.risk.level} (${result.risk.score})${result.risk.partial ? ' · partial analysis' : ''}`,
  );

  if (review.reviewedAt) {
    const offset = new Date(review.reviewedAt).getTime() - start;
    push('REPORT_VIEWED', Math.max(offset - 90_000, (result.processingTimeMs ?? 3_000) + 1_000));
    if (status === 'ESCALATED') push('CASE_ESCALATED', offset, `risk=${result.risk.level}`);
    else if (status === 'RECAPTURE_REQUESTED') push('RECAPTURE_REQUESTED', offset);
    else push('CASE_REVIEWED', offset, `outcome=${review.outcome}`);

    if (review.notes.length > 0) push('CASE_NOTE_ADDED', offset + 4_000);
  }

  return entries;
}

/* -------------------------------------------------------------------------- */
/* Summary projection                                                         */
/* -------------------------------------------------------------------------- */

function toSummary(
  result: ScreeningResult,
  overrides: { status?: CaseStatus; station?: string } = {},
): CaseSummary {
  return {
    caseId: result.caseId,
    createdAt: result.createdAt,
    documentType: result.document.type,
    holderName: result.document.holderName,
    documentNumber: result.document.documentNumber,
    riskScore: result.risk.score,
    riskLevel: result.risk.level,
    status: overrides.status ?? result.status,
    officerName: result.createdBy.name,
    station: overrides.station,
    processingTimeMs: result.processingTimeMs,
    partial: result.risk.partial,
  };
}

/* -------------------------------------------------------------------------- */
/* Case reads                                                                 */
/* -------------------------------------------------------------------------- */

export function listCaseRecords(): CaseRecord[] {
  return getStore().cases;
}

export function findCaseRecord(caseId: string): CaseRecord | undefined {
  return getStore().cases.find((c) => c.summary.caseId === caseId);
}

/** Rebuilds the full result for a stored case, then overlays live review state. */
export function getScreeningResult(caseId: string): ScreeningResult | undefined {
  const record = findCaseRecord(caseId);
  if (!record) return undefined;

  const result = buildScreeningResult({
    scenario: record.scenario,
    caseId: record.summary.caseId,
    documentType: record.summary.documentType,
    seed: record.seed,
    createdAt: new Date(record.summary.createdAt),
    createdBy: record.createdBy,
    documentImageUrl: record.documentImageUrl,
    liveFaceImageUrl: record.liveFaceImageUrl,
  });

  return {
    ...result,
    status: record.summary.status,
    review: record.review,
  };
}

export function queryCases(query: CaseQuery = {}): Paginated<CaseSummary> {
  const {
    search,
    riskLevel = 'ALL',
    status = 'ALL',
    documentType = 'ALL',
    from,
    to,
    page = 1,
    pageSize = 15,
    sortBy = 'createdAt',
    sortDir = 'desc',
  } = query;

  const needle = search?.trim().toLowerCase();
  const fromMs = from ? new Date(from).getTime() : undefined;
  // `to` is a date, so include the whole day.
  const toMs = to ? new Date(to).getTime() + 86_399_999 : undefined;

  let items = listCaseRecords().map((c) => c.summary);

  if (needle) {
    items = items.filter(
      (c) =>
        c.caseId.toLowerCase().includes(needle) ||
        c.holderName?.toLowerCase().includes(needle) ||
        c.documentNumber?.toLowerCase().includes(needle) ||
        c.officerName.toLowerCase().includes(needle),
    );
  }
  if (riskLevel !== 'ALL') items = items.filter((c) => c.riskLevel === riskLevel);
  if (status !== 'ALL') items = items.filter((c) => c.status === status);
  if (documentType !== 'ALL') items = items.filter((c) => c.documentType === documentType);
  if (fromMs !== undefined) items = items.filter((c) => new Date(c.createdAt).getTime() >= fromMs);
  if (toMs !== undefined) items = items.filter((c) => new Date(c.createdAt).getTime() <= toMs);

  const dir = sortDir === 'asc' ? 1 : -1;
  items = [...items].sort((a, b) => {
    if (sortBy === 'riskScore') return (a.riskScore - b.riskScore) * dir;
    if (sortBy === 'caseId') return a.caseId.localeCompare(b.caseId) * dir;
    return a.createdAt.localeCompare(b.createdAt) * dir;
  });

  const total = items.length;
  const safePage = Math.max(1, page);
  const startIndex = (safePage - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    total,
    page: safePage,
    pageSize,
  };
}

/* -------------------------------------------------------------------------- */
/* Case writes                                                               */
/* -------------------------------------------------------------------------- */

export function nextCaseId(at: Date = new Date()): string {
  const current = getStore();
  return formatCaseId(at, current.sequence + 1);
}

export interface CreateCaseInput {
  scenario: DemoScenario;
  documentType: DocumentType;
  createdBy: { id: string; name: string; role: string };
  station?: string;
  documentImageUrl?: string;
  liveFaceImageUrl?: string;
  createdAt?: Date;
}

/** Runs a screening and files the resulting case. */
export function createCase(input: CreateCaseInput): ScreeningResult {
  const current = getStore();
  const createdAt = input.createdAt ?? new Date();
  const caseId = formatCaseId(createdAt, current.sequence + 1);
  const seed = `${caseId}:${input.scenario}`;

  const result = buildScreeningResult({
    scenario: input.scenario,
    caseId,
    documentType: input.documentType,
    seed,
    createdAt,
    createdBy: input.createdBy,
    documentImageUrl: input.documentImageUrl,
    liveFaceImageUrl: input.liveFaceImageUrl,
  });

  const record: CaseRecord = {
    summary: toSummary(result, { station: input.station }),
    scenario: input.scenario,
    seed,
    createdBy: input.createdBy,
    reasonLabels: result.risk.reasons.map((r) => r.label),
    review: { notes: [] },
    // Blob/object URLs are session-scoped; keeping them out of the record means
    // a reloaded case falls back to the generated specimen instead of a dead src.
    documentImageUrl: isPersistableUrl(input.documentImageUrl) ? input.documentImageUrl : undefined,
    liveFaceImageUrl: isPersistableUrl(input.liveFaceImageUrl) ? input.liveFaceImageUrl : undefined,
  };

  current.cases.unshift(record);
  current.sequence += 1;

  recordAudit({
    action: 'DOCUMENT_UPLOADED',
    actor: { name: input.createdBy.name, role: input.createdBy.role },
    caseId,
    detail: `${input.documentType} · ${result.document.documentNumber}`,
    at: new Date(createdAt.getTime() - 12_000),
  });
  recordAudit({
    action: 'SCREENING_STARTED',
    actor: { name: input.createdBy.name, role: input.createdBy.role },
    caseId,
    at: createdAt,
  });

  const failedStage = result.stages.find((s) => s.status === 'FAILED');
  if (failedStage) {
    recordAudit({
      action: 'SCREENING_FAILED',
      actor: { name: input.createdBy.name, role: input.createdBy.role },
      caseId,
      detail: `stage=${failedStage.key} · ${failedStage.message ?? 'no response'}`,
      at: new Date(createdAt.getTime() + 900),
    });
  }

  recordAudit({
    action: 'SCREENING_COMPLETED',
    actor: { name: input.createdBy.name, role: input.createdBy.role },
    caseId,
    detail: `risk=${result.risk.level} (${result.risk.score})${result.risk.partial ? ' · partial analysis' : ''}`,
    versions: result.versions,
    at: new Date(createdAt.getTime() + (result.processingTimeMs ?? 3_000)),
  });

  persist();
  return { ...result, review: record.review };
}

function isPersistableUrl(url?: string): boolean {
  if (!url) return false;
  return !url.startsWith('blob:');
}

export interface ApplyReviewInput {
  caseId: string;
  action: ReviewAction;
  note?: string;
  reason?: string;
  actor: { name: string; role: string };
  at?: Date;
}

/** Applies an officer action and mirrors it into the audit trail. */
export function applyReview(input: ApplyReviewInput): CaseRecord | undefined {
  const record = findCaseRecord(input.caseId);
  if (!record) return undefined;

  const at = input.at ?? new Date();
  const body = input.note?.trim() || input.reason?.trim();

  if (body) {
    record.review.notes = [
      ...record.review.notes,
      {
        id: `note-${hashString(`${input.caseId}:${at.toISOString()}:${body}`)}`,
        author: input.actor.name,
        authorRole: input.actor.role,
        body,
        createdAt: at.toISOString(),
      },
    ];
  }

  if (input.action !== 'ADD_NOTE') {
    record.review.outcome = input.action;
    record.review.reviewedBy = input.actor.name;
    record.review.reviewedAt = at.toISOString();
    record.summary.status =
      input.action === 'ESCALATE'
        ? 'ESCALATED'
        : input.action === 'REQUEST_RECAPTURE'
          ? 'RECAPTURE_REQUESTED'
          : 'REVIEWED';
  }

  const action: AuditAction =
    input.action === 'ESCALATE'
      ? 'CASE_ESCALATED'
      : input.action === 'REQUEST_RECAPTURE'
        ? 'RECAPTURE_REQUESTED'
        : input.action === 'ADD_NOTE'
          ? 'CASE_NOTE_ADDED'
          : 'CASE_REVIEWED';

  recordAudit({
    action,
    actor: input.actor,
    caseId: input.caseId,
    detail: input.reason ? `reason=${input.reason}` : undefined,
    at,
  });

  persist();
  return record;
}

/* -------------------------------------------------------------------------- */
/* Audit trail                                                                */
/* -------------------------------------------------------------------------- */

export interface RecordAuditInput {
  action: AuditAction;
  actor: { name: string; role: string };
  caseId?: string;
  detail?: string;
  versions?: Record<string, string>;
  at?: Date;
}

export function recordAudit(input: RecordAuditInput): AuditLogEntry {
  const current = getStore();
  const at = input.at ?? new Date();

  const entry: AuditLogEntry = {
    id: `audit-${hashString(`${input.action}:${input.caseId ?? '-'}:${at.toISOString()}:${current.audit.length}`)}`,
    timestamp: at.toISOString(),
    actor: input.actor,
    action: input.action,
    caseId: input.caseId,
    detail: input.detail,
    versions: input.versions,
    // A fixed loopback address: the browser cannot know its own address, and
    // inventing one would put fabricated data in an audit record.
    ipAddress: '127.0.0.1',
  };

  current.audit.unshift(entry);
  persist();
  return entry;
}

export function queryAudit(query: AuditQuery = {}): Paginated<AuditLogEntry> {
  const { search, action = 'ALL', caseId, from, to, page = 1, pageSize = 25 } = query;

  const needle = search?.trim().toLowerCase();
  const fromMs = from ? new Date(from).getTime() : undefined;
  const toMs = to ? new Date(to).getTime() + 86_399_999 : undefined;

  let items = getStore().audit;

  if (action !== 'ALL') items = items.filter((e) => e.action === action);
  if (caseId) items = items.filter((e) => e.caseId === caseId);
  if (needle) {
    items = items.filter(
      (e) =>
        e.actor.name.toLowerCase().includes(needle) ||
        e.caseId?.toLowerCase().includes(needle) ||
        e.detail?.toLowerCase().includes(needle) ||
        e.action.toLowerCase().includes(needle),
    );
  }
  if (fromMs !== undefined) items = items.filter((e) => new Date(e.timestamp).getTime() >= fromMs);
  if (toMs !== undefined) items = items.filter((e) => new Date(e.timestamp).getTime() <= toMs);

  const sorted = [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const safePage = Math.max(1, page);
  const startIndex = (safePage - 1) * pageSize;

  return {
    items: sorted.slice(startIndex, startIndex + pageSize),
    total: sorted.length,
    page: safePage,
    pageSize,
  };
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

function inWindow(summary: CaseSummary, startMs: number, endMs: number): boolean {
  const t = new Date(summary.createdAt).getTime();
  return t >= startMs && t <= endMs;
}

function percentChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current === 0 ? 0 : undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[index]);
}

export function getDashboardStatistics(
  range: AnalyticsRange = '7d',
  now: number = Date.now(),
): DashboardStatistics {
  const days = RANGE_DAYS[range];
  const windowMs = days * 86_400_000;
  const startMs = now - windowMs;
  const previousStartMs = startMs - windowMs;

  const all = listCaseRecords().map((c) => c.summary);
  const current = all.filter((c) => inWindow(c, startMs, now));
  const previous = all.filter((c) => inWindow(c, previousStartMs, startMs - 1));

  const byLevel = (items: CaseSummary[], level: RiskLevel) =>
    items.filter((c) => c.riskLevel === level).length;

  const processingTimes = current
    .map((c) => c.processingTimeMs)
    .filter((v): v is number => typeof v === 'number');
  const previousTimes = previous
    .map((c) => c.processingTimeMs)
    .filter((v): v is number => typeof v === 'number');

  const total = current.length;
  const low = byLevel(current, 'LOW');
  const medium = byLevel(current, 'MEDIUM');
  const high = byLevel(current, 'HIGH');

  const riskDistribution: RiskDistributionSlice[] = (
    [
      ['LOW', low],
      ['MEDIUM', medium],
      ['HIGH', high],
    ] as [RiskLevel, number][]
  ).map(([level, count]) => ({
    level,
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  }));

  return {
    totalScreened: total,
    lowRisk: low,
    mediumRisk: medium,
    highRisk: high,
    averageProcessingTimeMs: mean(processingTimes),
    deltas: {
      totalScreened: percentChange(total, previous.length),
      lowRisk: percentChange(low, byLevel(previous, 'LOW')),
      mediumRisk: percentChange(medium, byLevel(previous, 'MEDIUM')),
      highRisk: percentChange(high, byLevel(previous, 'HIGH')),
      averageProcessingTimeMs: percentChange(mean(processingTimes), mean(previousTimes)),
    },
    pendingReview: current.filter((c) => c.status === 'AWAITING_REVIEW').length,
    escalated: current.filter((c) => c.status === 'ESCALATED').length,
    partialAnalyses: current.filter((c) => c.partial).length,
    recentHighRiskCases: [...current]
      .filter((c) => c.riskLevel === 'HIGH' || c.riskLevel === 'MEDIUM')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6),
    trend: buildTrend(current, startMs, now, days),
    riskDistribution,
    windowLabel: RANGE_LABELS[range],
  };
}

function buildTrend(
  items: CaseSummary[],
  startMs: number,
  endMs: number,
  days: number,
): TrendPoint[] {
  // A 24-hour window is bucketed hourly; anything longer, daily.
  const bucketMs = days <= 1 ? 3_600_000 : 86_400_000;
  const bucketCount = days <= 1 ? 24 : days;
  const buckets: TrendPoint[] = [];

  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const bucketEnd = endMs - i * bucketMs;
    const bucketStart = bucketEnd - bucketMs;
    const inBucket = items.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return t > bucketStart && t <= bucketEnd;
    });
    buckets.push({
      date: new Date(bucketEnd).toISOString(),
      total: inBucket.length,
      low: inBucket.filter((c) => c.riskLevel === 'LOW').length,
      medium: inBucket.filter((c) => c.riskLevel === 'MEDIUM').length,
      high: inBucket.filter((c) => c.riskLevel === 'HIGH').length,
    });
  }

  void startMs;
  return buckets;
}

export function getAnalyticsSummary(
  range: AnalyticsRange = '30d',
  now: number = Date.now(),
): AnalyticsSummary {
  const base = getDashboardStatistics(range, now);
  const days = RANGE_DAYS[range];
  const startMs = now - days * 86_400_000;

  const records = listCaseRecords().filter((c) => inWindow(c.summary, startMs, now));

  /* Processing-time series, bucketed the same way as the trend chart. */
  const bucketMs = days <= 1 ? 3_600_000 : 86_400_000;
  const bucketCount = days <= 1 ? 24 : days;
  const processingTimeSeries: ProcessingTimePoint[] = [];

  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const bucketEnd = now - i * bucketMs;
    const bucketStart = bucketEnd - bucketMs;
    const times = records
      .filter((c) => {
        const t = new Date(c.summary.createdAt).getTime();
        return t > bucketStart && t <= bucketEnd;
      })
      .map((c) => c.summary.processingTimeMs)
      .filter((v): v is number => typeof v === 'number');

    processingTimeSeries.push({
      date: new Date(bucketEnd).toISOString(),
      averageMs: mean(times),
      p95Ms: percentile(times, 95),
    });
  }

  /* Most frequent reasons across flagged cases only — "no adverse evidence"
     would otherwise dominate the list and tell an officer nothing. */
  const flagged = records.filter((c) => c.summary.riskLevel !== 'LOW');
  const counts = new Map<string, number>();
  for (const record of flagged) {
    for (const label of record.reasonLabels) {
      if (label.startsWith('No adverse evidence')) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  const topRiskReasons: TopRiskReason[] = [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      share: flagged.length > 0 ? Math.round((count / flagged.length) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);

  const docCounts = new Map<string, number>();
  for (const record of records) {
    docCounts.set(
      record.summary.documentType,
      (docCounts.get(record.summary.documentType) ?? 0) + 1,
    );
  }

  const outcomeCounts = new Map<string, number>();
  for (const record of records) {
    const key = record.review.outcome ?? 'PENDING';
    outcomeCounts.set(key, (outcomeCounts.get(key) ?? 0) + 1);
  }

  return {
    ...base,
    processingTimeSeries,
    topRiskReasons,
    casesByDocumentType: [...docCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    reviewOutcomes: [...outcomeCounts.entries()]
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((a, b) => b.count - a.count),
  };
}
