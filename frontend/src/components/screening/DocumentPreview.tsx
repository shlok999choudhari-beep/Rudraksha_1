'use client';

import * as React from 'react';
import { FileText, RefreshCw, CheckCircle2, CornerDownRight, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { UploadedDocument } from '@/lib/types/document';
import { formatBytes } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

export interface DocumentPreviewProps {
  document: UploadedDocument;
  onReplace: () => void;
  onContinue: () => void;
  canContinue?: boolean;
  className?: string;
}

export function DocumentPreview({
  document,
  onReplace,
  onContinue,
  canContinue = true,
  className,
}: DocumentPreviewProps) {
  const [fullscreen, setFullscreen] = React.useState(false);

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
            Document Capture Preview
          </h4>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Normalised perspective framing ready for OCR & tamper feature extraction
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReplace}
            className="text-xs"
          >
            <RefreshCw className="size-3.5 mr-1" />
            <span>Replace Capture</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onContinue}
            disabled={!canContinue}
            className="text-xs shadow-sm shadow-primary/20"
          >
            <span>Confirm & Proceed</span>
            <CornerDownRight className="size-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* Image Preview Container */}
      <div className="relative group rounded-xl border border-border bg-black/40 overflow-hidden flex items-center justify-center min-h-[260px] max-h-[380px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={document.imageUrl}
          alt={`Captured ${document.documentType} data page`}
          className="max-h-[360px] w-auto max-w-full object-contain rounded-lg shadow-md"
        />

        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="absolute top-3 right-3 p-2 rounded-lg bg-black/70 hover:bg-black/90 text-white/80 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
          title="View Full Preview"
        >
          <Maximize2 className="size-4" />
        </button>

        {document.cornersDetected && (
          <div className="absolute bottom-3 left-3 bg-surface/90 backdrop-blur border border-border px-2.5 py-1 rounded-md text-[11px] font-mono text-risk-low flex items-center gap-1.5 shadow">
            <CheckCircle2 className="size-3.5" />
            <span>4 Document Corners Detected & Corrected</span>
          </div>
        )}
      </div>

      {/* Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-surface-muted/40 p-3 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span className="font-medium text-foreground font-mono truncate max-w-[200px]">
            {document.fileName}
          </span>
          <span className="text-muted-foreground font-mono text-2xs">
            ({formatBytes(document.fileSizeBytes)})
          </span>
        </div>

        <div className="flex items-center gap-4 text-2xs font-mono text-muted-foreground">
          <span>Type: <strong className="text-foreground">{document.documentType}</strong></span>
          {document.processedSize && (
            <span>
              Resolution: <strong className="text-foreground">{document.processedSize.width} × {document.processedSize.height} px</strong>
            </span>
          )}
        </div>
      </div>

      {/* Lightbox / Modal */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setFullscreen(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-surface rounded-xl p-4 border border-border shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={document.imageUrl}
              alt="High resolution document preview"
              className="max-h-[80vh] w-auto object-contain rounded"
            />
            <div className="mt-3 flex justify-between items-center text-xs text-muted-foreground">
              <span>Press anywhere to close</span>
              <Button size="sm" variant="secondary" onClick={() => setFullscreen(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
