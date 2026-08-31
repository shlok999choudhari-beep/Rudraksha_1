import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/** Shimmering placeholder. Every data surface has a matching skeleton shape. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-md bg-surface-muted', className)}
      aria-hidden
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-shimmer" />
    </div>
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={{ width: `${100 - (i % 3) * 14}%` }}
        />
      ))}
    </div>
  );
}

/** Matches the KPI card footprint so the dashboard does not shift on load. */
export function SkeletonStatCard() {
  return (
    <div className="panel p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-20" />
      <Skeleton className="mt-3 h-2.5 w-32" />
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-3.5">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton
              key={c}
              className="h-3.5"
              style={{ flex: c === 0 ? '0 0 7rem' : c === cols - 1 ? '0 0 6rem' : '1 1 0%' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full items-end gap-2 px-5 pb-5', className)}>
      {[42, 68, 55, 80, 61, 90, 72, 58, 84, 66, 74, 50].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
