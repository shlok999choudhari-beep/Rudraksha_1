'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';

/**
 * TanStack Query configuration.
 *
 * The retry policy is deliberate: transient transport failures are worth one
 * retry, but a 401/403/404 or a validation rejection is not, and an unimplemented
 * analysis service is not going to appear on the second attempt. Retrying those
 * only delays the honest error the officer needs to see.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) return error.retryable && failureCount < 2;
          return failureCount < 1;
        },
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
      },
      mutations: {
        // Officer actions are recorded decisions. Replaying one automatically
        // could double-file an escalation, so a failure surfaces instead.
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Held in state so React does not build a fresh client on every render.
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
