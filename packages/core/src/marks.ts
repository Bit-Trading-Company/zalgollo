/** The combining-mark catalog: every Mn/Me character in Unicode, sorted into zones. */
import { MARK_BLOCKS, MARK_SCRIPTS, MARK_TABLE, UNICODE_VERSION } from './data/marks.js';

export { UNICODE_VERSION };

/** Where a mark draws relative to its base character. */
export type Zone = 'above' | 'middle' | 'below' | 'enclose' | 'bridge' | 'other' | 'invisible';
export const ZONES: readonly Zone[] = ['above', 'middle', 'below', 'enclose', 'bridge', 'other', 'invisible'];
/** Zones that stack visibly (excludes invisible). */
export const VISIBLE_ZONES: readonly Zone[] = ['above', 'middle', 'below', 'enclose', 'bridge', 'other'];

export const ZONE_INFO: Record<Zone, { label: string; description: string }> = {
  above: { label: 'Above', description: 'Stacks upward — accents, crowns, towers' },
  middle: { label: 'Through', description: 'Overlays that strike through the letter' },
  below: { label: 'Below', description: 'Stacks downward — drips, roots, rain' },
  enclose: { label: 'Enclose', description: 'Circles, squares, keycaps and halos around the letter' },
  bridge: { label: 'Bridge', description: 'Double marks that span to the next letter' },
  other: { label: 'Script', description: 'Script-specific vowel signs and points (Thai, Devanagari, Hebrew…)' },
  invisible: { label: 'Invisible', description: 'Variation selectors and joiners — no ink, but they count' },
};

export interface MarkInfo {
  cp: number;
  char: string;
  /** Canonical combining class (0–240). */
  ccc: number;
  zone: Zone;
  block: string;
  script: string;
}

const ZONE_CODES: Zone[] = ['above', 'middle', 'below', 'enclose', 'bridge', 'other', 'invisible'];

export const MARKS: readonly MarkInfo[] = MARK_TABLE.map(([cp, ccc, z, b, s]) => ({
  cp,
  char: String.fromCodePoint(cp),
  ccc,
  zone: ZONE_CODES[z]!,
  block: MARK_BLOCKS[b]!,
  script: MARK_SCRIPTS[s]!,
}));

const BY_CP = new Map(MARKS.map((m) => [m.cp, m]));
export const markInfo = (cp: number): MarkInfo | undefined => BY_CP.get(cp);
export const isMark = (cp: number) => BY_CP.has(cp);
export const zoneOf = (cp: number): Zone => BY_CP.get(cp)?.zone ?? 'other';

const inRanges = (ranges: [number, number][]) => (m: MarkInfo) => ranges.some(([a, b]) => m.cp >= a && m.cp <= b);

export interface MarkSet {
  label: string;
  description: string;
  test: (m: MarkInfo) => boolean;
}

/**
 * Named mark sets. "safe" sets render well in most fonts; the rest get progressively more cursed.
 * Add a set by adding an entry.
 */
