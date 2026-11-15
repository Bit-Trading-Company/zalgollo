/**
 * Shape generators for the Sketch tool: arrays of stack heights (0–1) across `n` cells.
 * Multiply by a max height to get mark counts. Add a shape by adding a function.
 */
import { seeded } from './rng.js';

export type ShapeFn = (n: number, seed?: number) => number[];

const at = (n: number, f: (t: number, i: number) => number) => Array.from({ length: n }, (_, i) => Math.max(0, Math.min(1, f(n > 1 ? i / (n - 1) : 0.5, i))));

export const SHAPES: Record<string, { label: string; fn: ShapeFn }> = {
  flat: { label: 'Flat', fn: (n) => at(n, () => 1) },
  wave: { label: 'Wave', fn: (n) => at(n, (t) => 0.5 + 0.5 * Math.sin(t * Math.PI * 4)) },
  ramp: { label: 'Ramp up', fn: (n) => at(n, (t) => t) },
  fade: { label: 'Fade out', fn: (n) => at(n, (t) => 1 - t) },
  mountain: { label: 'Mountain', fn: (n) => at(n, (t) => 1 - Math.abs(t - 0.5) * 2) },
  valley: { label: 'Valley', fn: (n) => at(n, (t) => Math.abs(t - 0.5) * 2) },
  dome: { label: 'Dome', fn: (n) => at(n, (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2))) },
  spikes: { label: 'Spikes', fn: (n) => at(n, (_t, i) => (i % 3 === 1 ? 1 : 0.12)) },
  heartbeat: { label: 'Heartbeat', fn: (n) => at(n, (_t, i) => [0.1, 0.1, 0.3, 1, 0.05, 0.5, 0.1, 0.1][i % 8]!) },
  skyline: {
    label: 'Skyline',
    fn: (n, seed = 7) => {
      const r = seeded(seed);
      const out: number[] = [];
      while (out.length < n) {
        const h = 0.2 + r() * 0.8;
        const w = 1 + Math.floor(r() * 3);
        for (let k = 0; k < w && out.length < n; k++) out.push(h);
      }
      return out;
    },
  },
  noise: { label: 'Noise', fn: (n, seed = 1) => { const r = seeded(seed); return at(n, () => r()); } },
  walk: {
    label: 'Random walk',
    fn: (n, seed = 3) => {
      const r = seeded(seed);
      let v = 0.5;
      return at(n, () => (v = Math.max(0, Math.min(1, v + (r() - 0.5) * 0.45))));
    },
  },
  equalizer: { label: 'Equalizer', fn: (n, seed = 5) => { const r = seeded(seed); return at(n, (t) => (0.3 + 0.7 * Math.abs(Math.sin(t * 9 + r()))) * (0.6 + 0.4 * r())); } },
};

/** Heights in marks: shape × max, optionally mirrored for the zone below. */
export function shapeHeights(name: string, n: number, max: number, seed?: number): number[] {
  const s = SHAPES[name];
  if (!s) throw new Error(`Unknown shape "${name}". Available: ${Object.keys(SHAPES).join(', ')}`);
  return s.fn(n, seed).map((v) => Math.round(v * max));
}
