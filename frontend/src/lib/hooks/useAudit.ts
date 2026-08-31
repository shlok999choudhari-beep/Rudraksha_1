'use client';

import { useQuery } from '@tanstack/react-query';
import type { AuditQuery } from '@/lib/types/audit';
import { listAuditLogs } from '@/lib/api/audit';
import { queryKeys } from './queryKeys';

export function useAuditLogs(query: AuditQuery = {}) {
  return useQuery({
    queryKey: queryKeys.audit.list(query),
    queryFn: () => listAuditLogs(query),
    placeholderData: (previous) => previous,
  });
}
