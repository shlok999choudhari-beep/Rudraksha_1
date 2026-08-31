'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px',
  {
    variants: {
      variant: {
        default:
          'bg-foreground text-background hover:bg-foreground/90 font-semibold shadow-sm',
        secondary:
          'bg-surface-raised text-foreground border border-border-strong hover:bg-accent hover:border-muted-foreground/40',
        outline:
          'border border-border-strong bg-transparent text-foreground hover:bg-surface-muted hover:text-foreground',
        ghost: 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        // For escalation and other high-consequence officer actions.
        warning:
          'bg-risk-medium/10 text-risk-medium border border-risk-medium/30 hover:bg-risk-medium/20',
        success: 'bg-risk-low/10 text-risk-low border border-risk-low/30 hover:bg-risk-low/20',
        link: 'text-foreground underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        default: 'h-9 px-4 [&_svg]:size-4',
        lg: 'h-11 px-6 text-[0.95rem] [&_svg]:size-4',
        icon: 'h-9 w-9 [&_svg]:size-4',
        'icon-sm': 'h-8 w-8 [&_svg]:size-3.5',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'default', size: 'default', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  /** Icon rendered before the label. */
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, loading, icon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
