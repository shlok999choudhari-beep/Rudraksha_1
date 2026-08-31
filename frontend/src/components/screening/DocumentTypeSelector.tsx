'use client';

import * as React from 'react';
import { BookOpen, Stamp } from 'lucide-react';
import type { DocumentType } from '@/lib/types/document';
import { cn } from '@/lib/utils/cn';

export interface DocumentTypeSelectorProps {
  value: DocumentType;
  onChange: (type: DocumentType) => void;
  disabled?: boolean;
  className?: string;
}

const DOCUMENT_TYPES: {
  type: DocumentType;
  label: string;
  sublabel: string;
  spec: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: 'PASSPORT',
    label: 'Passport (ICAO 9303)',
    sublabel: 'Standard travel booklet with TD3 MRZ and identity photograph',
    spec: 'TD3 / 2-line MRZ',
    icon: BookOpen,
  },
  {
    type: 'VISA',
    label: 'Entry / Stay Visa',
    sublabel: 'Affixed or electronic visa document with validity window and MRVA/MRVB',
    spec: 'MRVA/B Format',
    icon: Stamp,
  },
];

export function DocumentTypeSelector({
  value,
  onChange,
  disabled = false,
  className,
}: DocumentTypeSelectorProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
        Select Document Type
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DOCUMENT_TYPES.map((item) => {
          const isSelected = value === item.type;
          const Icon = item.icon;

          return (
            <button
              key={item.type}
              type="button"
              disabled={disabled}
              onClick={() => onChange(item.type)}
              className={cn(
                'flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10 ring-1 ring-primary/30'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-surface-muted',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-lg border shrink-0',
                  isSelected
                    ? 'border-primary/40 bg-primary/20 text-primary'
                    : 'border-border bg-surface-muted text-muted-foreground'
                )}
              >
                <Icon className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-foreground">
                    {item.label}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground rounded bg-surface-muted px-1.5 py-0.5 border border-border">
                    {item.spec}
                  </span>
                </div>
                <p className="text-2xs text-muted-foreground mt-1 leading-relaxed">
                  {item.sublabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
