import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const WIDTHS = {
  default: 'max-w-[1600px]',
  wide: 'max-w-none',
  narrow: 'max-w-4xl',
} as const;

export interface PageContainerProps {
  /** Small uppercase kicker above the title, e.g. `Case VG-2026-0042`. */
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons and controls aligned to the right of the title block. */
  actions?: React.ReactNode;
  /** Rendered full-width directly beneath the title block (tabs, alerts, filters). */
  toolbar?: React.ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
  children: React.ReactNode;
}

/**
 * Standard page frame: consistent gutters, one title block, one content column.
 *
 * Every route uses this so that the eye lands in the same place on every screen —
 * an officer switching between a result and a case list should not have to
 * re-orient.
 */
export function PageContainer({
  eyebrow,
  title,
  description,
  actions,
  toolbar,
  width = 'default',
  className,
  children,
}: PageContainerProps) {
  const hasHeading = Boolean(eyebrow || title || description || actions);

  return (
    <div className={cn('mx-auto w-full px-4 py-6 lg:px-6 lg:py-8', WIDTHS[width], className)}>
      {hasHeading && (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {eyebrow && <p className="section-label mb-1.5">{eyebrow}</p>}
            {title && (
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground lg:text-2xl">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}

      {toolbar && <div className="mb-6">{toolbar}</div>}

      {children}
    </div>
  );
}

/** Titled block inside a page — groups related panels under one label. */
export function PageSection({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('mb-8 last:mb-0', className)}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
