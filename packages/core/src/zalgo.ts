/** One-call API: text in, glitch text out. Used by the REST API, MCP server and CLI. */
import { compile, parse, type Doc } from './doc.js';
import { bidi, hideInk, weave } from './forbidden.js';
import type { PoolSpec } from './marks.js';
import { glitch, reverse, scramble, shape, style, type Counts } from './ops.js';
import { PRESETS } from './presets.js';
import { randomSeed, seeded } from './rng.js';
import { shapeHeights } from './shapes.js';

export interface ZalgoOptions {
  /** Preset name (see PRESETS). Default "classic". */
  preset?: string;
  /** Override per-zone mark counts. */
  counts?: Counts;
  /** Scale all counts (e.g. 0.5 = half as intense). */
  intensity?: number;
  density?: number;
  jitter?: number;
  /** Mark sets (see MARK_SETS) — overrides the preset's. */
  sets?: string[];
  native?: boolean;
  /** Marks never to use (e.g. ones your fonts can't draw). */
  exclude?: number[];
  /** Sketch a silhouette: shape name (see SHAPES) with heights for above/below. */
  shape?: { name: string; above?: number; below?: number; seed?: number };
  /** Styled alphabet for the base letters (see STYLES). */
  style?: string;
  /** Replace letters with random characters from these blocks. */
  scramble?: { blocks: string[]; probability?: number };
  /** Forbidden finishes. */
  weave?: { kind: string; density?: number };
  bidi?: 'none' | 'rlo' | 'mirror' | 'isolate';
  ink?: { message: string; method?: 'tags' | 'variation' };
  /** Seed for reproducible output. Random if omitted. */
  seed?: number;
}

export interface ZalgoResult {
  text: string;
  doc: Doc;
  seed: number;
}

export function zalgoDoc(input: string | Doc, o: ZalgoOptions = {}): ZalgoResult {
  const seed = o.seed ?? randomSeed();
  const rng = seeded(seed);
  let doc = typeof input === 'string' ? parse(input) : input;
  if (o.style && o.style !== 'none') {
    doc = style(doc, o.style);
    if (o.style === 'upside-down') doc = reverse(doc);
  }
  if (o.scramble) doc = scramble(doc, { ...o.scramble, rng });
  const preset = PRESETS[o.preset ?? (o.shape ? '' : 'classic')];
  if (o.preset && !preset) throw new Error(`Unknown preset "${o.preset}". Available: ${Object.keys(PRESETS).join(', ')}`);
  const pool: PoolSpec = { ...preset?.pool, ...(o.sets ? { sets: o.sets } : {}), ...(o.native != null ? { native: o.native } : {}), ...(o.exclude ? { exclude: o.exclude } : {}) };
  const k = o.intensity ?? 1;
  const counts = Object.fromEntries(Object.entries({ ...preset?.counts, ...o.counts }).map(([z, n]) => [z, (n ?? 0) * k])) as Counts;
  if (Object.values(counts).some(Boolean)) {
    doc = glitch(doc, { counts, density: o.density ?? preset?.density, jitter: o.jitter ?? preset?.jitter, pool, rng });
  }
  if (o.shape) {
    const n = doc.length;
    doc = shape(doc, {
      heights: {
        ...(o.shape.above ? { above: shapeHeights(o.shape.name, n, o.shape.above, o.shape.seed) } : {}),
        ...(o.shape.below ? { below: shapeHeights(o.shape.name, n, o.shape.below, o.shape.seed) } : {}),
      },
      pool,
      rng,
    });
  }
  let text = compile(doc);
  if (o.weave) text = weave(text, o.weave.kind, o.weave.density ?? 1, rng);
  if (o.ink?.message) text = hideInk(text, o.ink.message, o.ink.method);
  if (o.bidi && o.bidi !== 'none') text = bidi(text, o.bidi);
  return { text, doc, seed };
}

/** Glitch text. `zalgo("hello")` → "h̷̢͎e̵͙͝l̶̩̓l̴̰̈́o̵̧͘" */
export const zalgo = (text: string, o: ZalgoOptions = {}) => zalgoDoc(text, o).text;
