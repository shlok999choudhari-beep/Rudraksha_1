'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Milliseconds; `0` keeps it until dismissed. */
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let toastSeq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (toast: Omit<Toast, 'id'>) => {
      toastSeq += 1;
      const id = `toast-${toastSeq}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      const duration = toast.duration ?? 5000;
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const TONE_CONFIG: Record<ToastTone, { icon: React.ElementType; cls: string; iconCls: string }> = {
  info: { icon: Info, cls: 'border-primary/30', iconCls: 'text-primary' },
  success: { icon: CheckCircle2, cls: 'border-risk-low/35', iconCls: 'text-risk-low' },
  warning: { icon: AlertTriangle, cls: 'border-risk-medium/35', iconCls: 'text-risk-medium' },
  danger: { icon: ShieldAlert, cls: 'border-risk-high/40', iconCls: 'text-risk-high' },
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-2.5"
    >
      {toasts.map((toast) => {
        const cfg = TONE_CONFIG[toast.tone];
        const Icon = cfg.icon;
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex animate-fade-up items-start gap-3 rounded-lg border bg-popover px-4 py-3 shadow-2xl',
              cfg.cls,
            )}
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', cfg.iconCls)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-semibold text-foreground">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="-mr-1 -mt-1 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
