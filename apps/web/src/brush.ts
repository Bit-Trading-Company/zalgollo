import { PRESETS, SHAPES, glitch, heights, reroll, seeded, shape, shapeHeights, strip, zalgo, type Zone } from '@zalgollo/core';
import { flashCells } from './stage';
import { UNCOVERED, pool, range, store, type Brush } from './state';
import { $, check, chip, h, section, slider } from './ui';

type CountZone = keyof Brush['counts'];
const ZONE_SLIDERS: [CountZone, string, number][] = [
  ['above', 'Above', 60],
  ['middle', 'Through', 8],
  ['below', 'Below', 60],
  ['enclose', 'Enclose', 4],
  ['bridge', 'Bridge', 6],
  ['other', 'Script', 12],
];

const fullRange = (): [number, number] => range() ?? [0, store.layer().doc.length];

export function applyBrush() {
  const s = store.state;
  const b = s.brush;
  store.setDoc(
    glitch(store.layer().doc, {
      range: range(),
      counts: b.counts,
      density: b.density / 100,
      jitter: b.jitter / 100,
      pool: pool(),
      mode: b.mode,
      includeSpaces: b.includeSpaces,
    }),
  );
  flashCells(fullRange());
}

export function applyReroll() {
  store.setDoc(reroll(store.layer().doc, { range: range(), pool: pool() }));
  flashCells(fullRange());
}

export function applyStrip() {
  store.setDoc(strip(store.layer().doc, { range: range() }));
}

/** Glitch newly typed letters with the current brush (if "glitch as you type" is on). */
export function brushNewCells(r: [number, number]) {
  const b = store.state.brush;
  if (!b.autoType || r[1] <= r[0]) return;
  const doc = glitch(store.layer().doc, { range: r, counts: b.counts, density: b.density / 100, jitter: b.jitter / 100, pool: pool(), includeSpaces: b.includeSpaces });
  store.setDoc(doc, 'typing');
}

const setBrush = (patch: Partial<Brush>) => store.set({ brush: { ...store.state.brush, ...patch } });

