'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface TabItem {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

/** Segmented control used for filters (`All | LOW | MEDIUM | HIGH`). */
export function SegmentedTabs({
  items,
  value,
  onChange,
  className,
  size = 'default',
  ariaLabel,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: 'sm' | 'default';
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-all',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[0.8125rem]',
              active
                ? 'bg-surface-raised text-foreground shadow-sm ring-1 ring-border-strong'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.icon}
            {item.label}
            {item.count != null && (
              <span
                className={cn(
                  'rounded px-1 text-[0.625rem] font-semibold tabular',
                  active ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Underlined tabs for section navigation inside a case report. */
export function UnderlineTabs({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-border', className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-[0.8125rem] font-medium transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.icon}
            {item.label}
            {item.count != null && (
              <span className="rounded bg-secondary px-1 text-[0.625rem] font-semibold tabular text-muted-foreground">
                {item.count}
              </span>
            )}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
