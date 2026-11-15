#!/usr/bin/env node
/**
 * Generates Zalgollo's Unicode tables from the official Unicode Character Database (UCD).
 *
 *   node scripts/build-unicode.mjs            # downloads UCD (latest) into .cache/ucd once
 *
 * Outputs (committed, so builds don't need the network):
 *   packages/core/src/data/marks.ts   every combining mark (Mn/Me) with its zone, block and script
 *   packages/core/src/data/names.ts   character names for marks, format/space chars and specials
 *   packages/core/src/data/styles.ts  styled alphabets (math bold, fraktur, circled, …) derived from names
 *   packages/core/src/data/blocks.ts  block ranges used by "scramble"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache/ucd');
const OUT = path.join(ROOT, 'packages/core/src/data');
const UCD = 'https://www.unicode.org/Public/UCD/latest/ucd/';

async function ucd(file) {
  const p = path.join(CACHE, file);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const res = await fetch(UCD + file);
    if (!res.ok) throw new Error(`fetch ${file}: ${res.status}`);
    fs.writeFileSync(p, await res.text());
  }
  return fs.readFileSync(p, 'utf8');
}

const hex = (s) => Number.parseInt(s, 16);
const readme = await ucd('ReadMe.txt');
const VERSION = readme.match(/version (\d+\.\d+\.\d+)/)?.[1] ?? 'unknown';

// ── UnicodeData.txt ─────────────────────────────────────────────
const chars = new Map(); // cp -> { name, gc, ccc }
for (const line of (await ucd('UnicodeData.txt')).split('\n')) {
  if (!line) continue;
  const f = line.split(';');
  const cp = hex(f[0]);
  let name = f[1];
  if (name.startsWith('<')) {
    if (name === '<control>' && f[10]) name = f[10];
    else continue; // ranges (CJK, Hangul…) – not needed by name
  }
  chars.set(cp, { name, gc: f[2], ccc: Number(f[3]) });
}

// ── Blocks.txt / Scripts.txt ────────────────────────────────────
const blocks = [];
for (const line of (await ucd('Blocks.txt')).split('\n')) {
  const m = line.match(/^([0-9A-F]+)\.\.([0-9A-F]+); (.+)$/);
  if (m) blocks.push({ start: hex(m[1]), end: hex(m[2]), name: m[3].trim() });
}
const blockOf = (cp) => blocks.findIndex((b) => cp >= b.start && cp <= b.end);
const scriptRanges = [];
for (const line of (await ucd('Scripts.txt')).split('\n')) {
  const m = line.match(/^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*; (\w+)/);
  if (m) scriptRanges.push([hex(m[1]), hex(m[2] ?? m[1]), m[3]]);
}
const scriptOf = (cp) => scriptRanges.find(([a, b]) => cp >= a && cp <= b)?.[2] ?? 'Unknown';

// ── Marks & zones ───────────────────────────────────────────────
// zone codes: 0 above · 1 middle (overlay) · 2 below · 3 enclose · 4 bridge (spans two chars) · 5 other · 6 invisible
const ABOVE = new Set([230, 232, 228, 214, 216, 8, 27, 28, 30, 31, 33, 34, 35, 36, 19, 23, 24, 25, 26, 107, 122, 130]);
const BELOW = new Set([220, 218, 222, 202, 240, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 29, 32, 103, 118, 132]);
const MIDDLE = new Set([1, 21]);
const BRIDGE = new Set([233, 234]);
function zoneOf(cp, { name, gc, ccc }) {
  if (/VARIATION SELECTOR|GRAPHEME JOINER/.test(name)) return 6;
  if (gc === 'Me') return 3;
  if (BRIDGE.has(ccc)) return 4;
  if (ABOVE.has(ccc)) return 0;
  if (BELOW.has(ccc)) return 2;
  if (MIDDLE.has(ccc)) return 1;
  if (/\bABOVE\b|\bTOP\b|SUPERSCRIPT|CANDRABINDU/.test(name)) return 0;
  if (/\bBELOW\b|\bBOTTOM\b|SUBJOINED|SUBSCRIPT/.test(name)) return 2;
  if (/OVERLAY|STROKE|THROUGH/.test(name)) return 1;
  return 5;
}

const usedBlocks = [];
const usedScripts = [];
const idx = (arr, v) => {
  let i = arr.indexOf(v);
  if (i < 0) i = arr.push(v) - 1;
  return i;
};
const marks = [];
const names = {};
for (const [cp, c] of chars) {
  if (c.gc !== 'Mn' && c.gc !== 'Me') continue;
  const b = blockOf(cp);
  marks.push([cp, c.ccc, zoneOf(cp, c), idx(usedBlocks, blocks[b]?.name ?? 'Unknown'), idx(usedScripts, scriptOf(cp))]);
  names[cp] = c.name;
}
marks.sort((a, b) => a[0] - b[0]);

// names for format/space/separator chars, ASCII, Latin-1 and the specials below
for (const [cp, c] of chars) {
  if (['Cf', 'Zs', 'Zl', 'Zp', 'Cc'].includes(c.gc) || cp < 0x250) names[cp] = c.name;
}
// "Monuments": famously huge / UI-breaking glyphs, inserted from the Forbidden panel.
const MONUMENTS = [0xfdfd, 0x1242b, 0x12219, 0x1219c, 0xa9c5, 0x0bf5, 0x0bf8, 0x0bfa, 0x1f75, 0x2e3b, 0x2e3a, 0x0e5b, 0x0f12, 0x0f3a, 0x0f3b, 0xa9c1, 0xa9c2, 0x13000, 0x13080, 0x130b8, 0x1f4af, 0x2a6d6, 0x16a5, 0x1d11e, 0x2593, 0xfffd, 0x1f601, 0x0d4e, 0x0cb0, 0x0bf7];
for (const cp of MONUMENTS) if (chars.has(cp)) names[cp] = chars.get(cp).name;

// ── Styled alphabets from names ─────────────────────────────────
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
const styles = {};
const put = (style, ch, cp) => ((styles[style] ??= {})[ch] ??= String.fromCodePoint(cp));
const MATH_STYLE = {
  BOLD: 'bold', ITALIC: 'italic', 'BOLD ITALIC': 'bold-italic', SCRIPT: 'script', 'BOLD SCRIPT': 'bold-script',
  FRAKTUR: 'fraktur', 'BOLD FRAKTUR': 'bold-fraktur', 'DOUBLE-STRUCK': 'double-struck', 'SANS-SERIF': 'sans',
  'SANS-SERIF BOLD': 'sans-bold', 'SANS-SERIF ITALIC': 'sans-italic', 'SANS-SERIF BOLD ITALIC': 'sans-bold-italic', MONOSPACE: 'monospace',
};
const LETTERLIKE = { SCRIPT: 'script', 'BLACK-LETTER': 'fraktur', 'DOUBLE-STRUCK': 'double-struck' };
for (const [cp, { name }] of chars) {
  let m;
  if ((m = name.match(/^MATHEMATICAL (.+) (CAPITAL|SMALL) ([A-Z])$/)) && MATH_STYLE[m[1]]) put(MATH_STYLE[m[1]], m[2] === 'CAPITAL' ? m[3] : m[3].toLowerCase(), cp);
  else if ((m = name.match(/^MATHEMATICAL (.+) DIGIT (\w+)$/)) && MATH_STYLE[m[1]]) put(MATH_STYLE[m[1]], String(DIGITS.indexOf(m[2])), cp);
  else if ((m = name.match(/^(SCRIPT|BLACK-LETTER|DOUBLE-STRUCK) (CAPITAL|SMALL) ([A-Z])$/))) put(LETTERLIKE[m[1]], m[2] === 'CAPITAL' ? m[3] : m[3].toLowerCase(), cp);
  else if ((m = name.match(/^CIRCLED LATIN (CAPITAL|SMALL) LETTER ([A-Z])$/))) put('circled', m[1] === 'CAPITAL' ? m[2] : m[2].toLowerCase(), cp);
  else if ((m = name.match(/^CIRCLED DIGIT (\w+)$/)) && DIGITS.includes(m[1])) put('circled', String(DIGITS.indexOf(m[1])), cp);
  else if ((m = name.match(/^NEGATIVE CIRCLED LATIN CAPITAL LETTER ([A-Z])$/))) { put('circled-negative', m[1], cp); put('circled-negative', m[1].toLowerCase(), cp); }
  else if ((m = name.match(/^DINGBAT NEGATIVE CIRCLED DIGIT (\w+)$/)) && DIGITS.includes(m[1])) put('circled-negative', String(DIGITS.indexOf(m[1])), cp);
  else if ((m = name.match(/^SQUARED LATIN CAPITAL LETTER ([A-Z])$/))) { put('squared', m[1], cp); put('squared', m[1].toLowerCase(), cp); }
  else if ((m = name.match(/^NEGATIVE SQUARED LATIN CAPITAL LETTER ([A-Z])$/))) { put('squared-negative', m[1], cp); put('squared-negative', m[1].toLowerCase(), cp); }
  else if ((m = name.match(/^PARENTHESIZED LATIN SMALL LETTER ([A-Z])$/))) { put('parenthesized', m[1].toLowerCase(), cp); put('parenthesized', m[1], cp); }
  else if ((m = name.match(/^FULLWIDTH LATIN (CAPITAL|SMALL) LETTER ([A-Z])$/))) put('fullwidth', m[1] === 'CAPITAL' ? m[2] : m[2].toLowerCase(), cp);
  else if ((m = name.match(/^FULLWIDTH DIGIT (\w+)$/))) put('fullwidth', String(DIGITS.indexOf(m[1])), cp);
  else if ((m = name.match(/^REGIONAL INDICATOR SYMBOL LETTER ([A-Z])$/))) { put('regional', m[1], cp); put('regional', m[1].toLowerCase(), cp); }
  else if ((m = name.match(/^LATIN LETTER SMALL CAPITAL ([A-Z])$/))) put('small-caps', m[1].toLowerCase(), cp);
  else if ((m = name.match(/^(?:MODIFIER LETTER SMALL|MODIFIER LETTER CAPITAL|SUPERSCRIPT LATIN SMALL LETTER) ([A-Z])$/))) put('superscript', name.includes('CAPITAL') ? m[1] : m[1].toLowerCase(), cp);
  else if ((m = name.match(/^SUPERSCRIPT (\w+)$/)) && DIGITS.includes(m[1])) put('superscript', String(DIGITS.indexOf(m[1])), cp);
  else if ((m = name.match(/^LATIN SUBSCRIPT SMALL LETTER ([A-Z])$/))) put('subscript', m[1].toLowerCase(), cp);
  else if ((m = name.match(/^SUBSCRIPT (\w+)$/)) && DIGITS.includes(m[1])) put('subscript', String(DIGITS.indexOf(m[1])), cp);
}
put('italic', 'h', 0x210e); // PLANCK CONSTANT fills the italic h hole
put('small-caps', 'q', 0xa7af);
// fullwidth ASCII punctuation
for (let c = 0x21; c <= 0x7e; c++) put('fullwidth', String.fromCharCode(c), c + 0xfee0);
put('fullwidth', ' ', 0x3000);
// upside down (hand-made: no Unicode property for this)
const FLIP = { a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z', A: '∀', B: 'ᗺ', C: 'Ɔ', D: 'ᗡ', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ', K: 'Ʞ', L: '˥', M: 'W', N: 'N', O: 'O', P: 'Ԁ', Q: 'Ό', R: 'ᴚ', S: 'S', T: '⊥', U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z', 1: 'Ɩ', 2: 'ᄅ', 3: 'Ɛ', 4: 'ㄣ', 5: 'ϛ', 6: '9', 7: 'ㄥ', 8: '8', 9: '6', 0: '0', '.': '˙', ',': "'", "'": ',', '"': '„', '!': '¡', '?': '¿', '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', _: '‾', '&': '⅋', ';': '؛' };
for (const [k, v] of Object.entries(FLIP)) put('upside-down', k, v.codePointAt(0));

// ── Scramble blocks ─────────────────────────────────────────────
const SCRAMBLE = ['Basic Latin', 'Latin-1 Supplement', 'Latin Extended-A', 'Latin Extended-B', 'IPA Extensions', 'Greek and Coptic', 'Cyrillic', 'Armenian', 'Hebrew', 'Arabic', 'Devanagari', 'Thai', 'Tibetan', 'Georgian', 'Hangul Jamo', 'Ethiopic', 'Cherokee', 'Unified Canadian Aboriginal Syllabics', 'Ogham', 'Runic', 'Khmer', 'Mongolian', 'General Punctuation', 'Superscripts and Subscripts', 'Currency Symbols', 'Letterlike Symbols', 'Arrows', 'Mathematical Operators', 'Miscellaneous Technical', 'Box Drawing', 'Block Elements', 'Geometric Shapes', 'Miscellaneous Symbols', 'Dingbats', 'Braille Patterns', 'Hiragana', 'Katakana', 'Bopomofo', 'CJK Unified Ideographs', 'Yi Syllables', 'Linear B Syllabary', 'Gothic', 'Cuneiform', 'Egyptian Hieroglyphs', 'Mahjong Tiles', 'Domino Tiles', 'Playing Cards', 'Alchemical Symbols', 'Tai Xuan Jing Symbols', 'Yijing Hexagram Symbols', 'Musical Symbols'];
const blockRanges = SCRAMBLE.map((n) => blocks.find((b) => b.name === n)).filter(Boolean).map((b) => [b.name, b.start, b.end]);

// ── write ───────────────────────────────────────────────────────
const header = `// AUTO-GENERATED by scripts/build-unicode.mjs from the Unicode ${VERSION} Character Database — do not edit.\n`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'marks.ts'),
  `${header}export const UNICODE_VERSION = ${JSON.stringify(VERSION)};\nexport const MARK_BLOCKS: readonly string[] = ${JSON.stringify(usedBlocks)};\nexport const MARK_SCRIPTS: readonly string[] = ${JSON.stringify(usedScripts)};\n/** [codePoint, combiningClass, zone, blockIndex, scriptIndex] */\nexport const MARK_TABLE: readonly (readonly [number, number, number, number, number])[] = ${JSON.stringify(marks)};\n`,
);
fs.writeFileSync(path.join(OUT, 'names.ts'), `${header}export const NAMES: Readonly<Record<number, string>> = ${JSON.stringify(names)};\nexport const MONUMENTS: readonly number[] = ${JSON.stringify(MONUMENTS.filter((c) => chars.has(c)))};\n`);
fs.writeFileSync(path.join(OUT, 'styles.ts'), `${header}export const STYLE_MAPS: Readonly<Record<string, Readonly<Record<string, string>>>> = ${JSON.stringify(styles)};\n`);
fs.writeFileSync(path.join(OUT, 'blocks.ts'), `${header}/** [name, firstCodePoint, lastCodePoint] */\nexport const SCRAMBLE_BLOCKS: readonly (readonly [string, number, number])[] = ${JSON.stringify(blockRanges)};\n`);

const zoneCounts = marks.reduce((a, m) => ((a[m[2]] = (a[m[2]] ?? 0) + 1), a), {});
console.log(`Unicode ${VERSION}: ${marks.length} marks`, zoneCounts, `· ${Object.keys(names).length} names · ${Object.keys(styles).length} styles · ${blockRanges.length} scramble blocks`);
for (const [s, m] of Object.entries(styles)) console.log(`  ${s.padEnd(18)} ${Object.keys(m).length}`);
