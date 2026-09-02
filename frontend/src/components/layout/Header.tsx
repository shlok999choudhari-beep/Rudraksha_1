'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, ScanLine, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LiveDot } from '@/components/ui/StatusIndicator';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils/cn';
import { formatTime } from '@/lib/utils/dates';
import { useServiceHealth } from '@/lib/hooks/useDashboard';
import { useAuth } from '@/providers/AuthProvider';
import { Breadcrumbs } from './Breadcrumbs';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  onToggleSidebar: () => void;
}

const CASE_ID_PATTERN = /^VG-\d{4}-\d{3,}$/i;

export function Header({ onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const { can } = useAuth();
  const { data: health } = useServiceHealth();
  const [query, setQuery] = useState('');

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    // A full case reference jumps straight to the record; anything else is a search.
    if (CASE_ID_PATTERN.test(value)) router.push(`/cases/${value.toUpperCase()}`);
    else router.push(`/cases?search=${encodeURIComponent(value)}`);
    setQuery('');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-peach-200/80 bg-surface/80 backdrop-blur-2xl shadow-[0_8px_30px_-4px_rgba(245,123,74,0.08),0_2px_6px_-1px_rgba(0,0,0,0.03)]">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-peach-100/70 hover:text-foreground lg:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="size-4" aria-hidden />
        </button>

        <Breadcrumbs />

        <form onSubmit={onSearch} className="ml-auto hidden w-full max-w-xs md:block">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-peach-600/70"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Case ID, holder or document no."
              aria-label="Search cases"
              className="h-9 w-full rounded-xl border border-peach-200/80 bg-surface/70 backdrop-blur-sm pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 shadow-xs focus:border-peach-400 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-peach-400/30 transition-all"
            />
          </div>
        </form>

        <ServiceStatus status={health?.status} className="ml-auto md:ml-0" />
        <ShiftClock />

        {can('screening:create') && (
          <Button variant="peach" size="sm" icon={<ScanLine className="size-3.5" />} onClick={() => router.push('/screening/new')}>
            <span className="hidden sm:inline">New Screening</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}

        <UserMenu />
      </div>
    </header>
  );
}

function ServiceStatus({
  status,
  className,
}: {
  status?: 'ok' | 'degraded' | 'unreachable';
  className?: string;
}) {
  const config = {
    ok: { tone: 'low' as const, label: 'Service online', detail: 'Analysis services responding normally.' },
    degraded: {
      tone: 'medium' as const,
      label: 'Degraded',
      detail: 'One or more analysis components reported a problem. Expect partial analyses.',
    },
    unreachable: {
      tone: 'high' as const,
      label: 'Unreachable',
      detail: 'The screening service is not responding. New screenings cannot be run.',
    },
  }[status ?? 'ok'];

  return (
    // The responsive class lives on the wrapper, not the trigger: Tooltip renders
    // its own inline-flex root, which would otherwise stay in the layout.
    <div className={cn('hidden sm:block', className)}>
      <Tooltip content={config.detail} side="bottom">
        <span className="flex items-center gap-2 rounded-xl border border-peach-200/80 bg-surface/70 backdrop-blur-md px-3 py-1.5 shadow-xs transition-all hover:bg-surface">
          <LiveDot tone={config.tone} />
          <span className="text-2xs font-semibold text-foreground/80">{config.label}</span>
        </span>
      </Tooltip>
    </div>
  );
}

/**
 * Wall clock, mounted client-side only.
 * Rendering a time on the server would guarantee a hydration mismatch, so the
 * slot stays empty until the first tick.
 */
function ShiftClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span
      className="hidden w-[4.75rem] shrink-0 text-right font-mono text-xs tabular text-muted-foreground lg:block"
      aria-hidden={now === null}
    >
      {now ? formatTime(now) : ''}
    </span>
  );
}
