import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { lit?: boolean }
>(({ className, lit, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('panel shadow-panel', lit && 'panel-lit', className)}
    {...props}
  />
));
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { bordered?: boolean }
>(({ className, bordered = true, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-wrap items-start justify-between gap-3 px-5 py-4',
      bordered && 'border-b border-border',
      className,
    )}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

/**
 * Section heading. Rendered as the small uppercase label the spec uses above
 * every evidence block (`DOCUMENT VALIDATION`, `RISK BREAKDOWN`, …).
 */
export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4'; plain?: boolean }
>(({ className, as: Tag = 'h3', plain, ...props }, ref) => (
  <Tag
    ref={ref}
    className={cn(
      plain
        ? 'text-sm font-semibold text-foreground'
        : 'text-2xs font-semibold uppercase tracking-[0.16em] text-muted-foreground',
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-xs leading-relaxed text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }
>(({ className, flush, ...props }, ref) => (
  <div ref={ref} className={cn(flush ? '' : 'px-5 py-4', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-wrap items-center gap-3 border-t border-border px-5 py-3.5',
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

/** Right-aligned slot in a CardHeader for badges / actions. */
export function CardHeaderActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex shrink-0 items-center gap-2', className)} {...props} />;
}
