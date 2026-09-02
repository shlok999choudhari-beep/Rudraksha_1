import {
  ClipboardList,
  FileDown,
  FileSearch,
  LayoutDashboard,
  ScanLine,
  ScrollText,
  Settings,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Permission } from '@/lib/types/user';

export interface NavItem {
  href: string;
  label: string;
  /** Shown under the label when the sidebar is expanded. */
  hint: string;
  icon: LucideIcon;
  /** Any one of these permissions reveals the item. */
  permissions: Permission[];
  /** Matches child routes too, e.g. `/cases/VG-2026-0001`. */
  matchPrefix?: boolean;
  /** Draws attention on the primary action. */
  emphasis?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar structure.
 *
 * Grouped by what an officer is doing rather than by data model: running a check,
 * looking one up, or accounting for what the system did. Items the current role
 * cannot use are removed entirely — a console full of dead links teaches an
 * officer to ignore the navigation.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Screening',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        hint: 'Shift overview',
        icon: LayoutDashboard,
        permissions: ['screening:view'],
      },
      {
        href: '/screening/new',
        label: 'New Screening',
        hint: 'Start a document check',
        icon: ScanLine,
        permissions: ['screening:create'],
        emphasis: true,
      },
      {
        href: '/demo-docs',
        label: 'Demo Docs',
        hint: 'Download test specimens',
        icon: FileDown,
        permissions: ['screening:view'],
      },
      {
        href: '/screening',
        label: 'Review Queue',
        hint: 'Awaiting officer decision',
        icon: ClipboardList,
        permissions: ['screening:view'],
      },
    ],
  },
  {
    label: 'Records',
    items: [
      {
        href: '/cases',
        label: 'Case History',
        hint: 'Search past screenings',
        icon: FileSearch,
        permissions: ['cases:view_own', 'cases:view_all'],
        matchPrefix: true,
      },
      {
        href: '/analytics',
        label: 'Analytics',
        hint: 'Throughput and signals',
        icon: TrendingUp,
        permissions: ['analytics:view'],
      },
    ],
  },
  {
    label: 'Governance',
    items: [
      {
        href: '/audit-logs',
        label: 'Audit Trail',
        hint: 'Every recorded action',
        icon: ScrollText,
        permissions: ['audit:view'],
      },
      {
        href: '/settings',
        label: 'Settings',
        hint: 'Profile and thresholds',
        icon: Settings,
        // Every role has a profile; the system sections inside are gated separately.
        permissions: ['screening:view', 'audit:view'],
      },
    ],
  },
];

/** True when `pathname` should light up `item`. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (item.matchPrefix && pathname.startsWith(`${item.href}/`)) return true;
  // `/screening/new` and `/screening/VG-...` are distinct destinations, so the
  // queue entry must not claim every `/screening/*` route.
  if (item.href === '/screening') {
    return pathname.startsWith('/screening/') && pathname !== '/screening/new';
  }
  return false;
}

/** Human-readable labels for path segments, used by the breadcrumb trail. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  screening: 'Screening',
  new: 'New Screening',
  result: 'Result',
  cases: 'Case History',
  analytics: 'Analytics',
  'audit-logs': 'Audit Trail',
  settings: 'Settings',
};
