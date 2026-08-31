import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-[0.08em] transition-colors [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-border-strong bg-surface-muted text-foreground',
        outline: 'border-border-strong bg-transparent text-muted-foreground',
        primary: 'border-border-strong bg-foreground text-background font-semibold',
        low: 'border-risk-low/30 bg-risk-low/10 text-risk-low',
        medium: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
        high: 'border-risk-high/30 bg-risk-high/10 text-risk-high',
        neutral: 'border-border bg-surface-muted text-muted-foreground',
        /** Deterministic rule output. */
        rule: 'border-border-strong bg-surface-muted text-muted-foreground',
        /** Probabilistic / model output. */
        ai: 'border-border-strong bg-surface-raised text-foreground',
      },
      size: {
        default: '',
        sm: 'px-2 py-0 text-[0.625rem]',
        lg: 'px-3 py-1 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };
