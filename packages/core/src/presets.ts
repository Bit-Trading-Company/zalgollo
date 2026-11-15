/** Named brush presets. Each is a recipe for `glitch()`; add one by adding an entry. */
import type { Counts } from './ops.js';
import type { PoolSpec } from './marks.js';

export interface Preset {
  label: string;
  description: string;
  counts: Counts;
  density?: number;
  jitter?: number;
  pool?: PoolSpec;
}

export const PRESETS: Record<string, Preset> = {
  whisper: { label: 'Whisper', description: 'A light dusting — still easy to read', counts: { above: 1, below: 1 }, density: 0.6, jitter: 0.6, pool: { sets: ['classic'] } },
  classic: { label: 'Classic zalgo', description: 'The familiar he-comes look', counts: { above: 5, middle: 1, below: 5 }, jitter: 0.6, pool: { sets: ['classic'] } },
  'he-comes': { label: 'He comes', description: 'Tall, dense and unreadable', counts: { above: 16, middle: 2, below: 16 }, jitter: 0.5, pool: { sets: ['classic'] } },
  crown: { label: 'Crown', description: 'Everything stacks upward', counts: { above: 10 }, jitter: 0.4 },
  drip: { label: 'Drip', description: 'Everything hangs below', counts: { below: 12 }, density: 0.9, jitter: 0.7 },
  strike: { label: 'Strike', description: 'Overlays slashed through each letter', counts: { middle: 2 }, jitter: 0.2, pool: { sets: ['classic'] } },
  halo: { label: 'Halo', description: 'A ring around every letter', counts: { enclose: 1 }, jitter: 0, pool: { sets: ['halos'] } },
  bridges: { label: 'Bridges', description: 'Double marks that span between letters', counts: { bridge: 2, above: 1, below: 1 }, jitter: 0.3 },
  letters: { label: 'Whispering letters', description: 'Tiny letters hovering over letters', counts: { above: 3 }, jitter: 0.5, pool: { sets: ['letters'] } },
  thai: { label: 'Thai tower', description: 'Thai tone marks: famously tall stacks', counts: { above: 14 }, jitter: 0.3, pool: { sets: ['thai'] } },
  monolith: { label: 'Monolith', description: 'Sparse, extremely tall spires', counts: { above: 40, below: 30 }, density: 0.25, jitter: 0.3 },
  static: { label: 'Static', description: 'Noise from every corner of Unicode — expect missing-glyph boxes', counts: { above: 3, below: 3, other: 2, middle: 1 }, jitter: 0.8, pool: { sets: ['all'] } },
  native: { label: 'Native', description: 'Each letter gets marks from its own script', counts: { above: 4, below: 4, other: 2 }, jitter: 0.5, pool: { native: true, sets: ['classic'] } },
  chaos: { label: 'Chaos', description: 'All zones, all sets, maximum damage', counts: { above: 24, middle: 3, below: 24, other: 4, enclose: 1, bridge: 1 }, jitter: 0.6, pool: { sets: ['all'] } },
};
