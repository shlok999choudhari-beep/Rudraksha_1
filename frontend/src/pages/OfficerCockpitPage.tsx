import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { TopHeader } from '@/components/TopHeader';
import { MetricCards } from '@/components/MetricCards';
import { VisualInvestigationPanel } from '@/components/VisualInvestigationPanel';
import { AuditTables } from '@/components/AuditTables';
import { DocumentIntake } from '@/components/DocumentIntake';
import { screenDocument, generateMockScreeningResult } from '@/lib/api';
import type { ScreeningResponse } from '@/types/screening';

export default function OfficerCockpitPage() {
  const [data, setData] = useState<ScreeningResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setData(generateMockScreeningResult(undefined, undefined, 'GENUINE'));
  }, []);

  const handleScreen = async (docFile: File, selfieFile: File | null) => {
    setLoading(true);
    try {
      const response = await screenDocument(docFile, selfieFile);
      setData(response);
    } catch (err) {
      console.error('Screening failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPreset = (preset: ScreeningResponse) => {
    setData(preset);
  };

  const handleReset = () => {
    setData(null);
  };

  return (
    <PageContainer
      title="Officer Screening Cockpit"
      description="Real-time multi-layer forensic, ICAO 9303, and biometric integrity screening console"
    >
      <div className="space-y-6">
        {/* Top Header Decision Banner & Trust Score Gauge */}
        <TopHeader
          assessment={data?.risk_assessment || null}
          screeningId={data?.screening_id || null}
          onReset={handleReset}
        />

        {/* Document Intake & Demo Presets Bar */}
        <DocumentIntake
          onScreen={handleScreen}
          onLoadPreset={handleLoadPreset}
          loading={loading}
        />

        {/* 4 Metric Cards */}
        {data && <MetricCards assessment={data.risk_assessment} />}

        {/* Main Visual Investigation Panel (4 Tabs) */}
        {data && <VisualInvestigationPanel data={data} />}

        {/* Bottom Audit Tables (VIZ/MRZ, Check Digit Breakdown) */}
        {data && <AuditTables data={data} />}
      </div>
    </PageContainer>
  );
}
