import { PRESETS, glitch, parse, reroll, seeded, shape, shapeHeights, zalgo, zalgoDoc, type Doc, type PoolSpec } from '@zalgollo/core';
import { store } from './state';
import { $, h, reducedMotion } from './ui';

/** Hero title: marks swell and recede like breathing. */
function boilTitle() {
  const el = $('#hero-glitch');
  const brand = $('#brand-text');
  brand.textContent = zalgo('zalgollo', { counts: { above: 1, below: 1 }, density: 0.5, sets: ['classic'], seed: 4 });
  if (reducedMotion()) {
    el.textContent = zalgo('zalgollo', { preset: 'classic', seed: 3 });
    return;
  }
  let t = 0;
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e!.isIntersecting)).observe(el);
  setInterval(() => {
    if (!visible || document.hidden) return;
    t += 1;
    const k = (Math.sin(t / 9) + 1) / 2; // 0..1
    el.textContent = zalgo('zalgollo', { counts: { above: 1 + k * 4, middle: k > 0.85 ? 1 : 0, below: 1 + k * 3 }, jitter: 0.7, sets: ['classic'], seed: t });
  }, 110);
}

interface Recipe {
  title: string;
  text: string;
  note: string;
  make: (text: string) => Doc;
  pool?: PoolSpec;
}

const RECIPES: Recipe[] = [
  ...Object.entries(PRESETS).map(([k, p]) => ({
    title: p.label,
    note: p.description,
    text: { whisper: 'whisper', classic: 'he comes', 'he-comes': 'HE COMES', crown: 'crowned', drip: 'drip', strike: 'redacted', halo: 'halo', bridges: 'bridges', letters: 'murmur', thai: 'tower', monolith: 'monolith', static: 'static', native: 'नमस्ते мир', chaos: 'CHAOS' }[k] ?? p.label,
    make: (t: string) => zalgoDoc(t, { preset: k, seed: 99 }).doc,
    pool: p.pool,
  })),
  { title: 'Mountain', note: 'Sketched silhouette: a peak of marks', text: 'mountain', make: (t) => shape(parse(t), { heights: { above: shapeHeights('mountain', t.length, 18) }, pool: { sets: ['classic'] }, rng: seeded(5) }) },
  { title: 'Wave', note: 'Sketched sine wave above and below', text: 'oscillate', make: (t) => shape(parse(t), { heights: { above: shapeHeights('wave', t.length, 12), below: shapeHeights('wave', t.length, 12).reverse() }, pool: { sets: ['classic'] }, rng: seeded(6) }) },
  { title: 'Skyline', note: 'Random city of stacked towers', text: 'skyline city', make: (t) => shape(parse(t), { heights: { above: shapeHeights('skyline', t.length, 20, 9) }, pool: { sets: ['classic', 'supplement'] }, rng: seeded(7) }) },
];

function buildRecipes() {
  const grid = $('#recipe-grid');
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        setTimeout(() => el.classList.add('in'), Number(el.dataset.delay ?? 0));
        io.unobserve(el);
      }
    },
    { threshold: 0.1 },
  );
  RECIPES.forEach((r, i) => {
    const doc = r.make(r.text);
    const art = h('div', { class: 'art' });
    const show = (d: Doc) => (art.textContent = d.map((c) => (c.base ?? c.ch) + String.fromCodePoint(...c.marks)).join(''));
    show(doc);
    let timer: ReturnType<typeof setInterval> | undefined;
    const card = h(
      'button',
      {
        class: 'recipe',
        'data-delay': String((i % 4) * 70),
        onMouseenter: () => {
          if (reducedMotion()) return;
          timer = setInterval(() => show(reroll(doc, { pool: r.pool ?? { sets: ['classic'] } })), 90);
        },
        onMouseleave: () => {
          clearInterval(timer);
          show(doc);
        },
        onClick: () => {
          const layers = [...store.state.layers];
          layers[store.state.active] = { ...store.layer(), doc: r.make(r.text) };
          store.set({ layers, sel: null }, { history: true });
          $('#studio').scrollIntoView({ behavior: 'smooth' });
        },
      },
      art,
      h('div', {}, h('b', {}, r.title), h('p', {}, r.note)),
    );
    grid.append(card);
    io.observe(card);
  });
}

function buildAnatomy() {
  const el = $('#anatomy-glyph');
  let doc = parse('a');
  doc = glitch(doc, { counts: { above: 5, below: 5, middle: 1 }, jitter: 0, pool: { sets: ['classic'] }, rng: seeded(21) });
  const show = (d: Doc) => (el.textContent = d.map((c) => c.ch + String.fromCodePoint(...c.marks)).join(''));
  show(doc);
  if (!reducedMotion()) setInterval(() => !document.hidden && show(reroll(doc, { pool: { sets: ['classic'] } })), 700);
}

export function initHero() {
  boilTitle();
  buildRecipes();
  buildAnatomy();
  $('#footer-glitch').textContent = zalgo('bit trading company', { preset: 'drip', seed: 2 });
}