export function buildBrush() {
  const root = $('#tab-brush');
  const b = () => store.state.brush;
  const sliders = ZONE_SLIDERS.map(([z, label, max]) => {
    const sl = slider(label, b().counts[z], 0, max, (v) => setBrush({ counts: { ...b().counts, [z]: v } }));
    return [z, sl] as const;
  });
  const density = slider('Density', b().density, 0, 100, (v) => setBrush({ density: v }), { fmt: (v) => `${v}%`, title: 'Share of letters affected' });
  const jitter = slider('Chaos', b().jitter, 0, 100, (v) => setBrush({ jitter: v }), { fmt: (v) => `${v}%`, title: 'How much counts vary per letter' });
  const strength = slider('Paint', b().strength, 5, 100, (v) => setBrush({ strength: v }), { fmt: (v) => `${v}%`, title: 'Paint/erase strength per stroke' });
  const modeSeg = h('div', { class: 'seg', role: 'radiogroup' });
  const renderMode = () =>
    modeSeg.replaceChildren(
      ...(['add', 'replace'] as const).map((m) =>
        h('button', { 'aria-checked': String(b().mode === m), onClick: () => setBrush({ mode: m }), title: m === 'add' ? 'Stack on top of existing marks' : 'Set stacks to the new counts' }, m === 'add' ? 'Stack' : 'Replace'),
      ),
    );

  const presets = h(
    'div',
    { class: 'preset-grid' },
    ...Object.entries(PRESETS).map(([key, p]) =>
      h(
        'button',
        {
          class: 'preset',
          title: p.description,
          onClick: () => {
            const counts = { above: 0, middle: 0, below: 0, enclose: 0, bridge: 0, other: 0, ...p.counts };
            store.set({
              brush: { ...b(), counts, density: Math.round((p.density ?? 1) * 100), jitter: Math.round((p.jitter ?? 0.5) * 100), native: !!p.pool?.native },
              ...(p.pool?.sets ? { sets: p.pool.sets } : {}),
            });
            store.setDoc(
              glitch(strip(store.layer().doc, { range: range() }), {
                range: range(),
                counts: p.counts,
                density: p.density,
                jitter: p.jitter,
                pool: { ...pool(), ...p.pool },
                includeSpaces: b().includeSpaces,
              }),
            );
            flashCells(fullRange());
          },
        },
        h('b', {}, p.label),
        h('span', {}, zalgo('Glitch', { preset: key, seed: 11, exclude: UNCOVERED })),
      ),
    ),
  );

  root.replaceChildren(
    section('Presets — click to apply', presets),
    section('Marks per letter', ...sliders.map(([, s]) => s)),
    section('Spread', density, jitter, strength),
    h('div', { class: 'row' }, modeSeg, h('span', { class: 'hint' }, 'Stack adds; Replace resets stacks to these counts')),
    h(
      'div',
      { class: 'group' },
      check('Glitch new letters as you type', b().autoType, (v) => setBrush({ autoType: v })),
      check('Include spaces', b().includeSpaces, (v) => setBrush({ includeSpaces: v })),
      check('Native script marks (Devanagari marks on Devanagari, …)', b().native, (v) => setBrush({ native: v })),
    ),
    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn primary', onClick: applyBrush, title: 'G' }, 'Glitch'),
      h('button', { class: 'btn', onClick: applyReroll, title: 'R' }, 'Reroll'),
      h('button', { class: 'btn', onClick: applyStrip, title: 'X' }, 'Strip'),
    ),
    h('p', { class: 'hint' }, 'Tip: switch the stage to ✎ Paint and drag across letters to spray marks where you want them.'),
  );
  renderMode();

  store.subscribe((_s, changed) => {
    if (!changed.has('brush')) return;
    for (const [z, sl] of sliders) sl.set(b().counts[z]);
    density.set(b().density);
    jitter.set(b().jitter);
    strength.set(b().strength);
    renderMode();
  });
}

