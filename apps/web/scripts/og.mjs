#!/usr/bin/env node
/** Regenerates public/og.png. Run manually: node scripts/og.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { MARKS, zalgo } from '@zalgollo/core';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const title = zalgo('zalgollo', { counts: { above: 4, middle: 0.3, below: 4 }, jitter: 0.5, sets: ['classic'], seed: 21 });
const W = 1200, H = 630;
const t = (x, fill, op = 1) => `<text x="${x}" y="330" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="170" font-weight="800" fill="${fill}" opacity="${op}">${esc(title)}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#07060a"/>
<radialGradient id="a" cx="15%" cy="0%" r="70%"><stop offset="0" stop-color="#ff2bd6" stop-opacity="0.28"/><stop offset="1" stop-color="#ff2bd6" stop-opacity="0"/></radialGradient>
<radialGradient id="b" cx="90%" cy="10%" r="60%"><stop offset="0" stop-color="#29f0ff" stop-opacity="0.2"/><stop offset="1" stop-color="#29f0ff" stop-opacity="0"/></radialGradient>
<rect width="${W}" height="${H}" fill="url(#a)"/><rect width="${W}" height="${H}" fill="url(#b)"/>
${Array.from({ length: H / 4 }, (_, i) => `<rect y="${i * 4}" width="${W}" height="1" fill="#fff" opacity="0.025"/>`).join('')}
${t(W / 2 - 5, '#ff2bd6', 0.9)}${t(W / 2 + 5, '#29f0ff', 0.9)}${t(W / 2, '#f3eefa')}
<text x="${W / 2}" y="500" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="#ece8f2">Glitch text, crafted on purpose</text>
<text x="${W / 2}" y="552" text-anchor="middle" font-family="Menlo, monospace" font-size="22" fill="#8e879c">paint · sketch · ${MARKS.length.toLocaleString('en')} combining marks · forbidden unicode</text>
</svg>`;
const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
fs.writeFileSync(path.join(DIR, 'public/og.png'), png);
console.log('wrote public/og.png', png.length);
