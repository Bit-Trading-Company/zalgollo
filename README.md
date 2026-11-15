# z̶̡̠̦̲̦̜͕̏̿ͪͨ̕ą̸̱̠̦̥̳̂̿̌̓̾̅͐l̸̹̝̬̘̜̼̩ͬ͆͛̑g̡̲͇̋͐ͧ́ő̷̡̥̬͈ͪͮ̎̍̀̄͛l̸̪̦̠̈̓̂̕ͅl̡̹̣̮͎̲̈́ͬ̾̂͑̀͑o̷̱̹͍̬͎̪̘͋ͫ̀͘̚

**Glitch text, crafted on purpose.** Zalgollo is a studio for building zalgo / glitch text by hand: paint
combining marks onto letters, sketch silhouettes out of stacked accents, pick from all 2,103 combining
marks in Unicode 18, and reach for the forbidden corners of Unicode, from invisible ink to bidi tricks to
monumental glyphs. Inspired by stAllio!'s much-missed *glitch text generator & text-art canvas*.

- **Studio:** https://bit-trading-company.com/zalgollo/
- **API + MCP for agents:** https://zalgollo.vercel.app

## The idea: text as an object

Zalgo text is just letters followed by combining marks. Zalgollo keeps it as a document:

```ts
type Cell = { ch: string; base?: string; marks: number[] };   // one grapheme
type Doc = Cell[];
```

Every mark comes from the Unicode Character Database and is sorted into a **zone** by its canonical
combining class: *above* (230), *through* (overlays, 1), *below* (220), *enclose* (Me), *bridge* (double
marks, 233/234), *script* (vowel signs, points) and *invisible* (variation selectors, CGJ). Ops are pure
functions over the document (`glitch`, `shape`, `reroll`, `strip`, `erase`, `addMark`, `scramble`,
`style`, `reverse`), `compile()` renders the final string and `parse()` turns any text, including
existing zalgo or 𝔰𝔱𝔶𝔩𝔢𝔡 letters, back into an editable document. Editing the plain text keeps the marks on
every letter you didn't touch.

## Studio features

- **Paint / Erase** marks directly onto letters on the stage; **Select** ranges on the stage or the letter strip.
- **Brush**: 14 presets (whisper → chaos), per-zone counts, density, chaos, stack/replace, native-script marks, glitch-as-you-type.
- **Sketch**: draw stack heights with the mouse (above the line grows up, below grows down) or apply shapes: wave, mountain, skyline, heartbeat…
- **Marks**: browse/search all 2,103 marks by name and zone, click to add one precisely, ban marks from the pool, toggle sets, and **test your device** to hide marks your fonts can't draw.
- **Letter inspector**: double-click a letter to see and remove each mark.
- **Style**: 24 Unicode alphabets generated from character names (bold, fraktur, script, circled, squared, fullwidth, small caps, upside-down, regional indicators…) and **Scramble** with characters from 51 Unicode blocks.
- **Forbidden**: invisible weaves (ZWSP/ZWJ/WJ/CGJ/soft hyphen), RTL override/mirror/isolate, invisible ink (variation selectors or tag characters), blank characters, monumental UI-breaking glyphs.
- **Layers**: compose posters like stAllio's canvas: font, size, weight, rotation, opacity, RGB split, glow, stage backgrounds, drag to place, **Poster mode** and **PNG export**.
- **X-ray**: every code point with its Unicode name, stats (UTF-16 length, bytes, tallest stack), reveal hidden ink, clean or strip any pasted text.
- **Boil** (animate), **Unleash** (let marks escape the stage), undo/redo, share links, autosave, keyboard shortcuts.
- **SEO pages**: each preset, each alphabet, each invisible character, and a full combining-mark reference.

## For agents

```text
/plugin marketplace add Bit-Trading-Company/zalgollo
/plugin install zalgollo@zalgollo
```

```bash
claude mcp add --transport http zalgollo https://zalgollo.vercel.app/mcp
curl "https://zalgollo.vercel.app/api/zalgo?text=hello&preset=crown"
curl "https://zalgollo.vercel.app/api/zalgo?text=peak&shape=mountain&shapeHeight=20&seed=4"
curl "https://zalgollo.vercel.app/api/style?text=hello&style=fraktur"
curl "https://zalgollo.vercel.app/api/clean?text=..."
```

MCP tools: `zalgo_text`, `style_text`, `clean_text`, `inspect_text`, `zalgo_options`.

The forbidden finishes (invisible ink, bidi overrides, invisible weaves) are deliberately **not** exposed
to agents: they stay in the human-driven studio. Agents get the inverse instead: `inspect_text` and
`clean_text` to find and remove hidden characters.

## Packages

| Path | What |
| --- | --- |
| [`packages/core`](packages/core) | `@zalgollo/core`: document model, ops, mark catalog, styles, shapes, forbidden tricks, inspector |
| [`packages/cli`](packages/cli) | `zalgollo "text" -p crown` · `--shape mountain` · `-s fraktur` · `--clean` · `--inspect` |
| [`apps/web`](apps/web) | Static Vite studio → GitHub Pages |
| [`apps/api`](apps/api) | Vercel Functions: `/api/zalgo`, `/api/style`, `/api/clean`, `/api/inspect`, `/api/options`, `/mcp` |
| [`plugins/zalgollo`](plugins/zalgollo) | Claude Code plugin: skill + MCP config |
| [`scripts/build-unicode.mjs`](scripts/build-unicode.mjs) | Regenerates mark, name, style and block tables from the latest UCD |

Extending is a one-line change in a registry: `MARK_SETS`, `PRESETS`, `SHAPES`, `INVISIBLES`, `BLANKS`,
`FONTS`/`BACKGROUNDS` (web), panel tabs, MCP tools.

## Zalgo-safe fonts

Browsers shape a letter and all its marks with **one font**; if that font lacks any mark in the
stack, the cluster breaks into boxes. System UI fonts only cover U+0300–036F, so the studio ships its own
fonts: **Zalgollo Sans / Serif / Mono**, built by \`scripts/build-fonts.py\` by merging Noto Sans/Serif/Mono
with Noto Sans Math (symbol marks, math alphabets), Noto Sans Symbols (circled/squared letters),
Noto Sans Symbols 2 (Braille) and Noto Sans Thai, then subsetting to WOFF2 (~240 KB each, SIL OFL 1.1).
The build also writes \`apps/web/src/font-coverage.json\`; while **Zalgo-safe** is on (Marks tab, default),
the random pool only uses the 318 marks these fonts can draw. Turn it off for deliberate chaos.

Pasted text is rendered by the destination app's fonts, so the API and presets default to the classic
block, which every font covers.

## Development

```bash
npm install
npm run dev          # studio on http://localhost:5173/zalgollo/
npm run dev:api      # API + MCP on http://localhost:3000
npm run unicode      # refresh Unicode tables (downloads the UCD once)
# rebuild fonts: python3 -m venv .venv && .venv/bin/pip install fonttools brotli && .venv/bin/python scripts/build-fonts.py
npm run build && npm test
```

## Deployment

- **Web**: pushes to `main` build, test and deploy to GitHub Pages (`.github/workflows/pages.yml`) at https://bit-trading-company.com/zalgollo/.
- **API / MCP**: import this repo in Vercel with **Root Directory = `apps/api`** and project name `zalgollo`.

## Credits

Unicode data © Unicode, Inc. (Unicode License v3). Inspired by stAllio!'s HTML5 glitch text generator (2013)
and every zalgo summoner since. Sibling of [Figletto](https://bit-trading-company.com/figletto/). MIT, made by
[Bit Trading Company](https://bit-trading-company.com/).