export const MARK_SETS: Record<string, MarkSet> = {
  classic: { label: 'Classic', description: 'Combining Diacritical Marks (U+0300–036F) — the original zalgo set', test: inRanges([[0x300, 0x36f]]) },
  supplement: { label: 'Supplement', description: 'Combining Diacritical Marks Supplement', test: inRanges([[0x1dc0, 0x1dff]]) },
  extended: { label: 'Extended', description: 'Combining Diacritical Marks Extended', test: inRanges([[0x1ab0, 0x1aff]]) },
  symbols: { label: 'Symbols', description: 'Arrows, rings and keycaps for symbols (U+20D0–20FF)', test: inRanges([[0x20d0, 0x20ff]]) },
  half: { label: 'Half marks', description: 'Ligature halves that join across letters', test: inRanges([[0xfe20, 0xfe2f]]) },
  cyrillic: { label: 'Cyrillic', description: 'Titlos, enclosing millions and combining Cyrillic letters', test: inRanges([[0x483, 0x489], [0x2de0, 0x2dff], [0xa66f, 0xa67d], [0xa69e, 0xa69f]]) },
  letters: { label: 'Tiny letters', description: 'Combining small Latin letters a e i o u c d h m r t v x', test: inRanges([[0x363, 0x36f]]) },
  thai: { label: 'Thai tower', description: 'Thai vowels and tone marks — the infamous ด้้้้้้้ stacks', test: inRanges([[0xe31, 0xe31], [0xe34, 0xe3a], [0xe47, 0xe4e]]) },
  indic: { label: 'Indic', description: 'Devanagari, Bengali, Tamil… signs', test: (m) => ['Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Sinhala'].includes(m.script) },
  semitic: { label: 'Hebrew & Arabic', description: 'Points, cantillation and harakat', test: (m) => ['Hebrew', 'Arabic', 'Syriac', 'Thaana', 'Nko', 'Samaritan', 'Mandaic'].includes(m.script) },
  tibetan: { label: 'Tibetan', description: 'Subjoined letters and vowel signs that grow downward', test: (m) => m.script === 'Tibetan' },
  musical: { label: 'Musical', description: 'Combining musical symbols (stems, flags, tremolo)', test: inRanges([[0x1d165, 0x1d1ad], [0x1d242, 0x1d244]]) },
  halos: { label: 'Halos', description: 'Enclosing circle and the Cyrillic ring signs — the enclosures most fonts draw', test: inRanges([[0x20dd, 0x20dd], [0x488, 0x489]]) },
  enclosing: { label: 'Enclosing', description: 'Every enclosing mark: circles, squares, diamonds, keycaps', test: (m) => m.zone === 'enclose' },
  invisible: { label: 'Invisible', description: 'Variation selectors and the combining grapheme joiner', test: (m) => m.zone === 'invisible' },
  all: { label: 'Everything', description: `All ${MARKS.length} combining marks in Unicode — many render as tofu, that is the point`, test: (m) => m.zone !== 'invisible' },
};

/**
 * The default pool. Only the classic block renders reliably when many marks are mixed on one
 * letter: browsers shape a cluster with a single font, and system UI fonts (SF, Segoe) only
 * cover U+0300–036F. Other sets are opt-in.
 */
export const SAFE_SETS = ['classic'];

export interface PoolSpec {
  /** Named sets (see MARK_SETS). Default: SAFE_SETS. */
  sets?: string[];
  /** Extra code points to include. */
  include?: number[];
  /** Code points to exclude. */
  exclude?: number[];
  /** Prefer marks from the base character's own script (stAllio-style). */
  native?: boolean;
}

export type Pool = Record<Zone, number[]>;

const poolCache = new Map<string, Pool>();
export function resolvePool(spec: PoolSpec = {}): Pool {
  const key = JSON.stringify(spec);
  const hit = poolCache.get(key);
  if (hit) return hit;
  const sets = (spec.sets?.length ? spec.sets : SAFE_SETS).map((s) => {
    const set = MARK_SETS[s];
    if (!set) throw new Error(`Unknown mark set "${s}". Available: ${Object.keys(MARK_SETS).join(', ')}`);
    return set;
  });
  const exclude = new Set(spec.exclude ?? []);
  const include = new Set(spec.include ?? []);
  const pool = Object.fromEntries(ZONES.map((z) => [z, [] as number[]])) as Pool;
  for (const m of MARKS) {
    if (exclude.has(m.cp)) continue;
    if (include.has(m.cp) || sets.some((s) => s.test(m))) pool[m.zone].push(m.cp);
  }
  poolCache.set(key, pool);
  return pool;
}

/** Marks grouped by script, for "native" mode. */
const SCRIPT_POOLS = new Map<string, Pool>();
for (const m of MARKS) {
  if (m.script === 'Inherited' || m.script === 'Common') continue;
  let p = SCRIPT_POOLS.get(m.script);
  if (!p) SCRIPT_POOLS.set(m.script, (p = Object.fromEntries(ZONES.map((z) => [z, [] as number[]])) as Pool));
  p[m.zone].push(m.cp);
}

const scriptTests = [...SCRIPT_POOLS.keys()].flatMap((s) => {
  try {
    return [[s, new RegExp(`\\p{Script=${s}}`, 'u')] as const];
  } catch {
    return []; // script not known to this JS engine yet
  }
});
const scriptCache = new Map<string, string | null>();
/** The script of a base character, if it has its own combining marks. */
export function nativeScript(ch: string): string | null {
  let s = scriptCache.get(ch);
  if (s === undefined) {
    s = scriptTests.find(([, re]) => re.test(ch))?.[0] ?? null;
    scriptCache.set(ch, s);
  }
  return s;
}
export const nativePool = (ch: string): Pool | undefined => {
  const s = nativeScript(ch);
  return s ? SCRIPT_POOLS.get(s) : undefined;
};
