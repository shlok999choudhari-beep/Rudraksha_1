'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { ScanLine, RefreshCw } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { CaseFilters, CaseTable } from '@/components/cases';
import { useCases } from '@/lib/hooks/useCases';
import type { CaseQuery } from '@/lib/types/case';

export default function CasesPage() {
  const [query, setQuery] = useState<CaseQuery>({
    search: '',
    riskLevel: 'ALL',
    status: 'ALL',
    documentType: 'ALL',
    page: 1,
    pageSize: 15,
    sortBy: 'createdAt',
    sortDir: 'desc',
  });

  const { data, isLoading, refetch } = useCases(query);

  const handleReset = () => {
    setQuery({
      search: '',
      riskLevel: 'ALL',
      status: 'ALL',
      documentType: 'ALL',
      page: 1,
      pageSize: 15,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
  };

  return (
    <PageContainer
      title="Case Archive & History"
      description="Search, filter, and inspect historical identity screening cases and review records"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-foreground"
            title="Refresh list"
          >
            <RefreshCw className="size-3.5" />
          </Button>

          <Link href="/screening/new">
            <Button variant="default" size="sm" className="shadow-sm shadow-primary/20">
              <ScanLine className="size-3.5 mr-1" />
              <span>New Screening</span>
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filters */}
        <CaseFilters
          query={query}
          onChange={setQuery}
          onReset={handleReset}
        />

        {/* Paginated Table */}
        <CaseTable
          data={data}
          isLoading={isLoading}
          onPageChange={(nextPage) => setQuery({ ...query, page: nextPage })}
        />
      </div>
    </PageContainer>
  );
}
