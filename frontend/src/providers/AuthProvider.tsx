'use client';

/**
 * Session context.
 *
 * Holds the current user, exposes a role-aware `can()` for the UI, and redirects
 * on sign-out or token rejection. The token itself lives in the API client — this
 * provider never reads or interprets it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthSession, LoginCredentials, Permission, Role, User } from '@/lib/types/user';
import { login as loginRequest, logout as logoutRequest, restoreSession } from '@/lib/api/auth';
import { onUnauthorized } from '@/lib/api/client';
import { can as checkPermission } from '@/lib/utils/permissions';

interface AuthContextValue {
  user: User | null;
  role: Role | undefined;
  /** False until the stored session has been checked, so guards do not flash. */
  ready: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: (credentials: LoginCredentials) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  can: (permission: Permission) => boolean;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore on mount only. Running this on the server would read a token that
  // does not exist there and briefly render the app as signed out.
  useEffect(() => {
    const session = restoreSession();
    setUser(session?.user ?? null);
    setReady(true);
  }, []);

  const signOut = useCallback(async () => {
    const current = user;
    setUser(null);
    await logoutRequest(current ?? undefined);
    router.replace('/login');
  }, [router, user]);

  // If the API rejects the token mid-session, drop the user rather than leaving
  // a dashboard on screen that can no longer load anything.
  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      setError('Your session has expired. Sign in again to continue.');
      if (pathname !== '/login') router.replace('/login');
    });
    return () => onUnauthorized(null);
  }, [pathname, router]);

  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      setSigningIn(true);
      setError(null);
      try {
        const session = await loginRequest(credentials);
        setUser(session.user);
        return session;
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'Sign-in failed. Try again.';
        setError(message);
        throw caught;
      } finally {
        setSigningIn(false);
      }
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role,
      ready,
      signingIn,
      error,
      signIn,
      signOut,
      can: (permission: Permission) => checkPermission(user?.role, permission),
      clearError: () => setError(null),
    }),
    [user, ready, signingIn, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

/** Convenience for the common `can(...)` call inside a component. */
export function usePermission(permission: Permission): boolean {
  return useAuth().can(permission);
}
