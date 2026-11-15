/**
 * The Zalgollo document: text as an editable list of cells.
 *
 *   "zal" ─► [ {ch:"z", marks:[0x301,0x316]}, {ch:"a", marks:[]}, {ch:"l", marks:[0x334]} ]
 *
 * A cell is one grapheme: the plain character the user typed (`ch`), an optional replacement
 * glyph (`base`, set by styles/scramble) and the combining marks stacked on it, in order.
 * `compile()` turns a document into the final Unicode string; `parse()` turns any string —
 * including existing zalgo text — back into a document.
 */
import { isMark, zoneOf, type Zone } from './marks.js';

export interface Cell {
  /** The plain grapheme (what the user typed). */
  ch: string;
  /** Replacement glyph shown instead of `ch` (styled alphabet, scramble…). */
  base?: string;
  /** Combining mark code points, in output order. */
  marks: number[];
}

export type Doc = Cell[];

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Split text into grapheme clusters. */
export function graphemes(text: string): string[] {
  if (segmenter) return [...segmenter.segment(text)].map((s) => s.segment);
  // fallback: base + following marks
  return text.match(/\P{M}\p{M}*|\p{M}+/gu) ?? [];
}

const VS = new Set([0xfe0e, 0xfe0f]);

/** Split one grapheme into its base and trailing combining marks. */
export function splitGrapheme(g: string): Cell {
  const cps = [...g].map((c) => c.codePointAt(0)!);
  // a run of marks with no base (e.g. marks at the very start of the text)
  if (cps.every(isMark)) return { ch: '', marks: cps };
  let end = cps.length;
  while (end > 1 && isMark(cps[end - 1]!)) end--;
  // keep emoji/text presentation selectors with the base
  while (end < cps.length && VS.has(cps[end]!)) end++;
  const base = String.fromCodePoint(...cps.slice(0, end));
  const marks = cps.slice(end);
  // styled letters (𝔷, Ⓩ, ｚ…) fold back to plain ones, so they stay editable and un-stylable
  const folded = base.normalize('NFKC');
  if (folded !== base && /^[\p{L}\p{N}]$/u.test(folded)) return { ch: folded, base, marks };
  return { ch: base, marks };
}

/** Parse any text (plain or already-glitched) into a document. */
export function parse(text: string): Doc {
  return graphemes(text).map(splitGrapheme);
}

/** The plain text of a document (what the user typed). */
export const plainText = (doc: Doc) => doc.map((c) => c.ch).join('');

const isRegional = (s: string | undefined) => !!s && /^[\u{1F1E6}-\u{1F1FF}]$/u.test(s);

/** Compile a document to its final Unicode string. */
export function compile(doc: Doc): string {
  let out = '';
  for (let i = 0; i < doc.length; i++) {
    const c = doc[i]!;
    const glyph = c.base ?? c.ch;
    out += glyph;
    for (const m of c.marks) out += String.fromCodePoint(m);
    // two adjacent regional-indicator letters would fuse into a flag emoji: keep them apart
    if (isRegional(glyph) && isRegional(doc[i + 1]?.base ?? doc[i + 1]?.ch)) out += '‌';
  }
  return out;
}

export const cloneDoc = (doc: Doc): Doc => doc.map((c) => ({ ...c, marks: [...c.marks] }));

/**
 * Update a document after the plain text changed, keeping the marks of every cell that
 * survived the edit (common prefix + suffix). Typing never wipes your work.
 * Returns the new document and the range of newly inserted cells.
 */
export function edit(doc: Doc, text: string): { doc: Doc; inserted: [number, number] } {
  const next = parse(text);
  let p = 0;
  while (p < doc.length && p < next.length && doc[p]!.ch === next[p]!.ch) p++;
  let s = 0;
  while (s < doc.length - p && s < next.length - p && doc[doc.length - 1 - s]!.ch === next[next.length - 1 - s]!.ch) s++;
  const keep = (c: Cell, fresh: Cell): Cell => (fresh.marks.length ? { ...c, marks: [...c.marks, ...fresh.marks] } : c);
  return {
    doc: [
      ...doc.slice(0, p).map((c, i) => keep(c, next[i]!)),
      ...next.slice(p, next.length - s),
      ...doc.slice(doc.length - s).map((c, i) => keep(c, next[next.length - s + i]!)),
    ],
    inserted: [p, next.length - s],
  };
}

export const reconcile = (doc: Doc, text: string): Doc => edit(doc, text).doc;

export const isBlank = (c: Cell) => !c.ch.trim();

/** Marks of a cell grouped by zone. */
export function zonesOf(cell: Cell): Record<Zone, number[]> {
  const out = { above: [], middle: [], below: [], enclose: [], bridge: [], other: [], invisible: [] } as Record<Zone, number[]>;
  for (const m of cell.marks) out[zoneOf(m)].push(m);
  return out;
}

export interface DocStats {
  cells: number;
  marks: number;
  /** tallest stack above any single letter */
  maxAbove: number;
  maxBelow: number;
}

export function docStats(doc: Doc): DocStats {
  let marks = 0;
  let maxAbove = 0;
  let maxBelow = 0;
  for (const c of doc) {
    marks += c.marks.length;
    let a = 0;
    let b = 0;
    for (const m of c.marks) {
      const z = zoneOf(m);
      if (z === 'above') a++;
      else if (z === 'below') b++;
    }
    maxAbove = Math.max(maxAbove, a);
    maxBelow = Math.max(maxBelow, b);
  }
  return { cells: doc.length, marks, maxAbove, maxBelow };
}
