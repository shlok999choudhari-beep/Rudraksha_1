/**
 * Role-based UI gating.
 *
 * This is a usability layer, not a security layer. Hiding a button stops an
 * officer being shown an action the API will reject; it does not stop anyone
 * calling that API. Every permission checked here must also be enforced
 * server-side — see the note at the top of `lib/types/user.ts`.
 */

import { ROLE_PERMISSIONS, type Permission, type Role } from '@/lib/types/user';

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: Role | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export function canAll(role: Role | undefined, permissions: Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

/**
 * Whether a role may see a case it did not create.
 * An Officer sees their own work; Supervisors, Auditors and Admins see the queue.
 */
export function canViewAllCases(role: Role | undefined): boolean {
  return can(role, 'cases:view_all');
}

/** Actions available on a result page, in the order they should be offered. */
export interface ActionAvailability {
  markReviewed: boolean;
  escalate: boolean;
  requestRecapture: boolean;
  addNote: boolean;
  startScreening: boolean;
}

export function actionAvailability(role: Role | undefined): ActionAvailability {
  return {
    markReviewed: can(role, 'screening:review'),
    escalate: can(role, 'screening:escalate'),
    requestRecapture: can(role, 'screening:request_recapture'),
    addNote: can(role, 'cases:note'),
    startScreening: can(role, 'screening:create'),
  };
}

/**
 * Explains why an action is unavailable, for the disabled-state tooltip.
 * A greyed-out button with no reason is worse than no button at all.
 */
export function permissionDeniedReason(role: Role | undefined, permission: Permission): string {
  if (!role) return 'Sign in to continue.';
  if (can(role, permission)) return '';
  return `Not available to the ${role.charAt(0) + role.slice(1).toLowerCase()} role.`;
}
