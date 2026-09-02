'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Layers,
  Mail,
  ScanFace,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { DEMO_MODE } from '@/lib/api/client';
import { DEMO_PASSWORD, DEMO_USERS } from '@/lib/api/auth';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/types/user';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:flex-row">
      <BrandPanel />
      <Suspense fallback={null}>
        <SignInPanel />
      </Suspense>
    </div>
  );
}

/* --------------------------------------------------------------------------- */
/* Left: what this system is, and what it is not                              */
/* --------------------------------------------------------------------------- */

const CAPABILITIES = [
  {
    icon: Layers,
    title: 'Deterministic checks, separately reported',
    body: 'Format, expiry, MRZ check digits and field consistency are evaluated by fixed rules and shown on their own.',
  },
  {
    icon: Sparkles,
    title: 'Forensic and biometric signals',
    body: 'Tampering indicators, face similarity and liveness are probabilistic — always presented with their confidence.',
  },
  {
    icon: ScanFace,
    title: 'Explainable risk, officer decision',
    body: 'Every contribution to the risk score is itemised so the officer can inspect it and decide.',
  },
];

function BrandPanel() {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden border-b border-border bg-surface px-6 py-10 lg:w-[54%] lg:border-b-0 lg:border-r lg:px-14 lg:py-14">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-radial-fade" aria-hidden />

      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg border border-border-strong bg-surface-raised text-foreground">
            <ShieldCheck className="size-5 text-foreground" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight text-foreground">
              VeriGuard
            </p>
            <p className="font-mono text-2xs uppercase tracking-[0.16em] text-muted-foreground">
              Officer Console
            </p>
          </div>
        </div>

        <h1 className="mt-10 max-w-xl text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground lg:mt-14 lg:text-[2rem]">
          Identity and document integrity screening,{' '}
          <span className="text-foreground underline decoration-border-strong underline-offset-8">built for the officer who decides.</span>
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
          VeriGuard assembles document, forensic and biometric evidence into one reviewable case
          file. It reports risk and shows its reasoning. It does not admit, refuse, or accuse
          anyone.
        </p>

        <ul className="mt-9 max-w-lg space-y-4 lg:mt-11">
          {CAPABILITIES.map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border-strong bg-surface-raised text-foreground">
                <item.icon className="size-4 text-foreground" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium leading-snug text-foreground">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/*
        Stated on the sign-in screen, before anyone sees a score. The system is a
        prototype for evaluation; presenting it as a validated fraud detector
        would be the single most misleading thing this interface could do.
      */}
      <p className="relative mt-10 max-w-lg rounded-lg border border-border bg-surface-muted/70 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Prototype — decision support only.</span>{' '}
        Risk bands and thresholds are illustrative and have not been validated against operational
        data. Outputs are evidence for human review, never an automated determination.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------------- */
/* Right: the form                                                            */
/* --------------------------------------------------------------------------- */

function SignInPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signingIn, error, clearError, user, ready } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const nextPath = searchParams.get('next');
  const destination = nextPath && nextPath.startsWith('/') ? nextPath : '/dashboard';

  // Someone arriving with a live session should not have to sign in again.
  useEffect(() => {
    if (ready && user) router.replace(destination);
  }, [ready, user, destination, router]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await signIn({ email: email.trim(), password });
      router.replace(destination);
    } catch {
      // The provider already holds the message; the alert below renders it.
    }
  };

  const fillDemoAccount = (accountEmail: string) => {
    clearError();
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-10">
      <div className="w-full max-w-sm">
        <p className="section-label">Officer sign-in</p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
          Access the console
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Use your station credentials. Every action you take is recorded in the audit trail.
        </p>

        {nextPath && !error && (
          <Alert variant="info" className="mt-5">
            Sign in to continue to <span className="font-mono text-foreground">{nextPath}</span>.
          </Alert>
        )}

        {error && (
          <Alert variant="danger" title="Sign-in unsuccessful" className="mt-5">
            {error}
          </Alert>
        )}

        {/* Quick 1-Click Demo Login for Video / Demo */}
        <div className="mt-5">
          <button
            type="button"
            onClick={async () => {
              clearError();
              try {
                await signIn({ email: 'officer@veriguard.demo', password: DEMO_PASSWORD });
                router.replace(destination);
              } catch (err) {
                console.error(err);
              }
            }}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-md shadow-emerald-900/30 transition-all duration-200 cursor-pointer active:scale-[0.99] border border-emerald-400/30"
          >
            <Sparkles className="size-4 animate-pulse text-emerald-200" />
            <span>🚀 Quick Demo Login (Insp. Priya Sharma)</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <Field label="Email" htmlFor="email" required>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) clearError();
                }}
                placeholder="officer@veriguard.demo"
                className="pl-9"
              />
            </div>
          </Field>

          <Field label="Password" htmlFor="password" required>
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) clearError();
                }}
                placeholder="••••••••"
                className="pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </Field>

          <Button
            type="submit"
            block
            size="lg"
            loading={signingIn}
            icon={<ArrowRight className="size-4" />}
            disabled={!email || !password}
          >
            {signingIn ? 'Signing in' : 'Sign in'}
          </Button>
        </form>

        {DEMO_MODE && <DemoAccounts onPick={fillDemoAccount} activeEmail={email} />}

        <p className="mt-8 flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground">
          <Fingerprint className="mt-px size-3.5 shrink-0" aria-hidden />
          Biometric templates and raw captures stay on the server. This console receives only the
          comparison outcomes it needs to display.
        </p>
      </div>
    </div>
  );
}

function DemoAccounts({
  onPick,
  activeEmail,
}: {
  onPick: (email: string) => void;
  activeEmail: string;
}) {
  return (
    <div className="mt-8 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">Demonstration accounts</p>
        <span className="rounded border border-risk-medium/30 bg-risk-medium/10 px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-risk-medium">
          Demo mode
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Each role sees a different console. Pick one to fill the form — the shared password is{' '}
        <span className="font-mono text-foreground">{DEMO_PASSWORD}</span>.
      </p>
      <div className="mt-3 grid gap-1.5">
        {DEMO_USERS.map((account) => {
          const selected = activeEmail.toLowerCase() === account.email.toLowerCase();
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onPick(account.email)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                selected
                  ? 'border-foreground/70 bg-surface-raised'
                  : 'border-border bg-surface-muted hover:border-border-strong hover:bg-surface-raised',
              )}
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full border font-mono text-2xs font-semibold',
                  selected
                    ? 'border-foreground/80 bg-foreground text-background'
                    : 'border-border-strong bg-surface text-muted-foreground',
                )}
              >
                {account.avatarInitials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium leading-tight text-foreground">
                  {ROLE_LABELS[account.role]}
                  <span className="ml-1.5 font-normal text-muted-foreground">{account.name}</span>
                </span>
                <span className="block truncate text-2xs leading-tight text-muted-foreground">
                  {ROLE_DESCRIPTIONS[account.role]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
