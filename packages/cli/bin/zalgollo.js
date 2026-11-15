#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import { PRESETS, MARK_SETS, STYLES, SHAPES, clean, inspect, styleText, zalgo } from '@zalgollo/core';

const HELP = `zalgollo — glitch text, crafted on purpose

Usage
  zalgollo [text] [options]        (reads stdin when no text is given)

Options
  -p, --preset <name>    ${Object.keys(PRESETS).join(', ')}
  -u, --above <n>        marks above each letter
  -m, --middle <n>       overlay marks through each letter
  -d, --below <n>        marks below each letter
  -i, --intensity <x>    scale all counts
      --sets <a,b>       mark sets: ${Object.keys(MARK_SETS).join(', ')}
      --shape <name>     silhouette: ${Object.keys(SHAPES).join(', ')}
      --height <n>       silhouette peak (default 16)
  -s, --style <name>     alphabet: ${Object.keys(STYLES).join(', ')}
      --seed <n>         reproducible output
      --clean            strip marks/invisibles instead
      --inspect          list code points with names
  -h, --help

Examples
  zalgollo "he comes" -p he-comes
  zalgollo "peak" --shape mountain --height 24
  zalgollo "fancy" -s fraktur -u 2
  pbpaste | zalgollo --clean`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    preset: { type: 'string', short: 'p' },
    above: { type: 'string', short: 'u' },
    middle: { type: 'string', short: 'm' },
    below: { type: 'string', short: 'd' },
    intensity: { type: 'string', short: 'i' },
    sets: { type: 'string' },
    shape: { type: 'string' },
    height: { type: 'string' },
    style: { type: 'string', short: 's' },
    seed: { type: 'string' },
    clean: { type: 'boolean' },
    inspect: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

try {
  if (o.help) {
    console.log(HELP);
    process.exit(0);
  }
  let text = positionals.join(' ');
  if (!text && !process.stdin.isTTY) text = fs.readFileSync(0, 'utf8').replace(/\n$/, '');
  if (!text) {
    console.log(HELP);
    process.exit(0);
  }
  if (o.clean) console.log(clean(text));
  else if (o.inspect) {
    const r = inspect(text);
    for (const g of r.graphemes) for (const c of g.codePoints) console.log(`${c.hex.padEnd(9)} ${c.name || c.category}`);
  } else {
    const counts = Object.fromEntries(['above', 'middle', 'below'].filter((k) => o[k] != null).map((k) => [k, Number(o[k])]));
    const h = Number(o.height ?? 16);
    const glitchy = Object.keys(counts).length || o.preset || o.shape || !o.style;
    console.log(
      glitchy
        ? zalgo(text, {
            preset: o.preset,
            counts: Object.keys(counts).length ? counts : undefined,
            intensity: o.intensity ? Number(o.intensity) : undefined,
            sets: o.sets?.split(','),
            shape: o.shape ? { name: o.shape, above: h, below: Math.round(h * 0.6) } : undefined,
            style: o.style,
            seed: o.seed ? Number(o.seed) : undefined,
          })
        : styleText(text, o.style),
    );
  }
} catch (e) {
  console.error(`zalgollo: ${e.message}`);
  process.exit(1);
}