// ── Sketch ──────────────────────────────────────────────────────────
export function buildSketch() {
  const root = $('#tab-sketch');
  const canvas = h('canvas', { class: 'sketch-canvas', 'aria-label': 'Draw stack heights: above the line grows up, below grows down' });
  let target: 'both' | 'above' | 'below' = 'both';
  const targetSeg = h('div', { class: 'seg', role: 'radiogroup' });
  const renderTarget = () =>
    targetSeg.replaceChildren(
      ...(['both', 'above', 'below'] as const).map((t) => h('button', { 'aria-checked': String(target === t), onClick: () => { target = t; renderTarget(); } }, t[0]!.toUpperCase() + t.slice(1))),
    );
  renderTarget();
  const max = slider('Max height', store.state.sketch.max, 2, 80, (v) => store.set({ sketch: { ...store.state.sketch, max: v } }));
  let shapeSeed = 1;

  const r = () => fullRange();
  const current = () => ({ above: heights(store.layer().doc, 'above', r()), below: heights(store.layer().doc, 'below', r()) });
  const apply = (hs: Partial<Record<Zone, number[]>>, key = 'sketch') =>
    store.setDoc(shape(store.layer().doc, { range: r(), heights: hs, pool: pool(), rng: seeded(Date.now()) }), key);

  const applyShape = (name: string) => {
    const n = r()[1] - r()[0];
    const m = store.state.sketch.max;
    const hs = shapeHeights(name, n, m, shapeSeed++);
    apply(target === 'both' ? { above: hs, below: hs.map((v) => Math.round(v * 0.6)) } : { [target]: hs }, `shape-${Date.now()}`);
  };

  const shapes = h('div', { class: 'chips' }, ...Object.entries(SHAPES).map(([k, s]) => chip(s.label, false, () => applyShape(k))));

  root.replaceChildren(
    h('p', { class: 'hint' }, 'Draw a silhouette: each column is a letter. Above the line grows marks upward, below the line grows them down. Applies to the selection, or everything.'),
    canvas,
    h('div', { class: 'row' }, targetSeg, h('span', { class: 'hint' }, 'shapes apply to')),
    max,
    section('Shapes', shapes),
    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn', onClick: () => { const c = current(); apply({ below: c.above }); } }, 'Mirror ↓'),
      h('button', { class: 'btn', onClick: () => { const c = current(); apply({ above: c.below, below: c.above }); } }, 'Swap ⇅'),
      h('button', { class: 'btn', onClick: () => { const c = current(); const sm = (a: number[]) => a.map((v, i) => Math.round(((a[i - 1] ?? v) + v * 2 + (a[i + 1] ?? v)) / 4)); apply({ above: sm(c.above), below: sm(c.below) }); } }, 'Smooth'),
    ),
  );

  // drawing
  const ctx = canvas.getContext('2d')!;
  let drawing: { above: number[]; below: number[]; last: [number, number] | null } | null = null;
  const draw = () => {
    if (root.hidden) return;
    const dpr = devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { above, below } = drawing ?? current();
    const n = above.length || 1;
    const m = Math.max(store.state.sketch.max, ...above, ...below, 1);
    const mid = H / 2;
    const cw = W / n;
    const css = getComputedStyle(document.documentElement);
    const hot = css.getPropertyValue('--hot').trim();
    const cold = css.getPropertyValue('--cold').trim();
    const doc = store.layer().doc.slice(r()[0], r()[1]);
    ctx.font = `600 ${Math.min(14, cw * 0.8)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const a = ((above[i] ?? 0) / m) * (mid - 12);
      const b = ((below[i] ?? 0) / m) * (mid - 12);
      ctx.fillStyle = hot;
      ctx.fillRect(i * cw + cw * 0.2, mid - 9 - a, cw * 0.6, a);
      ctx.fillStyle = cold;
      ctx.fillRect(i * cw + cw * 0.2, mid + 9, cw * 0.6, b);
      ctx.fillStyle = css.getPropertyValue('--muted').trim();
      if (cw > 7) ctx.fillText(doc[i]?.base ?? doc[i]?.ch ?? '', i * cw + cw / 2, mid);
    }
  };
  const at = (e: PointerEvent): [number, number, 'above' | 'below'] => {
    const rect = canvas.getBoundingClientRect();
    const n = r()[1] - r()[0];
    const col = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - rect.left) / rect.width) * n)));
    const mid = rect.height / 2;
    const y = e.clientY - rect.top;
    const zone = y < mid ? 'above' : 'below';
    const v = Math.round((Math.abs(y - mid) / (mid - 12)) * store.state.sketch.max);
    return [col, Math.max(0, Math.min(store.state.sketch.max, v)), zone];
  };
  const stroke = `sketch-${Date.now()}`;
  let strokeKey = stroke;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drawing = { ...current(), last: null };
    strokeKey = `sketch-${Date.now()}`;
    move(e);
  });
  const move = (e: PointerEvent) => {
    if (!drawing) return;
    const [col, v, zone] = at(e);
    const arr = drawing[zone];
    const [lc, lv] = drawing.last ?? [col, v];
    // interpolate so fast strokes don't leave gaps
    const steps = Math.abs(col - lc);
    for (let k = 0; k <= steps; k++) {
      const c = steps ? lc + Math.sign(col - lc) * k : col;
      arr[c] = Math.round(lv + ((v - lv) * (steps ? k / steps : 1)));
    }
    drawing.last = [col, v];
    draw();
    apply({ above: drawing.above, below: drawing.below }, strokeKey);
  };
  canvas.addEventListener('pointermove', move);
  const end = () => { drawing = null; draw(); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  new ResizeObserver(draw).observe(canvas);
  store.subscribe((_s, changed) => {
    if (changed.has('layers') || changed.has('sel') || changed.has('active') || changed.has('sketch') || changed.has('tab')) {
      if (!drawing) requestAnimationFrame(draw);
    }
    if (changed.has('sketch')) max.set(store.state.sketch.max);
  });
}
