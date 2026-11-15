/**
 * Operations on documents. Every op is pure: (doc, options) => new doc.
 * Ops take an optional `range` [start, end) of cell indexes (default: whole doc) and an `rng`.
 */
import { cloneDoc, isBlank, type Cell, type Doc } from './doc.js';
import { nativePool, resolvePool, zoneOf, VISIBLE_ZONES, type Pool, type PoolSpec, type Zone } from './marks.js';
import { pick, vary, type Rng } from './rng.js';
import { SCRAMBLE_BLOCKS } from './data/blocks.js';
import { styleChar } from './styles.js';

export type Range = [start: number, end: number];
export type Counts = Partial<Record<Zone, number>>;

interface Common {
  range?: Range;
  rng?: Rng;
}

const span = (doc: Doc, range?: Range): Range => {
  const [a, b] = range ?? [0, doc.length];
  return [Math.max(0, Math.min(a, b)), Math.min(doc.length, Math.max(a, b))];
};

/** Pool for one cell, honouring native-script mode with a fallback to the general pool. */
function poolFor(cell: Cell, spec: PoolSpec, base: Pool, zone: Zone): number[] {
  if (spec.native) {
    const n = nativePool(cell.base ?? cell.ch)?.[zone];
    if (n?.length) return n;
  }
  return base[zone];
}

/** Set a zone of a cell to exactly `n` marks, reusing existing marks so live edits don't flicker. */
function setZoneCount(cell: Cell, zone: Zone, n: number, choices: number[], rng: Rng): Cell {
  const inZone = cell.marks.filter((m) => zoneOf(m) === zone);
  if (inZone.length === n) return cell;
  if (!choices.length && n > inZone.length) return cell;
  const keep = inZone.slice(0, n);
  while (keep.length < n) keep.push(pick(rng, choices));
  const others = cell.marks.filter((m) => zoneOf(m) !== zone);
  return { ...cell, marks: [...others, ...keep] };
}

export interface GlitchOptions extends Common {
  /** Average number of marks to add per zone. */
  counts: Counts;
  /** Fraction of cells affected (0–1). Default 1. */
  density?: number;
  /** Random variation of counts (0–1). Default 0.5. */
  jitter?: number;
  pool?: PoolSpec;
  /** "add" stacks on top of existing marks; "replace" sets the zones to the new counts. */
  mode?: 'add' | 'replace';
  /** Also glitch spaces. Default false. */
  includeSpaces?: boolean;
}

/** The classic zalgo operation: sprinkle random marks onto cells. */
export function glitch(doc: Doc, o: GlitchOptions): Doc {
  const rng = o.rng ?? Math.random;
  const spec = o.pool ?? {};
  const pool = resolvePool(spec);
  const density = o.density ?? 1;
  const jitter = o.jitter ?? 0.5;
  const [a, b] = span(doc, o.range);
  const out = cloneDoc(doc);
  for (let i = a; i < b; i++) {
    let cell = out[i]!;
    if ((!o.includeSpaces && isBlank(cell)) || cell.ch === '\n' || rng() > density) continue;
    for (const [zone, mean] of Object.entries(o.counts) as [Zone, number][]) {
      if (!mean) continue;
      const choices = poolFor(cell, spec, pool, zone);
      if (!choices.length) continue;
      const n = vary(rng, mean, jitter);
      if (o.mode === 'replace') cell = setZoneCount(cell, zone, n, choices, rng);
      else for (let k = 0; k < n; k++) cell = { ...cell, marks: [...cell.marks, pick(rng, choices)] };
    }
    out[i] = cell;
  }
  return out;
}

export interface ShapeOptions extends Common {
  /** Exact stack height per cell (index relative to range) for each zone. */
  heights: Partial<Record<Zone, number[]>>;
  pool?: PoolSpec;
  includeSpaces?: boolean;
}

/** Sketch: set stack heights per cell so the marks draw a silhouette. */
export function shape(doc: Doc, o: ShapeOptions): Doc {
  const rng = o.rng ?? Math.random;
  const spec = o.pool ?? {};
  const pool = resolvePool(spec);
  const [a, b] = span(doc, o.range);
  const out = cloneDoc(doc);
  for (let i = a; i < b; i++) {
    let cell = out[i]!;
    if ((!o.includeSpaces && isBlank(cell)) || cell.ch === '\n') continue;
    for (const [zone, hs] of Object.entries(o.heights) as [Zone, number[]][]) {
      const h = hs[i - a];
      if (h == null) continue;
      cell = setZoneCount(cell, zone, Math.max(0, Math.round(h)), poolFor(cell, spec, pool, zone), rng);
    }
    out[i] = cell;
  }
  return out;
}

/**
 * Replace marks with random marks from the same zone (same silhouette, new texture).
 * `probability` < 1 rerolls only a share of marks — a gentle simmer for animations.
 */
