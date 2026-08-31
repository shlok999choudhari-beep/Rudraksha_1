'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CaseQuery } from '@/lib/types/case';
import { addCaseNote, getCase, getCaseNeighbours, listCases } from '@/lib/api/cases';
import { listCaseTimeline } from '@/lib/api/audit';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { queryKeys } from './queryKeys';

export function useCases(query: CaseQuery = {}) {
  return useQuery({
    queryKey: queryKeys.cases.list(query),
    queryFn: () => listCases(query),
    // Keeps the previous page on screen while the next one loads, so the table
    // does not collapse to a skeleton on every keystroke or page change.
    placeholderData: (previous) => previous,
  });
}

export function useCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cases.detail(caseId ?? 'none'),
    queryFn: () => getCase(caseId as string),
    enabled: Boolean(caseId),
  });
}

export function useCaseTimeline(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cases.timeline(caseId ?? 'none'),
    queryFn: () => listCaseTimeline(caseId as string),
    enabled: Boolean(caseId),
  });
}

export function useCaseNeighbours(caseId: string | undefined, query: CaseQuery = {}) {
  return useQuery({
    queryKey: queryKeys.cases.neighbours(caseId ?? 'none', query),
    queryFn: () => getCaseNeighbours(caseId as string, query),
    enabled: Boolean(caseId),
  });
}

export function useAddCaseNote(caseId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();

  return useMutation({
    mutationFn: (body: string) =>
      addCaseNote({
        caseId,
        body,
        actor: { name: user?.name ?? 'Unknown', role: user?.role ?? 'OFFICER' },
      }),
    onSuccess: () => {
      toast.push({ tone: 'success', title: 'Note added to the case record.' });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.timeline(caseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
    onError: (error: Error) => {
      toast.push({ tone: 'danger', title: 'Could not add the note.', description: error.message });
    },
  });
}
