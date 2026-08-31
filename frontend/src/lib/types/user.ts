/**
 * Roles and permissions.
 *
 * The frontend never trusts these for security — the backend must re-check every
 * action. They exist so the console does not show an officer a button that the
 * API is going to reject.
 */

export const ROLES = ['OFFICER', 'SUPERVISOR', 'AUDITOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // Screening
  'screening:create',
  'screening:view',
  'screening:review',
  'screening:escalate',
  'screening:request_recapture',
  // Cases
  'cases:view_own',
  'cases:view_all',
  'cases:note',
  // Reporting
  'analytics:view',
  'audit:view',
  // Administration
  'users:manage',
  'config:manage',
  'models:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OFFICER: [
    'screening:create',
    'screening:view',
    'screening:review',
    'screening:request_recapture',
    'cases:view_own',
    'cases:note',
  ],
  SUPERVISOR: [
    'screening:create',
    'screening:view',
    'screening:review',
    'screening:escalate',
    'screening:request_recapture',
    'cases:view_own',
    'cases:view_all',
    'cases:note',
    'analytics:view',
  ],
  AUDITOR: ['screening:view', 'cases:view_all', 'audit:view'],
  ADMIN: [
    'screening:view',
    'cases:view_all',
    'analytics:view',
    'audit:view',
    'users:manage',
    'config:manage',
    'models:manage',
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  OFFICER: 'Officer',
  SUPERVISOR: 'Supervisor',
  AUDITOR: 'Auditor',
  ADMIN: 'Administrator',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OFFICER: 'Runs screenings and reviews assigned cases.',
  SUPERVISOR: 'Reviews and escalates high-risk cases, views analytics.',
  AUDITOR: 'Read-only access to cases and the audit trail.',
  ADMIN: 'Manages users, rules, thresholds and model versions.',
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Posting / checkpoint the officer is assigned to, shown in the header. */
  station?: string;
  badgeId?: string;
  avatarInitials: string;
  lastLoginAt?: string;
}

export interface AuthSession {
  user: User;
  /** Opaque bearer token. Never decoded or inspected by the frontend. */
  token: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
