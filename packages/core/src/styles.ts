/** Styled alphabets (𝐛𝐨𝐥𝐝, 𝔣𝔯𝔞𝔨𝔱𝔲𝔯, ⓒⓘⓡⓒⓛⓔⓓ…), generated from Unicode character names. */
import { STYLE_MAPS } from './data/styles.js';

export { STYLE_MAPS };

export const STYLES: Record<string, string> = {
  bold: 'Bold',
  italic: 'Italic',
  'bold-italic': 'Bold italic',
  script: 'Script',
  'bold-script': 'Bold script',
  fraktur: 'Fraktur',
  'bold-fraktur': 'Bold fraktur',
  'double-struck': 'Double-struck',
  sans: 'Sans',
  'sans-bold': 'Sans bold',
  'sans-italic': 'Sans italic',
  'sans-bold-italic': 'Sans bold italic',
  monospace: 'Monospace',
  fullwidth: 'Ｆｕｌｌｗｉｄｔｈ',
  'small-caps': 'Small caps',
  superscript: 'Superscript',
  subscript: 'Subscript',
  circled: 'Circled',
  'circled-negative': 'Negative circled',
  squared: 'Squared',
  'squared-negative': 'Negative squared',
  parenthesized: 'Parenthesized',
  regional: 'Regional indicators',
  'upside-down': 'Upside down',
};

export function styleChar(ch: string, style: string): string {
  const map = STYLE_MAPS[style];
  if (!map) throw new Error(`Unknown style "${style}". Available: none, ${Object.keys(STYLES).join(', ')}`);
  return map[ch] ?? map[ch.toLowerCase()] ?? ch;
}

export function styleText(text: string, style: string): string {
  if (style === 'none') return text;
  const out = [...text].map((c) => styleChar(c, style));
  return style === 'upside-down' ? out.reverse().join('') : out.join('');
}
