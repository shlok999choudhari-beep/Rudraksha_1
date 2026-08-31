/** Number, string and identity formatting helpers. */

const NUMBER_LOCALE = 'en-IN';

/** `1,284` — grouped per the Indian numbering system. */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString(NUMBER_LOCALE);
}

/** `96.4%` from `0.964`. */
export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction == null || Number.isNaN(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** `96%` from `0.964` — for dense badges. */
export function formatPercentCompact(fraction: number | null | undefined): string {
  if (fraction == null || Number.isNaN(fraction)) return '—';
  return `${Math.round(fraction * 100)}%`;
}

/** `20/30` for risk-breakdown rows. */
export function formatScorePair(score: number, maxScore: number): string {
  return `${Math.round(score)}/${Math.round(maxScore)}`;
}

/** `2.4 MB` */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/** `1654 × 1122 px` */
export function formatResolution(width: number, height: number): string {
  return `${width} × ${height} px`;
}

/**
 * Group a document number for legibility without altering its value:
 * `X1234567` -> `X123 4567`.
 */
export function formatDocumentNumber(value?: string | null): string {
  if (!value) return '—';
  const clean = value.replace(/\s+/g, '').toUpperCase();
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)} ${clean.slice(4)}`;
}

/** MRZ lines are fixed-width; pad so both lines align in the monospace block. */
export function padMrzLine(line: string, width = 44): string {
  return line.padEnd(width, '<');
}

/** `JOHN DOE` -> `JD` */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Turn `REVIEW_REQUIRED` into `Review Required`. */
export function humanizeToken(token: string): string {
  return token
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** Truncate in the middle, keeping both ends readable. */
export function truncateMiddle(value: string, max = 28): string {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

/** `+12.4%` / `-3.1%` — signed delta for KPI cards. */
export function formatDelta(delta: number | null | undefined, digits = 1): string | null {
  if (delta == null || Number.isNaN(delta)) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(digits)}%`;
}

/** Clamp to `[min, max]`. */
export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}
