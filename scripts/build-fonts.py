#!/usr/bin/env python3
"""
Builds the "zalgo-safe" web fonts: Zalgollo Sans / Serif / Mono.

Browsers shape a letter and all of its combining marks with ONE font. If that font lacks any mark
in the stack, the whole cluster breaks into boxes. So instead of a font stack we merge the Noto
family into single fonts that cover everything the studio produces:

  base   Noto Sans / Serif / Sans Mono  Latin, Greek, Cyrillic + every classic, supplement, half
                                        and Cyrillic combining mark (with proper mark stacking)
  + Noto Sans Math       symbol marks U+20D0–20FF, math alphanumerics (bold, fraktur, script…)
  + Noto Sans Symbols    circled / squared / parenthesized letters, regional indicators
  + Noto Sans Symbols 2  Braille patterns
  + Noto Sans Thai       Thai vowels and tone marks (Thai tower)

All fonts are SIL Open Font License 1.1. Output: apps/web/public/fonts/*.woff2 (committed).

    python3 -m venv .venv && .venv/bin/pip install fonttools brotli
    .venv/bin/python scripts/build-fonts.py
"""
import os
import urllib.request
from pathlib import Path

from fontTools.merge import Merger, Options as MergeOptions
from fontTools.subset import Options as SubsetOptions, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "fonts"
OUT = ROOT / "apps" / "web" / "public" / "fonts"
GF = "https://github.com/google/fonts/raw/main/ofl/"

SOURCES = {
    "sans": "notosans/NotoSans%5Bwdth,wght%5D.ttf",
    "serif": "notoserif/NotoSerif%5Bwdth,wght%5D.ttf",
    "mono": "notosansmono/NotoSansMono%5Bwdth,wght%5D.ttf",
    "math": "notosansmath/NotoSansMath-Regular.ttf",
    "symbols": "notosanssymbols/NotoSansSymbols%5Bwght%5D.ttf",
    "symbols2": "notosanssymbols2/NotoSansSymbols2-Regular.ttf",
    "thai": "notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf",
}


def R(a, b):
    return list(range(a, b + 1))


BASE_RANGES = (
    R(0x20, 0x7E) + R(0xA0, 0x2FF)  # Latin, Latin-1, Ext-A/B, IPA, spacing modifiers
    + R(0x300, 0x36F)  # combining diacritical marks
    + R(0x370, 0x3FF) + R(0x400, 0x52F)  # Greek, Cyrillic (+ titlos, enclosing signs)
    + R(0x1AB0, 0x1AFF) + R(0x1D00, 0x1DFF)  # marks extended, phonetic ext (small caps), marks supplement
    + R(0x1E00, 0x1EFF) + R(0x2000, 0x20CF)  # Latin ext additional, punctuation, super/subscripts, currency
    + R(0x2100, 0x214F) + R(0x2C60, 0x2C7F) + R(0x2DE0, 0x2DFF)  # letterlike, Latin ext-C, Cyrillic ext-A marks
    + R(0xA640, 0xA69F) + R(0xA720, 0xA7FF) + R(0xFE20, 0xFE2F) + [0x25CC, 0xFFFD]  # Cyrillic ext-B, Latin ext-D, half marks
)
EXTRAS = {
    "math": R(0x20D0, 0x20FF) + R(0x1D400, 0x1D7FF) + R(0x2100, 0x214F),
    "symbols": R(0x2460, 0x24FF) + R(0x2776, 0x2793) + R(0x1F100, 0x1F1FF),
    "symbols2": R(0x2800, 0x28FF),
    "thai": R(0x0E00, 0x0E7F),
}
FAMILIES = {"sans": ("Zalgollo Sans", [400, 800]), "serif": ("Zalgollo Serif", [400, 800]), "mono": ("Zalgollo Mono", [400])}
DROP = ["fpgm", "prep", "cvt ", "gasp", "vhea", "vmtx", "STAT", "MATH", "DSIG", "meta", "MVAR", "HVAR", "VVAR"]


