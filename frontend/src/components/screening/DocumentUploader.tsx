'use client';

import * as React from 'react';
import { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  Camera,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { validateFile } from '@/lib/hooks/useDocumentUpload';
import type { DocumentType, UploadedDocument } from '@/lib/types/document';
import { cn } from '@/lib/utils/cn';

export interface DocumentUploaderProps {
  documentType: DocumentType;
  uploadedDocument: UploadedDocument | null;
  onUpload: (file: File) => Promise<UploadedDocument | null>;
  onClear: () => void;
  onLoadSpecimen?: (specimenType: 'GENUINE' | 'TAMPERED' | 'VISA') => void;
  isUploading?: boolean;
  error?: string | null;
  className?: string;
}

export function DocumentUploader({
  documentType,
  uploadedDocument,
  onUpload,
  onClear,
  onLoadSpecimen,
  isUploading = false,
  error,
  className,
}: DocumentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setLocalError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setLocalError(validationError);
        return;
      }
      await onUpload(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        void handleFileSelect(e.dataTransfer.files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const activeError = error || localError;

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            void handleFileSelect(e.target.files[0]);
          }
        }}
      />

      {/* Upload Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={triggerFileInput}
        className={cn(
          'relative flex flex-col items-center justify-center p-8 sm:p-10 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-200',
          isDragOver
            ? 'border-peach-400 bg-peach-50/60 ring-4 ring-peach-200/50 scale-[0.995]'
            : 'border-border bg-gradient-to-b from-surface to-surface-muted/40 hover:border-peach-300 hover:bg-peach-50/20 shadow-sm',
          isUploading && 'opacity-60 pointer-events-none'
        )}
      >
        <div className="grid size-16 place-items-center rounded-2xl border border-peach-200 bg-gradient-to-br from-peach-100 to-peach-50 text-peach-600 mb-4 shadow-[0_4px_16px_-4px_rgba(245,123,74,0.2)]">
          {isUploading ? (
            <RefreshCw className="size-8 animate-spin text-peach-600" />
          ) : (
            <UploadCloud className="size-8" />
          )}
        </div>

        <h3 className="text-sm font-bold text-foreground">
          {isUploading ? 'Analyzing Document Capture...' : 'Drag and Drop Document Scan or Photo'}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Supports JPEG, PNG, WebP or high-resolution PDF of the travel document data page (max 12 MB).
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              triggerFileInput();
            }}
            disabled={isUploading}
          >
            <FileText className="size-3.5 mr-1.5" />
            <span>Browse Files</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              triggerFileInput();
            }}
            disabled={isUploading}
          >
            <Camera className="size-3.5 mr-1.5" />
            <span>Capture with Camera</span>
          </Button>
        </div>
      </div>

      {/* Active Error Banner */}
      {activeError && (
        <div className="rounded-lg border border-risk-high/40 bg-risk-high/10 p-3.5 flex items-start gap-2.5 text-xs text-risk-high">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Upload failed: </span>
            {activeError}
          </div>
        </div>
      )}

      {/* Quick Specimen Presets for SIH Demonstration */}
      {onLoadSpecimen && (
        <div className="rounded-xl border border-border/80 bg-surface/50 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>SIH Live Demo Specimens</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              1-Click Test Data
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onLoadSpecimen('GENUINE')}
              className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-risk-low/40 text-left transition-colors"
            >
              <div>
                <div className="text-xs font-medium text-foreground">Genuine Passport</div>
                <div className="text-[10px] text-risk-low font-medium">Valid / Low Risk</div>
              </div>
              <span className="size-2 rounded-full bg-risk-low" />
            </button>

            <button
              type="button"
              onClick={() => onLoadSpecimen('TAMPERED')}
              className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-risk-high/40 text-left transition-colors"
            >
              <div>
                <div className="text-xs font-medium text-foreground">Tampered DOB Passport</div>
                <div className="text-[10px] text-risk-high font-medium">Forensic Text Anomaly</div>
              </div>
              <span className="size-2 rounded-full bg-risk-high" />
            </button>

            <button
              type="button"
              onClick={() => onLoadSpecimen('VISA')}
              className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 text-left transition-colors"
            >
              <div>
                <div className="text-xs font-medium text-foreground">Tourist Visa Page</div>
                <div className="text-[10px] text-primary font-medium">MRVA Format</div>
              </div>
              <span className="size-2 rounded-full bg-primary" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
