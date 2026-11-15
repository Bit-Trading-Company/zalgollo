/** Zalgollo MCP server definition. */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MARK_SETS, PRESETS, SHAPES, STYLES } from '@zalgollo/core';
import { options, runClean, runInspect, runStyle, runZalgo } from './core.js';

const INSTRUCTIONS = `Zalgollo crafts "zalgo" / glitch text by stacking Unicode combining marks on letters, and converts text to styled Unicode alphabets.
- zalgo_text: glitch text. Pick a preset (${Object.keys(PRESETS).join(', ')}) or set per-zone counts (above / middle / below …). Use "seed" for reproducible output. Default marks are the classic U+0300–036F block, which renders everywhere.
- style_text: 𝐛𝐨𝐥𝐝, 𝔣𝔯𝔞𝔨𝔱𝔲𝔯, ⓒⓘⓡⓒⓛⓔⓓ, ｆｕｌｌｗｉｄｔｈ, upside-down and more.
- clean_text: remove zalgo marks and invisible characters, fold styled letters back to plain text.
- inspect_text: list every code point with its Unicode name (useful to explain or debug weird text).
Return generated text to the user verbatim (don't retype it). Zalgo text is decorative: avoid it where accessibility matters (screen readers read every mark).`;

const zalgoShape = {
  text: z.string().min(1).max(1000).describe('Text to glitch.'),
  preset: z.enum(Object.keys(PRESETS)).optional().describe(Object.entries(PRESETS).map(([k, p]) => `${k}: ${p.description}`).join('; ')),
  above: z.number().min(0).max(100).optional().describe('Average marks stacked above each letter.'),
  middle: z.number().min(0).max(100).optional().describe('Average overlay marks through each letter.'),
  below: z.number().min(0).max(100).optional().describe('Average marks hanging below each letter.'),
  intensity: z.number().min(0).max(10).optional().describe('Multiply all counts (0.5 = half, 2 = double).'),
  density: z.number().min(0).max(1).optional().describe('Share of letters affected (0–1).'),
  sets: z.array(z.enum(Object.keys(MARK_SETS))).optional().describe(`Mark sets to draw from. Default "classic" (renders everywhere). ${Object.entries(MARK_SETS).map(([k, s]) => `${k}: ${s.description}`).join('; ')}`),
  shape: z.enum(Object.keys(SHAPES)).optional().describe('Sculpt stack heights into a silhouette across the text (mountain, wave, ramp, skyline…).'),
  shapeHeight: z.number().min(1).max(100).optional().describe('Peak height for the shape, in marks (default 16).'),
  shapeZone: z.enum(['both', 'above', 'below']).optional(),
  style: z.enum(['none', ...Object.keys(STYLES)]).optional().describe('Styled alphabet for the base letters.'),
  seed: z.number().int().min(0).optional().describe('Seed for reproducible output.'),
};

const ok = (text, structuredContent) => ({ content: [{ type: 'text', text }], ...(structuredContent ? { structuredContent } : {}) });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: e.message }] });
const wrap = (fn) => async (args) => {
  try {
    return fn(args);
  } catch (e) {
    return fail(e);
  }
};

export function createMcpServer() {
  const server = new McpServer({ name: 'zalgollo', version: '0.1.0', title: 'Zalgollo — glitch text' }, { instructions: INSTRUCTIONS });

  server.registerTool(
    'zalgo_text',
    {
      title: 'Glitch text (zalgo)',
      description: 'Stack Unicode combining marks on letters to make zalgo / glitch / cursed text. Presets, per-zone counts, silhouettes and styled alphabets. Returns the text verbatim.',
      inputSchema: zalgoShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    wrap((args) => {
      const r = runZalgo(args);
      return ok(r.text, { text: r.text, seed: r.seed, codePoints: r.stats.codePoints, marks: r.stats.marks, tallestStack: r.stats.maxStack });
    }),
  );

  server.registerTool(
    'style_text',
    {
      title: 'Styled Unicode alphabets',
      description: 'Convert text to a Unicode alphabet style (bold, italic, script, fraktur, double-struck, monospace, fullwidth, small caps, circled, squared, upside-down…). Omit style to get every style at once.',
      inputSchema: { text: z.string().min(1).max(1000), style: z.enum(['all', ...Object.keys(STYLES)]).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    wrap((args) => {
      const r = runStyle(args);
      return ok(r.text ?? Object.entries(r.styles).map(([k, v]) => `${k}: ${v}`).join('\n'));
    }),
  );

  server.registerTool(
    'clean_text',
    {
      title: 'Clean glitch text',
      description: 'Remove combining marks (zalgo), zero-width/invisible/bidi characters and fold styled letters (𝐛𝐨𝐥𝐝 → bold). Use to read or sanitize weird text.',
      inputSchema: {
        text: z.string().min(1).max(100000),
        marks: z.boolean().optional().describe('Strip combining marks (default true). Note: also strips accents like é.'),
        invisible: z.boolean().optional().describe('Strip invisible/format characters (default true).'),
        normalize: z.enum(['NFKC', 'NFC', 'none']).optional().describe('NFKC (default) also folds styled alphabets.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    wrap((args) => {
      const r = runClean(args);
      return ok(r.text);
    }),
  );

  server.registerTool(
    'inspect_text',
    {
      title: 'X-ray text',
      description: 'List each grapheme and its code points with Unicode names, plus counts (code points, UTF-16 length, marks, invisible characters, tallest stack). Reveals hidden characters.',
      inputSchema: { text: z.string().min(1).max(100000), limit: z.number().int().min(1).max(2000).optional().describe('Max code points to list (default 400).') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    wrap(({ text, limit = 400 }) => {
      const r = runInspect({ text, limit });
      const s = r.stats;
      const lines = r.graphemes.map((g) => `“${g.text}” ${g.codePoints.map((c) => `${c.hex} ${c.name || c.category}${c.invisible ? ' [invisible]' : ''}`).join(' · ')}`);
      return ok(
        `${s.graphemes} graphemes · ${s.codePoints} code points · ${s.utf16} UTF-16 units · ${s.utf8Bytes} UTF-8 bytes · ${s.marks} marks · ${s.invisible} invisible · tallest stack ${s.maxStack}\n\n${lines.join('\n')}${r.truncated ? '\n…truncated' : ''}`,
        { stats: s },
      );
    }),
  );

  server.registerTool(
    'zalgo_options',
    {
      title: 'List presets, mark sets, styles and shapes',
      description: 'Everything zalgo_text and style_text accept, with descriptions.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    wrap(() => ok(JSON.stringify(options(), null, 2))),
  );

  return server;
}
