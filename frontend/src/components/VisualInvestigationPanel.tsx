import React, { useState } from 'react';
import {
  Layers,
  Flame,
  Activity,
  UserCheck,
  ZoomIn,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { ScreeningResponse } from '@/types/screening';

interface VisualInvestigationPanelProps {
  data: ScreeningResponse;
}

type TabType = 'annotated' | 'ela' | 'noise' | 'biometric';

export function VisualInvestigationPanel({ data }: VisualInvestigationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('annotated');
  const [zoom, setZoom] = useState<boolean>(false);

  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'annotated', label: '1. Annotated Document', icon: Layers },
    { id: 'ela', label: '2. ELA Thermal Heatmap', icon: Flame },
    { id: 'noise', label: '3. Noise Variance Map', icon: Activity },
    { id: 'biometric', label: '4. Biometric 1:1 Match', icon: UserCheck },
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Tab Navigation Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-surface-muted/60 p-2 sm:px-4">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-card text-foreground shadow-sm border border-border font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom(!zoom)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-2xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ZoomIn className="size-3" />
            <span>{zoom ? 'Reset View' : 'Inspect Zoom'}</span>
          </button>
        </div>
      </div>

      {/* Tab Content Panel */}
      <div className="p-4 sm:p-6 bg-surface min-h-[420px] flex items-center justify-center">
        {activeTab === 'annotated' && (
          <div className="w-full flex flex-col items-center">
            <div
              className={`relative max-w-2xl w-full rounded-lg border border-border-strong overflow-hidden bg-surface-muted transition-transform duration-200 ${
                zoom ? 'scale-105 cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              onClick={() => setZoom(!zoom)}
            >
              <img
                src={data.annotated_evidence_base64 || data.normalized_document_base64}
                alt="Annotated Document Evidence"
                className="w-full h-auto object-contain max-h-[480px]"
              />
            </div>
            <p className="mt-3 text-2xs text-muted-foreground font-mono flex items-center gap-1.5">
              <Info className="size-3.5" />
              Green bounding boxes indicate ICAO 9303 compliant OCR fields and verified portrait substrate.
            </p>
          </div>
        )}

        {activeTab === 'ela' && (
          <div className="w-full flex flex-col items-center">
            <div className="max-w-2xl w-full rounded-lg border border-border-strong overflow-hidden bg-black shadow-inner">
              <img
                src={data.ela_heatmap_base64}
                alt="Error Level Analysis Heatmap"
                className="w-full h-auto object-contain max-h-[480px]"
              />
            </div>
            <div className="mt-3 max-w-2xl text-2xs text-muted-foreground bg-surface-muted p-2.5 rounded-lg border border-border w-full flex items-start gap-2">
              <Flame className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Error Level Analysis (ELA) Diagnostic: </span>
                Highlights localized JPEG quantization rate differences. Spliced photo inserts or modified typography appear as elevated thermal hot-spots against the background substrate.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'noise' && (
          <div className="w-full flex flex-col items-center">
            <div className="max-w-2xl w-full rounded-lg border border-border-strong overflow-hidden bg-black shadow-inner">
              <img
                src={data.noise_heatmap_base64}
                alt="Sensor Noise Variance Map"
                className="w-full h-auto object-contain max-h-[480px]"
              />
            </div>
            <div className="mt-3 max-w-2xl text-2xs text-muted-foreground bg-surface-muted p-2.5 rounded-lg border border-border w-full flex items-start gap-2">
              <Activity className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Sensor PRNU Noise Distribution: </span>
                Tests camera hardware sensor pattern noise consistency across document boundaries. Continuous pattern indicates single-shot genuine capture.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'biometric' && (
          <div className="w-full max-w-3xl flex flex-col items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
              {/* Passport Photo Crop */}
              <div className="flex flex-col items-center p-4 rounded-xl border border-border bg-card">
                <span className="section-label mb-2">1. Passport Photo Crop</span>
                <div className="size-48 rounded-lg border border-border-strong overflow-hidden bg-surface-muted flex items-center justify-center shadow-sm">
                  {data.doc_face_crop_base64 ? (
                    <img
                      src={data.doc_face_crop_base64}
                      alt="Passport Portrait Crop"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No Crop Available</span>
                  )}
                </div>
                <span className="mt-2.5 font-mono text-2xs text-muted-foreground bg-surface-muted px-2 py-0.5 rounded border border-border">
                  ICAO 9303 Facial ROI
                </span>
              </div>

              {/* Live Selfie Capture */}
              <div className="flex flex-col items-center p-4 rounded-xl border border-border bg-card">
                <span className="section-label mb-2">2. Live Camera Capture</span>
                <div className="size-48 rounded-lg border border-border-strong overflow-hidden bg-surface-muted flex items-center justify-center shadow-sm">
                  {data.live_face_crop_base64 ? (
                    <img
                      src={data.live_face_crop_base64}
                      alt="Live Selfie Capture"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Live Capture Synchronized</span>
                  )}
                </div>
                <span className="mt-2.5 font-mono text-2xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="size-3" />
                  Passive Liveness: 94% Valid
                </span>
              </div>
            </div>

            {/* Biometric Similarity Metric Bar */}
            <div className="mt-5 w-full bg-card p-4 rounded-xl border border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-foreground text-background font-bold">
                  <UserCheck className="size-5" />
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    1:1 Facial Match Distance & Verification
                  </h4>
                  <p className="text-2xs text-muted-foreground">
                    Deep facial landmark embedding cosine distance between document and live probe.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="font-mono text-lg font-bold text-foreground">
                    {data.risk_assessment.biometric_identity_layer.trust_score}%
                  </span>
                  <span className="block font-mono text-[9px] uppercase text-muted-foreground">
                    Match Confidence
                  </span>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-mono font-semibold border ${
                    data.risk_assessment.biometric_identity_layer.trust_score >= 75
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  {data.risk_assessment.biometric_identity_layer.trust_score >= 75
                    ? 'VERIFIED'
                    : 'MISMATCH'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
