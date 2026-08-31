import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Thin table primitives. Deliberately unopinionated about data — the case,
 * audit and comparison tables all compose these.
 */

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b border-border bg-surface-muted/60 [&_tr]:border-0', className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />;
}

export function TableRow({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'transition-colors',
        interactive &&
          'cursor-pointer hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  align = 'left',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  align = 'left',
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-[0.8125rem] text-foreground',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  );
}

/** Sortable column header button. */
export function SortableHead({
  label,
  active,
  direction,
  onSort,
  align = 'left',
  className,
}: {
  label: string;
  active?: boolean;
  direction?: 'asc' | 'desc';
  onSort: () => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <TableHead align={align} className={cn('p-0', className)}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'flex w-full items-center gap-1.5 px-4 py-2.5 text-2xs font-semibold uppercase tracking-[0.12em] transition-colors hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
          align === 'right' && 'justify-end',
          align === 'center' && 'justify-center',
        )}
        aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        <span className={cn('text-[0.6rem] transition-opacity', active ? 'opacity-100' : 'opacity-30')}>
          {active && direction === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </TableHead>
  );
}

/** Definition-list row used across the evidence cards (`Label ......  Value`). */
export function DataRow({
  label,
  value,
  mono,
  className,
  labelClassName,
  valueClassName,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-2 text-[0.8125rem]',
        className,
      )}
    >
      <dt className={cn('shrink-0 text-muted-foreground', labelClassName)}>{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-right font-medium text-foreground',
          mono && 'font-mono tabular tracking-tight',
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}
