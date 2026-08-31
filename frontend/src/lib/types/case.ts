/** Case list / history contracts. */

import type { DocumentType } from './document';
import type { RiskLevel } from './risk';
import type { CaseStatus } from './screening';

/** The row shape used by the case-history and recent-cases tables. */
export interface CaseSummary {
  caseId: string;
  createdAt: string;
  documentType: DocumentType;
  holderName?: string;
  documentNumber?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  status: CaseStatus;
  officerName: string;
  station?: string;
  processingTimeMs?: number;
  /** True when at least one analyser did not complete. */
  partial?: boolean;
}

export interface CaseQuery {
  search?: string;
  riskLevel?: RiskLevel | 'ALL';
  status?: CaseStatus | 'ALL';
  documentType?: DocumentType | 'ALL';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'riskScore' | 'caseId';
  sortDir?: 'asc' | 'desc';
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
