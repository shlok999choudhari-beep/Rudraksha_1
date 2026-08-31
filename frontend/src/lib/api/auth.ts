/**
 * Authentication.
 *
 * The frontend holds an opaque bearer token and a display profile. It never
 * decodes the token, never stores a password, and never receives a password
 * hash — role checks in `lib/auth/permissions.ts` exist to keep the UI honest
 * about what an officer can do, not to enforce anything. Enforcement is the
 * backend's job on every request.
 */

import type { AuthSession, LoginCredentials, Role, User } from '@/lib/types/user';
import { DEMO_PASSWORD, DEMO_USERS, findDemoUserByEmail, recordAudit } from '@/lib/mock/store';
import {
  ApiError,
  DEMO_LATENCY,
  DEMO_MODE,
  apiPost,
  camelize,
  clearAuthToken,
  delay,
  getAuthToken,
  setAuthToken,
} from './client';

const USER_STORAGE_KEY = 'veriguard.session.user';
const EXPIRY_STORAGE_KEY = 'veriguard.session.expires';

/** Demo sessions last a working shift; long enough that a demo never logs out. */
const DEMO_SESSION_MS = 8 * 60 * 60 * 1000;

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function persistProfile(session: AuthSession | null): void {
  if (!hasStorage()) return;
  try {
    if (session) {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
      window.localStorage.setItem(EXPIRY_STORAGE_KEY, session.expiresAt);
    } else {
      window.localStorage.removeItem(USER_STORAGE_KEY);
      window.localStorage.removeItem(EXPIRY_STORAGE_KEY);
    }
  } catch {
    // Non-fatal: the session simply will not survive a reload.
  }
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  if (DEMO_MODE) {
    await delay(DEMO_LATENCY.normal);

    const user = findDemoUserByEmail(credentials.email);
    // One generic message for both branches: the sign-in form must not reveal
    // which accounts exist.
    if (!user || credentials.password !== DEMO_PASSWORD) {
      throw new ApiError('UNAUTHORIZED', 'Incorrect email or password.', 401);
    }

    const now = Date.now();
    const session: AuthSession = {
      user: { ...user, lastLoginAt: new Date(now).toISOString() },
      // Opaque by construction — nothing in the frontend parses this.
      token: `demo.${user.id}.${now.toString(36)}`,
      expiresAt: new Date(now + DEMO_SESSION_MS).toISOString(),
    };

    setAuthToken(session.token);
    persistProfile(session);
    recordAudit({
      action: 'USER_LOGIN',
      actor: { name: session.user.name, role: session.user.role },
      detail: `role=${session.user.role}`,
    });

    return session;
  }

  const session = camelize<AuthSession>(
    await apiPost<unknown>('/api/auth/login', {
      email: credentials.email,
      password: credentials.password,
    }),
  );

  setAuthToken(session.token);
  persistProfile(session);
  return session;
}

export async function logout(user?: Pick<User, 'name' | 'role'>): Promise<void> {
  if (DEMO_MODE) {
    if (user) {
      recordAudit({ action: 'USER_LOGOUT', actor: { name: user.name, role: user.role } });
    }
    await delay(DEMO_LATENCY.fast);
  } else {
    try {
      await apiPost('/api/auth/logout');
    } catch {
      // A failed logout call must not trap the officer in a signed-in state.
    }
  }
  clearAuthToken();
  persistProfile(null);
}

/**
 * Rehydrates a session from storage on page load.
 * Returns `null` when there is no token, no profile, or the session has expired.
 */
export function restoreSession(): AuthSession | null {
  const token = getAuthToken();
  if (!token || !hasStorage()) return null;

  try {
    const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);
    const expiresAt = window.localStorage.getItem(EXPIRY_STORAGE_KEY);
    if (!rawUser || !expiresAt) return null;
    if (new Date(expiresAt).getTime() <= Date.now()) {
      clearAuthToken();
      persistProfile(null);
      return null;
    }
    return { user: JSON.parse(rawUser) as User, token, expiresAt };
  } catch {
    return null;
  }
}

/** `GET /api/auth/me` — used in live mode to confirm a restored token is still good. */
export async function fetchCurrentUser(): Promise<User> {
  if (DEMO_MODE) {
    const session = restoreSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'No active session.', 401);
    return session.user;
  }
  return camelize<User>(await apiPost<unknown>('/api/auth/me'));
}

/** Demo-only helper: the login screen offers one-click sign-in per role. */
export function demoAccountFor(role: Role): { email: string; password: string } | undefined {
  const user = DEMO_USERS.find((u) => u.role === role);
  return user ? { email: user.email, password: DEMO_PASSWORD } : undefined;
}

export { DEMO_PASSWORD, DEMO_USERS };
