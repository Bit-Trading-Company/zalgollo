#!/usr/bin/env node
/**
 * Static SEO pages, generated after `vite build`:
 *   /presets/<name>/     one page per glitch preset
 *   /styles/<name>/      one page per styled alphabet ("fraktur text generator"…)
 *   /characters/<name>/  invisible & blank characters with copy buttons
 *   /marks/              every combining mark in Unicode, with names
 *   sitemap.xml, llms.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLANKS, INVISIBLES, MARKS, MARK_SETS, PRESETS, STYLES, UNICODE_VERSION, ZONE_INFO, describe, styleText, zalgo } from '@zalgollo/core';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(DIR, 'dist');
const SITE = (process.env.SITE_URL ?? 'https://bit-trading-company.com/zalgollo').replace(/\/$/, '');
const BASE = process.env.BASE_PATH ?? '/zalgollo/';
const API = process.env.ZALGOLLO_API ?? 'https://zalgollo.vercel.app';
const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const cssLinks = [...indexHtml.matchAll(/<link rel="stylesheet"[^>]*>/g)].map((m) => m[0]).join('\n    ');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const urls = [`${SITE}/`];

function page(rel, { title, description, body, jsonld }) {
  const canonical = `${SITE}/${rel}`;
  urls.push(canonical);
  const html = `<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    ${cssLinks}
    ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
    <script>try{const t=localStorage.getItem('zalgollo:theme');if(t)document.documentElement.dataset.theme=t}catch{}</script>
    <style>
      .page { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
      .crumbs { font: 13px var(--mono); color: var(--muted); margin-bottom: 16px; } .crumbs a { color: var(--muted); }
      .page h1 { font-size: clamp(30px, 4.5vw, 48px); letter-spacing: -0.035em; margin: 0 0 8px; }
      .sample { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; margin: 14px 0; padding: 14px 16px; display: flex; gap: 12px; align-items: center; overflow: hidden; }
      .sample .t { flex: 1; font-size: 30px; line-height: 2.4; overflow: hidden; white-space: nowrap; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; padding: 0; list-style: none; }
      .grid a { display: block; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); text-decoration: none; color: var(--text); }
      .grid a:hover { border-color: var(--hot); }
      .grid small { display: block; color: var(--muted); font-size: 12px; }
      table.marks { width: 100%; border-collapse: collapse; font-size: 13px; }
      table.marks td { border-bottom: 1px solid var(--line); padding: 4px 6px; }
      table.marks td:first-child { font-size: 22px; width: 52px; text-align: center; cursor: copy; }
      table.marks td.h { font-family: var(--mono); color: var(--cold); width: 80px; }
      table.marks td.z { color: var(--muted); width: 90px; }
      .cta { display: inline-block; margin: 12px 0; text-decoration: none; }
      h2 { font-size: 24px; margin-top: 40px; }
      .prose p { color: var(--muted); max-width: 760px; }
    </style>
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="${BASE}"><span class="brand-mark" aria-hidden="true">Z̷</span>zalgollo</a>
      <nav aria-label="Primary"><a href="${BASE}#studio">Studio</a><a href="${BASE}presets/">Presets</a><a href="${BASE}styles/">Styles</a><a href="${BASE}characters/">Characters</a><a href="${BASE}marks/">Marks</a></nav>
    </header>
    <main class="page">${body}</main>
    <footer class="footer"><p>Made by <a href="https://bit-trading-company.com/">Bit Trading Company</a> · Unicode ${UNICODE_VERSION} data © Unicode, Inc.</p></footer>
    <div class="toast" id="toast" role="status" hidden></div>
    <script>
      document.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-copy]'); if (!b) return;
        const v = b.dataset.copy.startsWith('#') ? document.querySelector(b.dataset.copy).textContent : b.dataset.copy;
        try { await navigator.clipboard.writeText(v); } catch {}
        const t = document.getElementById('toast'); t.textContent = 'Copied to clipboard'; t.hidden = false;
        clearTimeout(window.__t); window.__t = setTimeout(() => (t.hidden = true), 1600);
      });
    </script>
  </body>
</html>
`;
  const out = path.join(DIST, rel, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

const sample = (id, text) => `<div class="sample"><div class="t" id="${id}">${esc(text)}</div><button class="btn" data-copy="#${id}">Copy</button></div>`;
const crumbs = (...parts) => `<nav class="crumbs"><a href="${BASE}">zalgollo</a> / ${parts.join(' / ')}</nav>`;

// presets
const presetEntries = Object.entries(PRESETS);
for (const [key, p] of presetEntries) {
  const words = ['hello world', 'he comes', 'glitch', 'cursed text', 'Z A L G O'];
  page(`presets/${key}/`, {
    title: `${p.label} zalgo text generator — copy & paste glitch text | Zalgollo`,
    description: `${p.label}: ${p.description}. Generate ${p.label.toLowerCase()} glitch text, copy and paste it into Discord, Instagram, X or anywhere.`,
    body: `${crumbs(`<a href="${BASE}presets/">presets</a>`, key)}
      <h1>${esc(zalgo(p.label, { preset: key, seed: 3 }))}</h1>
      <p class="muted">${esc(p.description)}. Every sample below is plain Unicode — copy it anywhere.</p>
      <a class="btn primary cta" href="${BASE}?text=${encodeURIComponent('your text')}#studio">Make your own in the studio →</a>
      ${words.map((w, i) => sample(`s${i}`, zalgo(w, { preset: key, seed: i + 1 }))).join('')}
      <h2>Use it from code or an AI agent</h2>
      <pre class="code">curl "${API}/api/zalgo?text=hello&amp;preset=${key}"</pre>
      <pre class="code">import { zalgo } from '@zalgollo/core';\nzalgo('hello', { preset: '${key}' });</pre>
      <h2>Other presets</h2>
      <ul class="grid">${presetEntries.filter(([k]) => k !== key).map(([k, o]) => `<li><a href="${BASE}presets/${k}/">${esc(o.label)}<small>${esc(o.description)}</small></a></li>`).join('')}</ul>`,
  });
}
page('presets/', {
  title: 'Zalgo text presets — whisper, crown, drip, he comes, chaos | Zalgollo',
  description: 'Every flavour of zalgo / glitch text: subtle whispers, crowns, drips, strikes, halos, Thai towers, monoliths and pure chaos.',
  body: `${crumbs('presets')}<h1>Zalgo presets</h1><ul class="grid">${presetEntries.map(([k, p]) => `<li><a href="${BASE}presets/${k}/"><span style="font-size:22px;line-height:2.2;display:block;overflow:hidden;white-space:nowrap">${esc(zalgo(p.label, { preset: k, seed: 5 }))}</span><small>${esc(p.description)}</small></a></li>`).join('')}</ul>`,
});

// styles
const styleEntries = Object.entries(STYLES);
for (const [key, label] of styleEntries) {
  const ex = ['Hello World', 'The quick brown fox jumps over the lazy dog', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789'];
  page(`styles/${key}/`, {
    title: `${label.replace(/[^\x20-\x7e]/g, '') || 'Fullwidth'} text generator — ${styleText('copy and paste', key)} | Zalgollo`,
    description: `Convert text to ${label} Unicode letters (${styleText('like this', key)}) and copy it anywhere: bios, usernames, posts.`,
    body: `${crumbs(`<a href="${BASE}styles/">styles</a>`, key)}
      <h1>${esc(styleText(label.replace(/[^\x20-\x7e]/g, '') || 'Fullwidth', key))} <span class="muted">text</span></h1>
      <p class="muted">${esc(label)} letters are real Unicode characters, so they survive copy &amp; paste. Combine them with zalgo marks in the studio.</p>
      <a class="btn primary cta" href="${BASE}#studio">Open the studio →</a>
      ${ex.map((w, i) => sample(`s${i}`, styleText(w, key))).join('')}
      <pre class="code">curl "${API}/api/style?text=hello&amp;style=${key}"</pre>
      <h2>More alphabets</h2>
      <ul class="grid">${styleEntries.filter(([k]) => k !== key).map(([k, l]) => `<li><a href="${BASE}styles/${k}/">${esc(styleText('Zalgollo', k))}<small>${esc(l)}</small></a></li>`).join('')}</ul>`,
  });
}
page('styles/', {
  title: 'Fancy text styles — bold, fraktur, script, circled, upside down | Zalgollo',
  description: `${styleEntries.length} Unicode alphabets to copy and paste: 𝐛𝐨𝐥𝐝, 𝑖𝑡𝑎𝑙𝑖𝑐, 𝔣𝔯𝔞𝔨𝔱𝔲𝔯, 𝓈𝒸𝓇𝒾𝓅𝓉, ⓒⓘⓡⓒⓛⓔⓓ, ｆｕｌｌｗｉｄｔｈ and more.`,
  body: `${crumbs('styles')}<h1>Fancy text styles</h1><ul class="grid">${styleEntries.map(([k, l]) => `<li><a href="${BASE}styles/${k}/"><span style="font-size:20px">${esc(styleText('Zalgollo', k))}</span><small>${esc(l)}</small></a></li>`).join('')}</ul>`,
});

// characters
const chars = [
  ...Object.entries(INVISIBLES).map(([k, v]) => ({ key: k, char: v.char, label: v.label, about: v.description })),
  ...Object.entries(BLANKS).map(([k, v]) => ({ key: k, char: v.char, label: v.label.split(' — ')[0], about: v.label.split(' — ')[1] ?? 'A blank-looking character' })),
];
for (const c of chars) {
  const d = describe(c.char.codePointAt(0));
  page(`characters/${c.key}/`, {
    title: `${c.label} (${d.hex}) — copy invisible character | Zalgollo`,
    description: `Copy the ${c.label.toLowerCase()} (${d.hex}, ${d.name}) with one click. ${c.about}.`,
    body: `${crumbs(`<a href="${BASE}characters/">characters</a>`, c.key)}
      <h1>${esc(c.label)}</h1>
      <p class="muted">${esc(d.hex)} · ${esc(d.name)} — ${esc(c.about)}.</p>
      <p><button class="btn primary big" data-copy="${esc(c.char)}">Copy ${esc(c.label.toLowerCase())}</button></p>
      <div class="prose"><p>The character is invisible, so this page copies it directly to your clipboard. Paste it into a name field, message or document. To find or remove hidden characters in any text, use the X-ray tab in the <a href="${BASE}#studio">studio</a>.</p></div>
      <h2>Other invisible &amp; blank characters</h2>
      <ul class="grid">${chars.filter((o) => o !== c).map((o) => `<li><a href="${BASE}characters/${o.key}/">${esc(o.label)}<small>${describe(o.char.codePointAt(0)).hex}</small></a></li>`).join('')}</ul>`,
  });
}
page('characters/', {
  title: 'Invisible characters & blank text — copy and paste | Zalgollo',
  description: 'Copy zero-width spaces, joiners, Hangul filler, Braille blank and other invisible Unicode characters. Plus a free tool to detect and remove them.',
  body: `${crumbs('characters')}<h1>Invisible &amp; blank characters</h1><ul class="grid">${chars.map((o) => `<li><a href="${BASE}characters/${o.key}/">${esc(o.label)}<small>${describe(o.char.codePointAt(0)).hex} — ${esc(o.about)}</small></a></li>`).join('')}</ul>`,
});

// marks reference
const blocks = new Map();
for (const m of MARKS) {
  if (!blocks.has(m.block)) blocks.set(m.block, []);
  blocks.get(m.block).push(m);
}
page('marks/', {
  title: `All ${MARKS.length} Unicode combining marks — names, zones, copy | Zalgollo`,
  description: `Reference of every combining diacritical mark in Unicode ${UNICODE_VERSION} (${MARKS.length} characters), grouped by block, with code points, names and where each mark sits. Click to copy.`,
  body: `${crumbs('marks')}<h1>Every combining mark in Unicode</h1>
    <p class="muted">${MARKS.length} combining characters from Unicode ${UNICODE_VERSION}, shown on a dotted circle. Zones: ${Object.entries(ZONE_INFO).map(([, z]) => `<b>${z.label}</b> — ${esc(z.description.toLowerCase())}`).join('; ')}. Click a mark to copy it.</p>
    <p class="muted">Sets in the studio: ${Object.entries(MARK_SETS).map(([, s]) => esc(s.label)).join(', ')}.</p>
    ${[...blocks]
      .map(
        ([block, ms]) =>
          `<h2 id="${block.replace(/\W+/g, '-').toLowerCase()}">${esc(block)} <span class="muted small">${ms.length}</span></h2><table class="marks">${ms
            .map((m) => `<tr><td data-copy="${esc(m.char)}">◌${esc(m.char)}</td><td class="h">${describe(m.cp).hex}</td><td>${esc(describe(m.cp).name.toLowerCase())}</td><td class="z">${ZONE_INFO[m.zone].label}</td></tr>`)
            .join('')}</table>`,
      )
      .join('')}`,
});

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u, i) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><priority>${i === 0 ? '1.0' : '0.6'}</priority></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(
  path.join(DIST, 'llms.txt'),
  `# Zalgollo\n\n> Zalgo / glitch text editor: paint, sketch and sculpt text with Unicode combining marks; styled alphabets; invisible-character tools. Web studio at ${SITE}/, API + MCP server at ${API}.\n\n## For agents\n- MCP: ${API}/mcp — tools zalgo_text, style_text, clean_text, inspect_text, zalgo_options\n- REST: ${API}/api/zalgo?text=hello&preset=crown\n- Docs: ${API}/llms.txt\n\n## Pages\n- [Studio](${SITE}/)\n- [Presets](${SITE}/presets/)\n- [Styles](${SITE}/styles/)\n- [Invisible characters](${SITE}/characters/)\n- [All combining marks](${SITE}/marks/)\n`,
);
console.log(`prerendered ${urls.length - 1} pages + sitemap.xml, llms.txt`);
