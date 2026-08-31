import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  FileText,
  User,
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { generateMockScreeningResult } from '@/lib/api';
import type { ScreeningResponse } from '@/types/screening';

interface DocumentIntakeProps {
  onScreen: (docFile: File, selfieFile: File | null) => Promise<void>;
  onLoadPreset: (result: ScreeningResponse) => void;
  loading: boolean;
}

export function DocumentIntake({ onScreen, onLoadPreset, loading }: DocumentIntakeProps) {
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const docInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDocFile(file);
      setDocPreview(URL.createObjectURL(file));
    }
  };

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelfieFile(file);
      setSelfiePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) {
      // If no file selected, load default genuine preset
      onLoadPreset(generateMockScreeningResult(undefined, undefined, 'GENUINE'));
      return;
    }
    await onScreen(docFile, selfieFile);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-5 border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-foreground uppercase font-mono flex items-center gap-2">
            <Upload className="size-4" />
            1. Document & Biometric Intake
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Attach document scan or photograph for multi-layer integrity pipeline evaluation.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-mono uppercase text-muted-foreground mr-1 flex items-center gap-1">
            <Sparkles className="size-3" />
            Demo Presets:
          </span>
          <button
            type="button"
            onClick={() => onLoadPreset(generateMockScreeningResult(undefined, undefined, 'GENUINE'))}
            className="rounded border border-border bg-surface-muted px-2.5 py-1 text-2xs font-medium text-foreground hover:bg-surface-raised transition-colors"
          >
            🟢 Genuine
          </button>
          <button
            type="button"
            onClick={() => onLoadPreset(generateMockScreeningResult(undefined, undefined, 'TAMPERED'))}
            className="rounded border border-border bg-surface-muted px-2.5 py-1 text-2xs font-medium text-rose-700 hover:bg-surface-raised transition-colors"
          >
            🔴 Tampered (ELA)
          </button>
          <button
            type="button"
            onClick={() => onLoadPreset(generateMockScreeningResult(undefined, undefined, 'MRZ_MISMATCH'))}
            className="rounded border border-border bg-surface-muted px-2.5 py-1 text-2xs font-medium text-amber-700 hover:bg-surface-raised transition-colors"
          >
            🟡 MRZ Mismatch
          </button>
          <button
            type="button"
            onClick={() => onLoadPreset(generateMockScreeningResult(undefined, undefined, 'IMPERSONATION'))}
            className="rounded border border-border bg-surface-muted px-2.5 py-1 text-2xs font-medium text-rose-700 hover:bg-surface-raised transition-colors"
          >
            🔴 Impersonation
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Document File Intake Dropzone */}
          <div
            onClick={() => docInputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
              docFile
                ? 'border-border-strong bg-surface-muted/50'
                : 'border-border hover:border-foreground/40 bg-surface-muted/20 hover:bg-surface-muted/40'
            }`}
          >
            <input
              ref={docInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleDocChange}
            />

            {docPreview ? (
              <div className="flex flex-col items-center">
                <img
                  src={docPreview}
                  alt="Document Preview"
                  className="h-28 w-auto object-contain rounded border border-border bg-white shadow-xs"
                />
                <span className="mt-2 text-xs font-mono font-semibold text-foreground truncate max-w-[240px]">
                  {docFile?.name}
                </span>
                <span className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                  <CheckCircle className="size-3" /> Ready for Screening
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <span className="grid size-12 place-items-center rounded-xl bg-surface-muted border border-border text-foreground group-hover:scale-105 transition-transform">
                  <FileText className="size-6 text-foreground" />
                </span>
                <p className="mt-3 text-xs font-semibold text-foreground">
                  Click or drag passport / national ID
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Supports JPEG, PNG, WEBP (Max 20MB)
                </p>
              </div>
            )}
          </div>

          {/* Optional Live Selfie Dropzone */}
          <div
            onClick={() => selfieInputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
              selfieFile
                ? 'border-border-strong bg-surface-muted/50'
                : 'border-border hover:border-foreground/40 bg-surface-muted/20 hover:bg-surface-muted/40'
            }`}
          >
            <input
              ref={selfieInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSelfieChange}
            />

            {selfiePreview ? (
              <div className="flex flex-col items-center">
                <img
                  src={selfiePreview}
                  alt="Selfie Preview"
                  className="h-28 w-28 object-cover rounded-full border-2 border-border bg-white shadow-xs"
                />
                <span className="mt-2 text-xs font-mono font-semibold text-foreground truncate max-w-[240px]">
                  {selfieFile?.name}
                </span>
                <span className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                  <CheckCircle className="size-3" /> Live Selfie Probe Attached
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <span className="grid size-12 place-items-center rounded-xl bg-surface-muted border border-border text-foreground group-hover:scale-105 transition-transform">
                  <Camera className="size-6 text-foreground" />
                </span>
                <p className="mt-3 text-xs font-semibold text-foreground">
                  Attach Live Selfie / Probe (Optional)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  For 1:1 facial biometric cross-matching & anti-spoof
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Submit action */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background px-6 py-2.5 text-xs font-semibold hover:bg-foreground/90 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Running Multi-Layer Integrity Inspection...</span>
              </>
            ) : (
              <>
                <span>Execute Screening Inspection</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
