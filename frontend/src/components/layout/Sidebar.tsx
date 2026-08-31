'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { canAny } from '@/lib/utils/permissions';
import { ROLE_LABELS } from '@/lib/types/user';
import { useAuth } from '@/providers/AuthProvider';
import { DEMO_MODE } from '@/lib/api/client';
import { NAV_SECTIONS, isNavActive } from './navigation';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAny(user?.role, item.permissions)),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        'relative z-20 flex shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      {/* A faint vertical border line. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-border" />

      <div
        className={cn(
          'flex h-16 items-center gap-3 border-b border-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-peach-200/90 bg-gradient-to-br from-peach-100 to-peach-50 text-peach-600 shadow-sm">
          <ShieldCheck className="size-5 text-peach-600" aria-hidden />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">
              VeriGuard <span className="text-2xs font-mono font-normal text-peach-600 uppercase ml-1 px-1.5 py-0.5 rounded bg-peach-100/80 border border-peach-200/60">AI</span>
            </p>
            <p className="truncate font-mono text-2xs uppercase tracking-[0.16em] text-muted-foreground">
              Officer Console
            </p>
          </div>
        )}
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-2.5 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-5 last:mb-0">
            {!collapsed && <p className="section-label mb-2 px-2.5 text-muted-foreground/80">{section.label}</p>}
            {collapsed && <div className="mx-3 mb-2 h-px bg-border" />}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isNavActive(item, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all',
                        collapsed && 'justify-center px-0',
                        active
                          ? 'bg-peach-100/70 text-peach-950 font-semibold shadow-[0_1px_3px_0_rgba(245,123,74,0.06)]'
                          : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-peach-500" />
                      )}
                      <Icon
                        className={cn(
                          'size-[1.05rem] shrink-0 transition-colors',
                          active
                            ? 'text-peach-600'
                            : 'text-muted-foreground group-hover:text-foreground',
                        )}
                        aria-hidden
                      />
                      {!collapsed && (
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block truncate leading-tight',
                              active && 'font-medium text-foreground',
                            )}
                          >
                            {item.label}
                          </span>
                          <span className="block truncate text-2xs leading-tight text-muted-foreground/70">
                            {item.hint}
                          </span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2.5">
        {!collapsed && user && (
          <div className="mb-2.5 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
            <p className="font-mono text-2xs uppercase tracking-[0.16em] text-muted-foreground">
              Signed in as
            </p>
            <p className="mt-1 truncate text-xs font-medium text-foreground">{user.name}</p>
            <p className="truncate text-2xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>
        )}

        {!collapsed && DEMO_MODE && (
          <p className="mb-2.5 rounded-md border border-risk-medium/25 bg-risk-medium/10 px-2.5 py-1.5 text-2xs leading-snug text-risk-medium">
            Demo data mode — results are generated locally for demonstration.
          </p>
        )}

        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" aria-hidden />
          ) : (
            <>
              <ChevronsLeft className="size-4" aria-hidden />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
