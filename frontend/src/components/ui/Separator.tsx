import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Separator({
  className,
  orientation = 'horizontal',
  label,
}: {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  label?: string;
}) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)} role="separator">
        <span className="h-px flex-1 bg-border" />
        <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    />
  );
}

/** Key-value chip used in header meta rows (`Case VG-1024 · Passport · 3.8 s`). */
export function MetaItem({
  label,
  value,
  icon,
  mono,
  className,
}: {
  label?: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      {icon && <span className="[&_svg]:size-3.5">{icon}</span>}
      {label && <span>{label}</span>}
      <span className={cn('font-medium text-foreground', mono && 'font-mono tabular')}>{value}</span>
    </span>
  );
}
