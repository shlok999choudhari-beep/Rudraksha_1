'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Session gate for every authenticated route.
 *
 * This is a usability gate, not a security boundary: it keeps a signed-out
 * browser from staring at an empty console. The data itself is protected by the
 * bearer token on each request and by the backend's own checks.
 */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Waiting for `ready` matters — redirecting before the stored session has
    // been read would sign the officer out on every refresh.
    if (ready && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [ready, user, pathname, router]);

  if (!ready) return <BootScreen label="Restoring session" />;
  if (!user) return <BootScreen label="Redirecting to sign-in" />;

  return <AppShell>{children}</AppShell>;
}

function BootScreen({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <span className="relative grid size-12 place-items-center rounded-xl border border-primary/30 bg-primary/10">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <span className="absolute -inset-px animate-pulse-ring rounded-xl border border-primary/20" />
        </span>
        <p
          className="font-mono text-2xs uppercase tracking-[0.2em] text-muted-foreground"
          role="status"
        >
          {label}
        </p>
      </div>
    </div>
  );
}
