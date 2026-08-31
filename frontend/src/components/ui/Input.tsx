import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-surface-muted px-3 py-2 text-sm text-foreground shadow-inner transition-colors',
        'placeholder:text-muted-foreground/70',
        'hover:border-border-strong',
        'focus:border-primary/60 focus:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:text-foreground',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      'flex w-full resize-y rounded-md border border-input bg-surface-muted px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-inner transition-colors',
      'placeholder:text-muted-foreground/70 hover:border-border-strong',
      'focus:border-primary/60 focus:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean; hint?: string }
>(({ className, required, hint, children, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('flex items-baseline justify-between gap-2 text-xs font-medium text-muted-foreground', className)}
    {...props}
  >
    <span>
      {children}
      {required && <span className="ml-0.5 text-risk-high">*</span>}
    </span>
    {hint && <span className="text-2xs font-normal text-muted-foreground/70">{hint}</span>}
  </label>
));
Label.displayName = 'Label';

/** Native select styled to match. Keeps keyboard/mobile behaviour for free. */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full appearance-none rounded-md border border-input bg-surface-muted pl-3 pr-9 text-sm text-foreground shadow-inner transition-colors',
        'hover:border-border-strong focus:border-primary/60 focus:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  </div>
));
Select.displayName = 'Select';

/** Field wrapper: label + control + error/help text. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  help,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required} hint={hint}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-risk-high" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="text-xs text-muted-foreground/80">{help}</p>
      ) : null}
    </div>
  );
}

export const Switch = React.forwardRef<
  HTMLButtonElement,
  {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    className?: string;
  }
>(({ checked, onCheckedChange, disabled, label, className }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
      checked ? 'bg-primary' : 'bg-secondary ring-1 ring-inset ring-border-strong',
      className,
    )}
  >
    <span
      className={cn(
        'absolute size-3.5 rounded-full bg-background shadow transition-transform',
        checked ? 'translate-x-[1.15rem]' : 'translate-x-[0.2rem]',
      )}
    />
  </button>
));
Switch.displayName = 'Switch';
