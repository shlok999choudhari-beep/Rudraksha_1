'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  User,
  Sliders,
  Cpu,
  RefreshCw,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { resetDemoStore, findDemoUserByRole, DEMO_PASSWORD } from '@/lib/mock/store';
import { ROLE_PERMISSIONS, type Permission, type Role } from '@/lib/types/user';
import { cn } from '@/lib/utils/cn';

export default function SettingsPage() {
  const { user, signIn } = useAuth();
  const toast = useToast();
  const [isResetting, setIsResetting] = useState(false);

  const permissions = user?.role ? (ROLE_PERMISSIONS[user.role] as Permission[]) : [];

  const handleRoleSwitch = async (role: Role) => {
    const demoUser = findDemoUserByRole(role);
    if (!demoUser) return;
    try {
      await signIn({ email: demoUser.email, password: DEMO_PASSWORD });
      toast.push({
        tone: 'success',
        title: `Switched to ${role} Session`,
        description: `Now operating as ${demoUser.name} (${demoUser.station}).`,
      });
    } catch {
      toast.push({
        tone: 'danger',
        title: 'Role switch failed',
      });
    }
  };

  const handleResetData = () => {
    setIsResetting(true);
    resetDemoStore();
    setTimeout(() => {
      setIsResetting(false);
      toast.push({
        tone: 'success',
        title: 'Demo Store Reseeded',
        description: 'Case history, statistics, and audit logs have been reset to pristine prototype seed state.',
      });
      window.location.reload();
    }, 600);
  };

  return (
    <PageContainer
      title="Console Settings & Configuration"
      description="System thresholds, role-based access control policies, and AI model telemetry"
    >
      <div className="space-y-6 max-w-5xl">
        {/* User Profile & Station Card */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 border border-primary/30 text-primary">
              <User className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Operator Session & Station</h3>
              <p className="text-2xs text-muted-foreground">
                Current authenticated security personnel and designated checkpoint terminal
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
              <span className="text-2xs font-mono text-muted-foreground">Officer Name</span>
              <p className="text-xs font-semibold text-foreground mt-0.5">{user?.name ?? '—'}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
              <span className="text-2xs font-mono text-muted-foreground">Badge / Identifier</span>
              <p className="text-xs font-semibold font-mono text-foreground mt-0.5">
                {user?.badgeId ?? '—'}
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
              <span className="text-2xs font-mono text-muted-foreground">Role Designation</span>
              <p className="text-xs font-semibold text-primary font-mono mt-0.5">{user?.role ?? '—'}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
              <span className="text-2xs font-mono text-muted-foreground">Assigned Station</span>
              <p className="text-xs font-semibold text-foreground mt-0.5">{user?.station ?? '—'}</p>
            </div>
          </div>

          {/* Quick Role Switcher for SIH Demonstration */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                SIH Role Switcher (Live Demo Evaluation)
              </span>
              <span className="text-[10px] font-mono text-primary font-semibold uppercase">
                RBAC Switcher
              </span>
            </div>
            <p className="text-2xs text-muted-foreground">
              Switch roles to inspect permission gates across Officer, Supervisor, Auditor, and Admin accounts.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {(['OFFICER', 'SUPERVISOR', 'AUDITOR', 'ADMIN'] as const).map((role) => (
                <Button
                  key={role}
                  variant={user?.role === role ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => handleRoleSwitch(role)}
                  className="text-xs"
                >
                  <span>{role}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Assigned Permissions Inspector */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 border border-primary/30 text-primary">
              <Lock className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Active Role Permissions</h3>
              <p className="text-2xs text-muted-foreground">
                Granular capabilities granted to your current session ({user?.role})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
            {permissions.map((perm: Permission) => (
              <div
                key={perm}
                className="flex items-center gap-2 p-2 rounded-lg border border-border bg-surface-muted/30 text-2xs font-mono text-foreground"
              >
                <CheckCircle2 className="size-3.5 text-risk-low shrink-0" />
                <span className="truncate">{perm}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Thresholds */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 border border-primary/30 text-primary">
              <Sliders className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Risk Decision Thresholds</h3>
              <p className="text-2xs text-muted-foreground">
                Calibrated aggregate risk classification bounds and recommended action mapping
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-risk-low/40 bg-risk-low/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-risk-low font-mono">LOW RISK</span>
                <span className="font-mono text-xs font-semibold text-foreground">0 – 29</span>
              </div>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Standard processing. No conclusive adverse forensics detected.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-risk-medium/40 bg-risk-medium/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-risk-medium font-mono">MEDIUM RISK</span>
                <span className="font-mono text-xs font-semibold text-foreground">30 – 59</span>
              </div>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Officer review recommended. Discrepancies or degraded capture quality observed.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-risk-high/40 bg-risk-high/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-risk-high font-mono">HIGH RISK</span>
                <span className="font-mono text-xs font-semibold text-foreground">60 – 100</span>
              </div>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Secondary verification required. Tampering, biometric mismatch, or flagged status.
              </p>
            </div>
          </div>
        </div>

        {/* Model Versions & AI Stacks */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 border border-primary/30 text-primary">
              <Cpu className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Sub-System Stacks & AI Models</h3>
              <p className="text-2xs text-muted-foreground">
                Active machine learning weights and deterministic rule version stamps
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
              <span className="text-2xs font-mono text-muted-foreground">OCR Engine</span>
              <p className="text-xs font-semibold text-foreground mt-0.5">PaddleOCR / Tesseract v2.4</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
              <span className="text-2xs font-mono text-muted-foreground">Forensics Detector</span>
              <p className="text-xs font-semibold text-foreground mt-0.5">ResNet-Forensics v3.0</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
              <span className="text-2xs font-mono text-muted-foreground">Face Verification</span>
              <p className="text-xs font-semibold text-foreground mt-0.5">FaceNet-512 Embedder v1.2</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-muted/30">
              <span className="text-2xs font-mono text-muted-foreground">Rule Engine</span>
              <p className="text-xs font-semibold text-foreground mt-0.5">ICAO-Doc9303 Ruleset v2.1</p>
            </div>
          </div>
        </div>

        {/* Demo Mode Management */}
        <div className="panel p-6 space-y-4 border-risk-high/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Demo Data Store Management</h3>
              <p className="text-2xs text-muted-foreground mt-0.5">
                Reset local simulation storage and reseed default SIH evaluation corpus
              </p>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleResetData}
              disabled={isResetting}
            >
              <RefreshCw className={cn('size-3.5 mr-1.5', isResetting && 'animate-spin')} />
              <span>{isResetting ? 'Reseeding...' : 'Reseed Demo Store'}</span>
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
