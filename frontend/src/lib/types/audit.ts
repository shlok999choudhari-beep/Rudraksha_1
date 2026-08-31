/** Audit trail contracts. */

export const AUDIT_ACTIONS = [
  'USER_LOGIN',
  'USER_LOGOUT',
  'SCREENING_STARTED',
  'SCREENING_COMPLETED',
  'SCREENING_FAILED',
  'DOCUMENT_UPLOADED',
  'FACE_CAPTURED',
  'REPORT_VIEWED',
  'CASE_REVIEWED',
  'CASE_ESCALATED',
  'CASE_NOTE_ADDED',
  'RECAPTURE_REQUESTED',
  'CONFIG_UPDATED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_LOGIN: 'User Signed In',
  USER_LOGOUT: 'User Signed Out',
  SCREENING_STARTED: 'Screening Started',
  SCREENING_COMPLETED: 'Screening Completed',
  SCREENING_FAILED: 'Screening Failed',
  DOCUMENT_UPLOADED: 'Document Uploaded',
  FACE_CAPTURED: 'Live Face Captured',
  REPORT_VIEWED: 'Report Viewed',
  CASE_REVIEWED: 'Case Reviewed',
  CASE_ESCALATED: 'Case Escalated',
  CASE_NOTE_ADDED: 'Note Added',
  RECAPTURE_REQUESTED: 'Re-capture Requested',
  CONFIG_UPDATED: 'Configuration Updated',
};

/** Actions that change a case's disposition are highlighted in the table. */
export const AUDIT_ACTION_SEVERITY: Record<AuditAction, 'INFO' | 'NOTABLE' | 'CRITICAL'> = {
  USER_LOGIN: 'INFO',
  USER_LOGOUT: 'INFO',
  SCREENING_STARTED: 'INFO',
  SCREENING_COMPLETED: 'INFO',
  SCREENING_FAILED: 'CRITICAL',
  DOCUMENT_UPLOADED: 'INFO',
  FACE_CAPTURED: 'INFO',
  REPORT_VIEWED: 'INFO',
  CASE_REVIEWED: 'NOTABLE',
  CASE_ESCALATED: 'CRITICAL',
  CASE_NOTE_ADDED: 'NOTABLE',
  RECAPTURE_REQUESTED: 'NOTABLE',
  CONFIG_UPDATED: 'CRITICAL',
};

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: { name: string; role: string };
  action: AuditAction;
  caseId?: string;
  /** Free-form supporting context, e.g. `risk=HIGH (82)`. */
  detail?: string;
  /** Model / ruleset versions in force when the action was recorded. */
  versions?: Record<string, string>;
  ipAddress?: string;
}

export interface AuditQuery {
  search?: string;
  action?: AuditAction | 'ALL';
  caseId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