def fetch(key):
    path = CACHE / (key + ".ttf")
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print("download", key)
        urllib.request.urlretrieve(GF + SOURCES[key], path)
    return path


def static(key, weight):
    font = TTFont(fetch(key))
    if "fvar" in font:
        axes = {a.axisTag: a for a in font["fvar"].axes}
        loc = {}
        if "wght" in axes:
            loc["wght"] = max(axes["wght"].minValue, min(axes["wght"].maxValue, weight))
        if "wdth" in axes:
            loc["wdth"] = 100
        font = instantiateVariableFont(font, loc, updateFontNames=False)
    return font


def subset(font, unicodes):
    o = SubsetOptions()
    o.layout_features = ["*"]
    o.hinting = False
    o.drop_tables += DROP
    o.name_IDs = ["*"]
    o.notdef_outline = True
    o.glyph_names = False
    s = Subsetter(o)
    s.populate(unicodes=unicodes)
    s.subset(font)
    for t in DROP:
        if t in font:
            del font[t]
    return font


def rename(font, family, weight):
    style = "Regular" if weight == 400 else "Bold" if weight == 700 else "ExtraBold"
    full = f"{family} {style}"
    ps = full.replace(" ", "-")
    for rec in font["name"].names:
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID in (2, 17):
            rec.string = style
        elif rec.nameID == 4:
            rec.string = full
        elif rec.nameID == 6:
            rec.string = ps
        elif rec.nameID == 3:
            rec.string = f"{ps};zalgollo"
    font["OS/2"].usWeightClass = weight


def build(kind, weight):
    family, _ = FAMILIES[kind]
    tmp = CACHE / "parts"
    tmp.mkdir(parents=True, exist_ok=True)
    parts = []
    base = subset(static(kind, weight), BASE_RANGES)
    p = tmp / f"{kind}-{weight}-base.ttf"
    base.save(p)
    parts.append(str(p))
    covered = set(base.getBestCmap())
    for key, uni in EXTRAS.items():
        need = [u for u in uni if u not in covered]
        if not need:
            continue
        f = subset(static(key, weight), need)
        if not set(f.getBestCmap()) - covered:
            continue
        p = tmp / f"{kind}-{weight}-{key}.ttf"
        f.save(p)
        parts.append(str(p))
        covered |= set(f.getBestCmap())
    merged = Merger(options=MergeOptions(drop_tables=DROP)).merge(parts)
    rename(merged, family, weight)
    merged.flavor = "woff2"
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{family.lower().replace(' ', '-')}-{weight}.woff2"
    merged.save(out)
    cmap = merged.getBestCmap()
    marks = sum(1 for u in cmap if 0x300 <= u <= 0x36F or 0x1AB0 <= u <= 0x1AFF or 0x1DC0 <= u <= 0x1DFF or 0x20D0 <= u <= 0x20FF or 0xFE20 <= u <= 0xFE2F)
    print(f"{out.name}: {len(cmap)} chars, {marks} combining marks, {os.path.getsize(out) // 1024} KB")


def write_coverage():
    """Record which combining marks every Zalgollo font can draw, so the studio can stay zalgo-safe."""
    import json
    import unicodedata

    common = None
    for kind, (family, weights) in FAMILIES.items():
        for w in weights:
            cmap = set(TTFont(OUT / f"{family.lower().replace(' ', '-')}-{w}.woff2").getBestCmap())
            common = cmap if common is None else common & cmap
    marks = sorted(u for u in common if unicodedata.category(chr(u)) in ("Mn", "Me"))
    out = ROOT / "apps" / "web" / "src" / "font-coverage.json"
    out.write_text(json.dumps({"_note": "Combining marks drawn by every Zalgollo font (generated by scripts/build-fonts.py)", "marks": marks}) + "\n")
    print(f"{len(marks)} combining marks covered by all Zalgollo fonts -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    for kind, (_, weights) in FAMILIES.items():
        for w in weights:
            build(kind, w)
    write_coverage()
