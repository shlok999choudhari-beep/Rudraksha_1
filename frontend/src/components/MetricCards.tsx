import React from 'react';
import {
  FileText,
  Lock,
  Shield,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import type { RiskAssessment, LayerScore } from '@/types/screening';

interface MetricCardsProps {
  assessment: RiskAssessment | null;
}

export function MetricCards({ assessment }: MetricCardsProps) {
  if (!assessment) return null;

  const cards: {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    layer: LayerScore;
  }[] = [
    {
      id: 'doc_integrity',
      title: 'Physical & Margin Integrity',
      subtitle: 'Corner geometry, aspect ratio & substrate sharpness',
      icon: FileText,
      layer: assessment.document_integrity_layer,
    },
    {
      id: 'data_consistency',
      title: 'ICAO 9303 Consistency',
      subtitle: 'VIZ OCR vs. MRZ check-digit cryptographic audit',
      icon: Lock,
      layer: assessment.data_consistency_layer,
    },
    {
      id: 'forensic_tamper',
      title: 'Forensic Tampering & Splicing',
      subtitle: 'ELA thermal compression & PRNU sensor noise map',
      icon: Shield,
      layer: assessment.forensic_tampering_layer,
    },
    {
      id: 'biometric_id',
      title: 'Biometric Match & Liveness',
      subtitle: 'Passport photo 1:1 vs. live capture & anti-spoof',
      icon: UserCheck,
      layer: assessment.biometric_identity_layer,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const score = Math.round(c.layer?.trust_score ?? 0);
        const isPassed = score >= 80;
        const isModerate = score >= 50 && score < 80;

        return (
          <div
            key={c.id}
            className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-all hover:border-border-strong flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-lg border border-border-strong bg-surface-muted text-foreground">
                  <Icon className="size-4.5" />
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                    isPassed
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : isModerate
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {isPassed ? (
                    <CheckCircle2 className="size-3" />
                  ) : isModerate ? (
                    <AlertTriangle className="size-3" />
                  ) : (
                    <AlertCircle className="size-3" />
                  )}
                  {c.layer?.risk_level} RISK
                </span>
              </div>

              <h3 className="mt-3 text-xs font-semibold text-foreground tracking-tight">
                {c.title}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {c.subtitle}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between">
              <span className="font-mono text-xl font-bold text-foreground">
                {score}%
              </span>

              {/* Mini progress track */}
              <div className="w-24 h-1.5 rounded-full bg-surface-muted overflow-hidden border border-border">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isPassed ? 'bg-emerald-600' : isModerate ? 'bg-amber-500' : 'bg-rose-600'
                  }`}
                  style={{ width: `${Math.max(5, score)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
