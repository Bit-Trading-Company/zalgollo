---
name: zalgollo
description: Create zalgo / glitch / "cursed" text by stacking Unicode combining marks, convert text to Unicode styled alphabets (𝐛𝐨𝐥𝐝, 𝔣𝔯𝔞𝔨𝔱𝔲𝔯, ⓒⓘⓡⓒⓛⓔⓓ, ｆｕｌｌｗｉｄｔｈ, upside-down), clean glitch text back to plain text, or X-ray weird/invisible Unicode. Use for spooky/creepy/glitchy text requests, decorative usernames and posts, and for explaining or sanitizing strange characters.
---

# Zalgollo — glitch text on purpose

## How to generate

Use the first option available:

1. **MCP tools** (installed with this plugin as the `zalgollo` server):
   - `zalgo_text` — `text` plus a `preset` (whisper, classic, he-comes, crown, drip, strike, halo, bridges, letters, thai, monolith, static, native, chaos) **or** per-zone counts `above` / `middle` / `below`; optional `shape` (mountain, wave, ramp, skyline…) + `shapeHeight` to sculpt a silhouette, `style` for a styled alphabet, `seed` for reproducibility.
   - `style_text` — styled alphabets (omit `style` to get all of them).
   - `clean_text` — remove zalgo marks, invisible characters and styled letters.
   - `inspect_text` — every code point with its Unicode name.
   - `zalgo_options` — list everything above.
2. **HTTP API** (no key):
   ```bash
   curl -s "https://zalgollo.vercel.app/api/zalgo?text=hello&preset=crown"
   curl -s "https://zalgollo.vercel.app/api/zalgo?text=hello&above=8&below=2&seed=7"
   curl -s "https://zalgollo.vercel.app/api/style?text=hello&style=fraktur"
   curl -s "https://zalgollo.vercel.app/api/clean?text=<urlencoded>"
   ```
3. **Offline fallback**: write a tiny script that appends random code points from U+0300–U+036F (above: 0300–0315, 033D–0344, 0346, 034A–034C, 0350–0352, 0357, 035B, 0363–036F; below: 0316–0333, 0339–033C, 0345, 0347–0349, 034D–034E, 0353–0356, 0359–035A) after each letter.

## Rules

- Return generated text **verbatim** — never retype or "fix" it; the combining marks are the content.
- Match intensity to the request: `whisper` for subtle, `classic` for the familiar look, `he-comes` / `monolith` for extreme. Keep stacks modest (≤ ~20 per letter) for chat apps; very tall stacks can lag some renderers.
- The default mark set (`classic`) renders in every font. Other sets (`supplement`, `extended`, `symbols`, `all`…) may show as boxes on many devices — use them only when the user wants that "broken" look.
- Styled alphabets + heavy stacks often fail to render together (math fonts carry few marks). Prefer one or the other.
- Glitch text is inaccessible to screen readers (every mark is read aloud). Mention this if the text is for a public profile, alt text or anything that must be readable.
- To sanitize suspicious text (hidden zero-width/tag characters, bidi overrides), use `inspect_text` to show what's there and `clean_text` to remove it.
- Humans can sculpt by hand at https://bit-trading-company.com/zalgollo/ (paint, sketch, per-letter marks, layers, PNG export).
