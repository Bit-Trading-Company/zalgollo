import { compile, erase, glitch, reroll, type Doc } from '@zalgollo/core';
import { BACKGROUNDS, FONTS, finishText, layerOutput, pool, store, type Layer } from './state';
import { $, download, esc, reducedMotion } from './ui';

const stage = () => $('#stage');
let boilFrame = 0;
let boilDocs: Doc[] | null = null;

const cellHtml = (doc: Doc, sel: [number, number] | null, active: boolean) =>
  doc
    .map((c, i) => {
      const glyph = (c.base ?? c.ch) + String.fromCodePoint(...c.marks);
      if (c.ch === '\n') return '\n';
      const s = active && sel && i >= sel[0] && i < sel[1] ? ' sel' : '';
      return `<span class="cell${s}" data-i="${i}">${esc(glyph)}</span>`;
    })
    .join('');

function layerStyle(l: Layer) {
  const shadows = [
    l.rgb ? `${-l.rgb}px 0 #ff2bd6, ${l.rgb}px 0 #29f0ff` : '',
    l.glow ? `0 0 ${l.glow}px ${l.glowColor}` : '',
  ].filter(Boolean);
  return [
    `font-family:${FONTS[l.font] ?? l.font}`,
    `font-size:${l.size}px`,
    `font-weight:${l.weight}`,
    `color:${l.color || 'var(--stage-text)'}`,
    `opacity:${l.opacity}`,
    `--lh:${l.lineHeight}`,
    shadows.length ? `text-shadow:${shadows.join(',')}` : '',
  ].join(';');
}

function place(el: HTMLElement, l: Layer) {
  const st = stage();
  el.style.left = `${l.x * st.clientWidth}px`;
  el.style.top = `${l.y * st.clientHeight}px`;
  el.style.transform = `translate(-50%, -50%) rotate(${l.rotate}deg)`;
}

/** Full re-render of every layer. */
export function renderStage() {
  const s = store.state;
  const st = stage();
  st.dataset.mode = s.mode;
  const bg = BACKGROUNDS[s.bg] ?? s.bg;
  st.style.setProperty('--stage-bg', bg || 'var(--bg-2)');
  // reuse layer elements so transitions and pointer captures survive
  const existing = new Map([...st.querySelectorAll<HTMLElement>('.layer')].map((el) => [el.dataset.id!, el]));
  s.layers.forEach((l, i) => {
    let el = existing.get(l.id);
    existing.delete(l.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'layer';
      el.dataset.id = l.id;
      st.append(el);
    }
    el.style.zIndex = String(i + 1);
    el.classList.toggle('active', i === s.active && s.layers.length > 1);
    el.dataset.index = String(i);
    el.style.cssText = `${layerStyle(l)};z-index:${i + 1}`;
    const doc = boilDocs?.[i] ?? l.doc;
    el.innerHTML = cellHtml(doc, s.sel, i === s.active) || '<span class="cell muted" data-i="0">…</span>';
    place(el, l);
    el.setAttribute('aria-label', `Layer ${i + 1}: ${compile(l.doc)}`);
  });
  for (const el of existing.values()) el.remove();
}

export function flashCells(range: [number, number]) {
  const el = stage().querySelector<HTMLElement>(`.layer[data-index="${store.state.active}"]`);
  if (!el) return;
  for (const c of el.querySelectorAll<HTMLElement>('.cell')) {
    const i = Number(c.dataset.i);
    if (i >= range[0] && i < range[1]) {
      c.classList.remove('flash');
      void c.offsetWidth;
      c.classList.add('flash');
    }
  }
}

// ── boil: reroll marks every frame (display only) ───────────────────
export function setBoil(on: boolean) {
  cancelAnimationFrame(boilFrame);
  boilDocs = null;
  if (!on || reducedMotion()) return renderStage();
  let last = 0;
  const tick = (t: number) => {
    if (t - last > 85) {
      last = t;
      boilDocs = store.state.layers.map((l) => reroll(l.doc, { pool: pool() }));
      renderStage();
    }
    boilFrame = requestAnimationFrame(tick);
  };
  boilFrame = requestAnimationFrame(tick);
}

// ── pointer interactions ───────────────────────────────────────────
function cellAt(x: number, y: number): { layer: number; i: number } | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const cell = el?.closest<HTMLElement>('.cell');
  const layer = el?.closest<HTMLElement>('.layer');
  if (!layer) return null;
  return { layer: Number(layer.dataset.index), i: cell ? Number(cell.dataset.i) : -1 };
}

