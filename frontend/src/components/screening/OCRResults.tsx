'use client';

import * as React from 'react';
import { useState } from 'react';
import { FileText, Eye, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { OcrResult } from '@/lib/types/screening';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

export interface OCRResultsProps {
  ocr: OcrResult;
  className?: string;
}

export function OCRResults({ ocr, className }: OCRResultsProps) {
  const [showRaw, setShowRaw] = useState(false);
  const confidencePercent = Math.round(ocr.overallConfidence * 100);

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              OCR Field Extraction
            </h4>
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-2xs font-mono text-primary font-medium">
              Overall: {confidencePercent}%
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Automated text extraction from Visual Inspection Zone (VIZ) with field-level confidence
          </p>
        </div>

        {ocr.rawText && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRaw(!showRaw)}
            className="text-2xs text-muted-foreground hover:text-foreground"
          >
            <FileText className="size-3.5 mr-1" />
            <span>{showRaw ? 'Hide Raw' : 'View Raw'}</span>
            {showRaw ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />}
          </Button>
        )}
      </div>

      {/* Extracted Fields Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-muted/60 border-b border-border text-2xs font-mono text-muted-foreground uppercase">
            <tr>
              <th className="py-2.5 px-4">Field Label</th>
              <th className="py-2.5 px-4">Extracted Value</th>
              <th className="py-2.5 px-4 text-right">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ocr?.fields?.map((field, idx) => {
              const conf = Math.round((field.confidence ?? 0.95) * 100);
              const isHigh = conf >= 90;
              const isMedium = conf >= 75 && conf < 90;

              return (
                <tr key={field.key || field.label || `ocr-field-${idx}`} className="hover:bg-surface-muted/30">
                  <td className="py-2.5 px-4 font-mono text-2xs text-muted-foreground">
                    {field.label}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-foreground font-mono">
                    {field.value || '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 font-mono text-2xs font-semibold px-2 py-0.5 rounded',
                        isHigh
                          ? 'bg-risk-low/10 text-risk-low'
                          : isMedium
                            ? 'bg-risk-medium/10 text-risk-medium'
                            : 'bg-risk-high/10 text-risk-high'
                      )}
                    >
                      {conf}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Collapsible Raw OCR Block */}
      {showRaw && ocr.rawText && (
        <div className="rounded-xl border border-border bg-black/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono text-muted-foreground">
            <span>Raw Tesseract / PaddleOCR Output</span>
            {ocr.engine && <span>Engine: {ocr.engine}</span>}
          </div>
          <pre className="font-mono text-2xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {ocr.rawText}
          </pre>
        </div>
      )}
    </div>
  );
}
