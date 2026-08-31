/**
 * Deterministic pseudo-randomness.
 *
 * Demo fixtures must render identically on every load (and identically on the
 * server and the client), so nothing in the mock layer may call `Math.random`.
 */

/** mulberry32 — small, fast, good enough for fixture data. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string, for deriving seeds from IDs. */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function rngPick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function rngFloat(rng: () => number, min: number, max: number, digits = 3): number {
  const value = rng() * (max - min) + min;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