export function initStage() {
  const st = stage();
  let drag: null | { kind: 'select' | 'paint' | 'move'; start: number; stroke: string; lastI: number; lastT: number; ox: number; oy: number } = null;

  const applyStroke = (i: number, stroke: string) => {
    const s = store.state;
    const doc = store.layer().doc;
    if (i < 0 || i >= doc.length) return;
    const k = s.brush.strength / 100;
    if (s.mode === 'paint') {
      const counts = Object.fromEntries(Object.entries(s.brush.counts).map(([z, n]) => [z, n * k])) as typeof s.brush.counts;
      if (!Object.values(counts).some((n) => n >= 0.5)) counts.above = 1;
      store.setDoc(glitch(doc, { range: [i, i + 1], counts, jitter: s.brush.jitter / 100, pool: pool(), includeSpaces: s.brush.includeSpaces }), stroke);
    } else {
      const total = doc[i]!.marks.length;
      store.setDoc(erase(doc, { range: [i, i + 1], count: Math.max(1, Math.ceil(total * k)) }), stroke);
    }
  };

  st.addEventListener('pointerdown', (e) => {
    const hit = cellAt(e.clientX, e.clientY);
    const s = store.state;
    if (!hit) {
      if (s.mode === 'edit') store.set({ sel: null });
      return;
    }
    if (hit.layer !== s.active) store.set({ active: hit.layer, sel: null });
    st.setPointerCapture(e.pointerId);
    const stroke = `stroke-${Date.now()}`;
    const l = store.layer();
    if (s.mode === 'move') {
      drag = { kind: 'move', start: 0, stroke, lastI: -1, lastT: 0, ox: e.clientX - l.x * st.clientWidth, oy: e.clientY - l.y * st.clientHeight };
    } else if (s.mode === 'edit') {
      if (hit.i < 0) return;
      drag = { kind: 'select', start: hit.i, stroke, lastI: hit.i, lastT: 0, ox: 0, oy: 0 };
      const sel = e.shiftKey && s.sel ? ([Math.min(s.sel[0], hit.i), Math.max(s.sel[1], hit.i + 1)] as [number, number]) : ([hit.i, hit.i + 1] as [number, number]);
      store.set({ sel });
    } else {
      drag = { kind: 'paint', start: hit.i, stroke, lastI: hit.i, lastT: performance.now(), ox: 0, oy: 0 };
      applyStroke(hit.i, stroke);
    }
    e.preventDefault();
  });

  st.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.kind === 'move') {
      const x = Math.min(1, Math.max(0, (e.clientX - drag.ox) / st.clientWidth));
      const y = Math.min(1, Math.max(0, (e.clientY - drag.oy) / st.clientHeight));
      store.patchLayer({ x, y }, drag.stroke);
      return;
    }
    const hit = cellAt(e.clientX, e.clientY);
    if (!hit || hit.layer !== store.state.active || hit.i < 0) return;
    if (drag.kind === 'select') {
      if (hit.i !== drag.lastI) {
        drag.lastI = hit.i;
        store.set({ sel: [Math.min(drag.start, hit.i), Math.max(drag.start, hit.i) + 1] });
      }
      return;
    }
    const now = performance.now();
    // new letter, or keep spraying while hovering the same one
    if (hit.i !== drag.lastI || now - drag.lastT > 110) {
      drag.lastI = hit.i;
      drag.lastT = now;
      applyStroke(hit.i, drag.stroke);
    }
  });

  const end = () => (drag = null);
  st.addEventListener('pointerup', end);
  st.addEventListener('pointercancel', end);
  new ResizeObserver(() => renderStage()).observe(st);
}

// ── PNG export ─────────────────────────────────────────────────────
function paintBackground(ctx: CanvasRenderingContext2D, css: string, w: number, h: number) {
  const colors = css.match(/#[0-9a-f]{3,8}/gi) ?? [];
  if (css.startsWith('linear-gradient')) {
    const angle = Number(css.match(/(\d+)deg/)?.[1] ?? 180) * (Math.PI / 180);
    const dx = Math.sin(angle) * w / 2;
    const dy = -Math.cos(angle) * h / 2;
    const g = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
    colors.forEach((c, i) => g.addColorStop(i / Math.max(1, colors.length - 1), c));
    ctx.fillStyle = g;
  } else if (css.startsWith('radial-gradient')) {
    const [px, py] = (css.match(/at (\d+)% (\d+)%/) ?? [0, 50, 50]).slice(1).map(Number) as [number, number];
    const g = ctx.createRadialGradient((px / 100) * w, (py / 100) * h, 0, (px / 100) * w, (py / 100) * h, Math.max(w, h) * 0.75);
    colors.forEach((c, i) => g.addColorStop(i / Math.max(1, colors.length - 1), c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = css;
  ctx.fillRect(0, 0, w, h);
}

export async function exportPng() {
  const st = stage();
  const w = st.clientWidth;
  const h = st.clientHeight;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  const css = getComputedStyle(st);
  const bg = BACKGROUNDS[store.state.bg] || css.getPropertyValue('--bg-2').trim() || '#0d0b12';
  paintBackground(ctx, bg, w, h);
  const themeText = css.getPropertyValue('--stage-text').trim() || '#f3eefa';
  for (const l of store.state.layers) {
    const lines = layerOutput(l).split('\n');
    ctx.save();
    ctx.translate(l.x * w, l.y * h);
    ctx.rotate((l.rotate * Math.PI) / 180);
    ctx.globalAlpha = l.opacity;
    ctx.font = `${l.weight} ${l.size}px ${FONTS[l.font] ?? l.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lh = l.size * l.lineHeight;
    const draw = (color: string, dx: number) =>
      lines.forEach((line, i) => {
        ctx.fillStyle = color;
        ctx.fillText(line, dx, (i - (lines.length - 1) / 2) * lh);
      });
    if (l.rgb) {
      draw('#ff2bd6', -l.rgb);
      draw('#29f0ff', l.rgb);
    }
    if (l.glow) {
      ctx.shadowColor = l.glowColor;
      ctx.shadowBlur = l.glow * scale;
    }
    draw(l.color || themeText, 0);
    ctx.restore();
  }
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
  download(`zalgollo-${Date.now()}.png`, blob);
}

export const allOutput = () => store.state.layers.map((l) => finishText(compile(l.doc), l.finish)).join('\n');
