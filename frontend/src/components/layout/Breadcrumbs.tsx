'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { SEGMENT_LABELS } from './navigation';

/**
 * Path-derived breadcrumb trail.
 *
 * Case identifiers are passed through verbatim in monospace rather than being
 * prettified — an officer reading a case reference needs the exact string.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const known = SEGMENT_LABELS[segment];
    return {
      href,
      label: known ?? segment,
      isIdentifier: !known,
      isLast: index === segments.length - 1,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 md:flex bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-peach-200/80 shadow-xs">
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
          {crumb.isLast ? (
            <span
              aria-current="page"
              className={
                crumb.isIdentifier
                  ? 'truncate font-mono text-xs font-bold text-peach-950'
                  : 'truncate text-xs font-bold text-foreground'
              }
            >
              {crumb.label}
            </span>
          ) : (
            <>
              <Link
                href={crumb.href}
                className={
                  crumb.isIdentifier
                    ? 'truncate font-mono text-xs text-muted-foreground transition-colors hover:text-peach-700'
                    : 'truncate text-xs text-muted-foreground transition-colors hover:text-peach-700'
                }
              >
                {crumb.label}
              </Link>
              <ChevronRight className="size-3 shrink-0 text-peach-400" aria-hidden />
            </>
          )}
        </span>
      ))}
    </nav>
  );
}
