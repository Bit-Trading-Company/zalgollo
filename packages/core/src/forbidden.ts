/**
 * "Forbidden" Unicode techniques applied to a compiled string: invisible weaves, bidi overrides,
 * invisible ink, blank characters and monumental glyphs. Each is a plain string transform.
 */
import { graphemes } from './doc.js';
import { MONUMENTS } from './data/names.js';
import type { Rng } from './rng.js';

export const INVISIBLES: Record<string, { char: string; label: string; description: string }> = {
  zwsp: { char: '​', label: 'Zero-width space', description: 'Allows line breaks anywhere; splits words for search engines' },
  zwnj: { char: '‌', label: 'Zero-width non-joiner', description: 'Stops letters from joining (Arabic, Indic, emoji)' },
  zwj: { char: '‍', label: 'Zero-width joiner', description: 'Asks neighbours to join — the glue inside 👩‍💻' },
  wj: { char: '⁠', label: 'Word joiner', description: 'Invisible and unbreakable' },
  cgj: { char: '͏', label: 'Combining grapheme joiner', description: 'A mark that is not there' },
  shy: { char: '­', label: 'Soft hyphen', description: 'Only shows up when a line breaks on it' },
};

export const BLANKS: Record<string, { char: string; label: string }> = {
  hangul: { char: 'ㅤ', label: 'Hangul filler — a "blank" that counts as a letter' },
  braille: { char: '⠀', label: 'Braille blank — an empty pattern of dots' },
  'half-hangul': { char: 'ﾠ', label: 'Halfwidth Hangul filler' },
  'em-space': { char: ' ', label: 'Em space' },
  'ideographic': { char: '　', label: 'Ideographic space' },
};

export const MONUMENT_CHARS: readonly string[] = MONUMENTS.map((cp) => String.fromCodePoint(cp));

/** Insert an invisible character between graphemes (density 0–1). */
export function weave(text: string, kind: keyof typeof INVISIBLES | string = 'zwsp', density = 1, rng: Rng = Math.random): string {
  const ch = INVISIBLES[kind]?.char ?? kind;
  const gs = graphemes(text);
  return gs.map((g, i) => (i < gs.length - 1 && g !== '\n' && rng() < density ? g + ch : g)).join('');
}

/**
 * Bidirectional tricks.
 * - "rlo": right-to-left override — the text renders backwards but copies forwards.
 * - "mirror": text followed by its RLO-reversed twin, a palindrome made of one string.
 * - "isolate": wrap in a first-strong isolate so glitch text can't flip its surroundings.
 */
export function bidi(text: string, mode: 'none' | 'rlo' | 'mirror' | 'isolate' = 'rlo'): string {
  if (mode === 'rlo') return `‮${text}‬`;
  if (mode === 'mirror') return `${text}‮${text}‬`;
  if (mode === 'isolate') return `⁨${text}⁩`;
  return text;
}

/**
 * Invisible ink: hide a message inside text using Unicode tag characters (ASCII only, U+E0020–E007E)
 * or variation selectors (any UTF-8, one selector per byte). The visible text is unchanged.
 * Use `revealInk` / `stripInvisible` to find or remove it.
 */
export function hideInk(carrier: string, message: string, method: 'tags' | 'variation' = 'variation'): string {
  let ink = '';
  if (method === 'tags') {
    for (const c of message) {
      const cp = c.codePointAt(0)!;
      if (cp < 0x20 || cp > 0x7e) throw new Error('Tag ink only supports printable ASCII; use the "variation" method');
      ink += String.fromCodePoint(0xe0000 + cp);
    }
  } else {
    for (const byte of new TextEncoder().encode(message)) ink += String.fromCodePoint(byte < 16 ? 0xfe00 + byte : 0xe0100 + byte - 16);
  }
  const gs = graphemes(carrier);
  if (!gs.length) return ink;
  return gs[0] + ink + gs.slice(1).join('');
}

/** Find hidden tag-character and variation-selector messages. */
export function revealInk(text: string): { method: 'tags' | 'variation'; message: string }[] {
  const found: { method: 'tags' | 'variation'; message: string }[] = [];
  const tags = text.match(/[\u{E0020}-\u{E007E}]+/gu);
  for (const run of tags ?? []) found.push({ method: 'tags', message: [...run].map((c) => String.fromCharCode(c.codePointAt(0)! - 0xe0000)).join('') });
  const vs = text.match(/[︀-️\u{E0100}-\u{E01EF}]{2,}/gu);
  for (const run of vs ?? []) {
    const bytes = [...run].map((c) => {
      const cp = c.codePointAt(0)!;
      return cp <= 0xfe0f ? cp - 0xfe00 : cp - 0xe0100 + 16;
    });
    found.push({ method: 'variation', message: new TextDecoder().decode(new Uint8Array(bytes)) });
  }
  return found;
}
