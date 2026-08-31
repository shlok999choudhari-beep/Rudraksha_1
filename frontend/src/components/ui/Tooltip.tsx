'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/** Lightweight CSS-only tooltip. No dependency, no portal, keyboard accessible. */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}) {
  const position = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <span className="group/tt relative inline-flex">
      <span tabIndex={0} className="inline-flex outline-none">
        {children}
      </span>
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-40 w-max max-w-[16rem] rounded-md border border-border-strong bg-popover px-2.5 py-1.5 text-xs leading-snug text-popover-foreground opacity-0 shadow-xl transition-opacity duration-150',
          'group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          position,
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}

/** `?` affordance that explains a metric or a threshold. */
export function InfoHint({ content, className }: { content: React.ReactNode; className?: string }) {
  return (
    <Tooltip content={content}>
      <span
        className={cn(
          'inline-flex size-4 cursor-help items-center justify-center rounded-full border border-border-strong text-[0.625rem] font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary',
          className,
        )}
        aria-label="More information"
      >
        ?
      </span>
    </Tooltip>
  );
}
