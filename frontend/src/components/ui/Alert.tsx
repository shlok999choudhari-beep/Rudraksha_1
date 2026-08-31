import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const alertVariants = cva('relative flex gap-3 rounded-lg border px-4 py-3.5 text-sm', {
  variants: {
    variant: {
      info: 'border-primary/30 bg-primary/8 text-foreground',
      success: 'border-risk-low/35 bg-risk-low/8 text-foreground',
      warning: 'border-risk-medium/35 bg-risk-medium/8 text-foreground',
      danger: 'border-risk-high/40 bg-risk-high/8 text-foreground',
      neutral: 'border-border-strong bg-surface-muted text-foreground',
    },
  },
  defaultVariants: { variant: 'info' },
});

const iconTone = {
  info: 'text-primary',
  success: 'text-risk-low',
  warning: 'text-risk-medium',
  danger: 'text-risk-high',
  neutral: 'text-muted-foreground',
} as const;

const defaultIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: ShieldAlert,
  neutral: Info,
} as const;

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  /** Actions rendered under the body, e.g. a Retry button. */
  actions?: React.ReactNode;
  hideIcon?: boolean;
}

export function Alert({
  className,
  variant = 'info',
  title,
  icon,
  actions,
  hideIcon,
  children,
  ...props
}: AlertProps) {
  const v = variant ?? 'info';
  const DefaultIcon = defaultIcons[v];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {!hideIcon && (
        <span className={cn('mt-0.5 shrink-0', iconTone[v])}>
          {icon ?? <DefaultIcon className="size-4.5" aria-hidden />}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        {children && (
          <div className="text-[0.8125rem] leading-relaxed text-muted-foreground [&_strong]:text-foreground">
            {children}
          </div>
        )}
        {actions && <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div>}
      </div>
    </div>
  );
}

export { XCircle };