export function reroll(doc: Doc, o: Common & { pool?: PoolSpec; probability?: number } = {}): Doc {
  const rng = o.rng ?? Math.random;
  const spec = o.pool ?? {};
  const pool = resolvePool(spec);
  const [a, b] = span(doc, o.range);
  const out = cloneDoc(doc);
  for (let i = a; i < b; i++) {
    const cell = out[i]!;
    cell.marks = cell.marks.map((m) => {
      if (o.probability != null && rng() > o.probability) return m;
      const choices = poolFor(cell, spec, pool, zoneOf(m));
      return choices.length ? pick(rng, choices) : m;
    });
  }
  return out;
}

/** Remove marks (optionally only some zones). */
export function strip(doc: Doc, o: Common & { zones?: Zone[] } = {}): Doc {
  const [a, b] = span(doc, o.range);
  const zones = o.zones ? new Set(o.zones) : null;
  return doc.map((c, i) => (i < a || i >= b ? c : { ...c, marks: zones ? c.marks.filter((m) => !zones.has(zoneOf(m))) : [] }));
}

/** Add a specific mark `count` times to every cell in range (stAllio's "precise" mode). */
export function addMark(doc: Doc, cp: number, o: Common & { count?: number; includeSpaces?: boolean } = {}): Doc {
  const [a, b] = span(doc, o.range);
  const n = o.count ?? 1;
  return doc.map((c, i) =>
    i < a || i >= b || (!o.includeSpaces && isBlank(c)) || c.ch === '\n' ? c : { ...c, marks: [...c.marks, ...Array(n).fill(cp)] },
  );
}

/** Remove the last `count` marks of a zone (or any zone) from each cell — an eraser. */
export function erase(doc: Doc, o: Common & { count?: number; zone?: Zone } = {}): Doc {
  const [a, b] = span(doc, o.range);
  return doc.map((c, i) => {
    if (i < a || i >= b) return c;
    const marks = [...c.marks];
    for (let k = 0; k < (o.count ?? 1); k++) {
      const j = o.zone ? marks.map(zoneOf).lastIndexOf(o.zone) : marks.length - 1;
      if (j < 0) break;
      marks.splice(j, 1);
    }
    return { ...c, marks };
  });
}

/** Replace base glyphs with random characters from Unicode blocks (stAllio's "scramble"). */
export function scramble(doc: Doc, o: Common & { blocks?: string[]; probability?: number } = {}): Doc {
  const rng = o.rng ?? Math.random;
  const names = o.blocks?.length ? o.blocks : ['Runic'];
  const blocks = SCRAMBLE_BLOCKS.filter(([n]) => names.includes(n));
  if (!blocks.length) throw new Error(`Unknown block(s): ${names.join(', ')}`);
  const [a, b] = span(doc, o.range);
  const p = o.probability ?? 1;
  const graphic = /^[\p{L}\p{N}\p{S}\p{P}]$/u;
  return doc.map((c, i) => {
    if (i < a || i >= b || isBlank(c) || rng() > p) return c;
    for (let tries = 0; tries < 40; tries++) {
      const [, start, end] = pick(rng, blocks);
      const ch = String.fromCodePoint(start + Math.floor(rng() * (end - start + 1)));
      if (graphic.test(ch)) return { ...c, base: ch };
    }
    return c;
  });
}

/** Map base glyphs to a styled alphabet ("none" restores the plain text). */
export function style(doc: Doc, styleName: string, o: Common = {}): Doc {
  const [a, b] = span(doc, o.range);
  return doc.map((c, i) => {
    if (i < a || i >= b) return c;
    if (styleName === 'none') {
      const { base: _drop, ...rest } = c;
      return rest;
    }
    const s = styleChar(c.ch, styleName);
    return s === c.ch ? { ...c, base: undefined } : { ...c, base: s };
  });
}

/** Reverse the order of cells in range (pairs with the upside-down style). */
export function reverse(doc: Doc, o: Common = {}): Doc {
  const [a, b] = span(doc, o.range);
  return [...doc.slice(0, a), ...doc.slice(a, b).reverse(), ...doc.slice(b)];
}

/** Stack heights per zone for a range — what the Sketch panel draws. */
export function heights(doc: Doc, zone: Zone, range?: Range): number[] {
  const [a, b] = span(doc, range);
  return doc.slice(a, b).map((c) => c.marks.filter((m) => zoneOf(m) === zone).length);
}

export const visibleZones = VISIBLE_ZONES;

/** The first `k` (0–1) of every zone's stack — grows a finished piece from bare letters. */
export function grow(doc: Doc, k: number): Doc {
  return doc.map((c) => {
    const seen: Partial<Record<Zone, number>> = {};
    const total: Partial<Record<Zone, number>> = {};
    for (const m of c.marks) total[zoneOf(m)] = (total[zoneOf(m)] ?? 0) + 1;
    const marks = c.marks.filter((m) => {
      const z = zoneOf(m);
      seen[z] = (seen[z] ?? 0) + 1;
      return seen[z]! <= Math.round(total[z]! * k);
    });
    return { ...c, marks };
  });
}
