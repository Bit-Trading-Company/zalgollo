/** X-ray: break any text into code points with names, and clean it up. */
import { NAMES } from './data/names.js';
import { graphemes } from './doc.js';
import { markInfo, zoneOf, type Zone } from './marks.js';

const CATEGORIES: [RegExp, string][] = [
  [/\p{Lu}/u, 'Uppercase letter'],
  [/\p{Ll}/u, 'Lowercase letter'],
  [/\p{L}/u, 'Letter'],
  [/\p{Mn}/u, 'Combining mark'],
  [/\p{Me}/u, 'Enclosing mark'],
  [/\p{Mc}/u, 'Spacing mark'],
  [/\p{N}/u, 'Number'],
  [/\p{P}/u, 'Punctuation'],
  [/\p{Sm}/u, 'Math symbol'],
  [/\p{So}/u, 'Symbol'],
  [/\p{S}/u, 'Symbol'],
  [/\p{Zs}/u, 'Space'],
  [/\p{Z}/u, 'Separator'],
  [/\p{Cf}/u, 'Format (invisible)'],
  [/\p{Cc}/u, 'Control'],
  [/\p{Co}/u, 'Private use'],
  [/\p{Cn}/u, 'Unassigned'],
];

export const categoryOf = (ch: string) => CATEGORIES.find(([re]) => re.test(ch))?.[1] ?? 'Other';

const INVISIBLE = /[\p{Cf}\p{Zl}\p{Zp}͏ᅟᅠㅤﾠ⠀︀-️\u{E0100}-\u{E01EF}\u{E0000}-\u{E007F}]/u;

export interface CodePointInfo {
  cp: number;
  hex: string;
  char: string;
  name: string;
  category: string;
  zone?: Zone;
  invisible: boolean;
}

export function describe(cp: number): CodePointInfo {
  const char = String.fromCodePoint(cp);
  const m = markInfo(cp);
  return {
    cp,
    hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
    char,
    name: NAMES[cp] ?? (/\p{Script=Han}/u.test(char) ? `CJK UNIFIED IDEOGRAPH-${cp.toString(16).toUpperCase()}` : ''),
    category: categoryOf(char),
    zone: m ? zoneOf(cp) : undefined,
    invisible: INVISIBLE.test(char),
  };
}

export interface TextStats {
  graphemes: number;
  codePoints: number;
  /** JavaScript / UTF-16 length — what most "character limits" count. */
  utf16: number;
  utf8Bytes: number;
  marks: number;
  invisible: number;
  /** Most combining marks on a single grapheme. */
  maxStack: number;
}

export function stats(text: string): TextStats {
  const cps = [...text];
  let marks = 0;
  let invisible = 0;
  for (const c of cps) {
    if (/\p{M}/u.test(c)) marks++;
    if (INVISIBLE.test(c)) invisible++;
  }
  const gs = graphemes(text);
  return {
    graphemes: gs.length,
    codePoints: cps.length,
    utf16: text.length,
    utf8Bytes: new TextEncoder().encode(text).length,
    marks,
    invisible,
    maxStack: gs.reduce((m, g) => Math.max(m, [...g].filter((c) => /\p{M}/u.test(c)).length), 0),
  };
}

/** Every code point with its name, grouped by grapheme. */
export function inspect(text: string, limit = 5000): { stats: TextStats; graphemes: { text: string; codePoints: CodePointInfo[] }[]; truncated: boolean } {
  let count = 0;
  const out: { text: string; codePoints: CodePointInfo[] }[] = [];
  for (const g of graphemes(text)) {
    if (count >= limit) break;
    const cps = [...g].map((c) => describe(c.codePointAt(0)!));
    count += cps.length;
    out.push({ text: g, codePoints: cps });
  }
  return { stats: stats(text), graphemes: out, truncated: count >= limit };
}

export interface CleanOptions {
  /** Remove combining marks. Default true. */
  marks?: boolean;
  /** Remove invisible/format characters (zero-width, bidi, tags, variation selectors). Default true. */
  invisible?: boolean;
  /** Unicode normalization. NFKC also folds styled alphabets (𝐛𝐨𝐥𝐝 → bold). Default "NFKC". */
  normalize?: 'NFC' | 'NFKC' | 'none';
}

/** Turn glitch text back into plain text. */
export function clean(text: string, o: CleanOptions = {}): string {
  let s = text;
  if (o.invisible !== false) s = s.replace(new RegExp(INVISIBLE.source, 'gu'), '');
  // decompose first so precomposed accents (é) are split and stripped too
  if (o.marks !== false) s = s.normalize('NFD').replace(/\p{M}/gu, '');
  if (o.normalize !== 'none') s = s.normalize(o.normalize ?? 'NFKC');
  return s;
}

export const stripInvisible = (text: string) => clean(text, { marks: false, invisible: true, normalize: 'none' });
