'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, IdCard, LogOut, MapPin, Settings, UserRound } from 'lucide-react';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/types/user';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/dates';
import { useAuth } from '@/providers/AuthProvider';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors',
          open ? 'border-border bg-accent' : 'hover:bg-accent',
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 font-mono text-xs font-semibold text-primary">
          {user.avatarInitials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-medium leading-tight text-foreground">
            {user.name}
          </span>
          <span className="block text-2xs leading-tight text-muted-foreground">
            {ROLE_LABELS[user.role]}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 animate-scale-in origin-top-right overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        >
          <div className="border-b border-border px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">{user.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-2.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-2xs leading-snug text-primary/90">
              {ROLE_DESCRIPTIONS[user.role]}
            </p>
          </div>

          <dl className="space-y-2 border-b border-border px-4 py-3 text-xs">
            {user.badgeId && (
              <div className="flex items-center gap-2">
                <IdCard className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <dt className="text-muted-foreground">Badge</dt>
                <dd className="ml-auto font-mono text-foreground">{user.badgeId}</dd>
              </div>
            )}
            {user.station && (
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <dt className="text-muted-foreground">Station</dt>
                <dd className="ml-auto truncate text-foreground">{user.station}</dd>
              </div>
            )}
            {user.lastLoginAt && (
              <div className="flex items-center gap-2">
                <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <dt className="text-muted-foreground">Session started</dt>
                <dd className="ml-auto tabular text-foreground">
                  {formatDateTime(user.lastLoginAt)}
                </dd>
              </div>
            )}
          </dl>

          <div className="p-1.5">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Settings className="size-3.5" aria-hidden />
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-3.5" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
