/**
 * Date & duration formatting.
 *
 * Everything here is pure and locale-pinned to `en-GB` (day-month-year, 24h) so
 * that server and client renders agree and officers across stations read the
 * same string. Timestamps arrive from the API as ISO-8601 strings.
 */

const DATE_LOCALE = 'en-GB';

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `27 Aug 2026` */
export function formatDate(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(DATE_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** `27 Aug` — for dense table columns. */
export function formatDateShort(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(DATE_LOCALE, { day: '2-digit', month: 'short' });
}

/** `14:32:07` */
export function formatTime(value: string | number | Date, withSeconds = true): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  });
}

/** `27 Aug 2026, 14:32` */
export function formatDateTime(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${formatDate(d)}, ${formatTime(d, false)}`;
}

/** Document-face style: `12 JAN 2000` — matches how passports print dates. */
export function formatDocumentDate(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  return d
    .toLocaleDateString(DATE_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

/** `3 min ago`, `2 h ago`, `just now`. Pass `now` to keep renders deterministic. */
export function formatRelative(value: string | number | Date, now: number = Date.now()): string {
  const d = toDate(value);
  if (!d) return '—';
  const diffSec = Math.round((now - d.getTime()) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 45) return 'just now';
  if (abs < 90) return diffSec > 0 ? '1 min ago' : 'in 1 min';

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ];

  let unit: Intl.RelativeTimeFormatUnit = 'minute';
  let divisor = 60;
  for (const [u, secs] of units) {
    if (abs >= secs) {
      unit = u;
      divisor = secs;
    }
  }
  const rtf = new Intl.RelativeTimeFormat(DATE_LOCALE, { numeric: 'auto' });
  return rtf.format(-Math.round(diffSec / divisor), unit);
}

/** `3.8 s`, `840 ms`, `1 m 12 s` — used for pipeline and stage timings. */
export function formatDuration(ms?: number | null): string {
  if (ms == null || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) {
    const s = ms / 1000;
    return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds ? `${minutes} m ${seconds} s` : `${minutes} m`;
}

/** ISO date for `<input type="date">`. */
export function toDateInputValue(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/** Days between two dates (positive when `to` is later). */
export function daysBetween(from: string | Date, to: string | Date): number {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function isExpired(expiryDate: string | Date, reference: Date = new Date()): boolean {
  const d = toDate(expiryDate);
  if (!d) return false;
  return d.getTime() < reference.getTime();
}
