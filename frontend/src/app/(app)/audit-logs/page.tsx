'use client';

import * as React from 'react';
import { useState } from 'react';
import { ScrollText, RefreshCw, Download, ShieldCheck } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { AuditTable } from '@/components/audit';
import { useAuditLogs } from '@/lib/hooks/useAudit';
import type { AuditQuery } from '@/lib/types/audit';

export default function AuditLogsPage() {
  const [query, setQuery] = useState<AuditQuery>({
    search: '',
    action: 'ALL',
    page: 1,
    pageSize: 25,
  });

  const { data, isLoading, refetch } = useAuditLogs(query);

  return (
    <PageContainer
      title="Governance & Audit Trail"
      description="Tamper-evident chronological record of operator sessions, AI model executions, and disposition decisions"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-foreground"
            title="Refresh logs"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      }
    >
      <AuditTable
        data={data}
        query={query}
        onQueryChange={setQuery}
        isLoading={isLoading}
      />
    </PageContainer>
  );
}
