'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from './AuthProvider';
import { QueryProvider } from './QueryProvider';

/**
 * Client-side provider stack, mounted once in the root layout.
 * Order matters: Auth calls the API client, Query wraps every data hook, and
 * Toast has to sit outermost so an auth error can raise a notification.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <QueryProvider>
        <AuthProvider>{children}</AuthProvider>
      </QueryProvider>
    </ToastProvider>
  );
}

export { useAuth, usePermission } from './AuthProvider';
