/** Seeded randomness so every glitch is reproducible (same seed + recipe = same text). */
export type Rng = () => number;

/** mulberry32 — tiny, fast, good enough for art. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
/** Integer around `mean` varying by ±jitter (0–1). */
export const vary = (rng: Rng, mean: number, jitter: number) => Math.max(0, Math.round(mean * (1 + (rng() * 2 - 1) * jitter)));
