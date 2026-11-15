import { PRESETS, glitch, grow, parse, reroll, seeded, shape, shapeHeights, zalgo, zalgoDoc, type Doc, type PoolSpec } from '@zalgollo/core';
import { UNCOVERED, store } from './state';
import { $, h, reducedMotion } from './ui';

const docText = (d: Doc) => d.map((c) => (c.base ?? c.ch) + String.fromCodePoint(...c.marks)).join('');
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * Hero title: marks grow out of the bare word over a few seconds with a fading shimmer,
 * then settle into the finished piece and stop. Hover to summon it again.
 */
function animateTitle() {
  const el = $('#hero-glitch');
  $('#brand-text').textContent = zalgo('zalgollo', { counts: { above: 1, below: 1 }, density: 0.5, sets: ['classic'], seed: 4 });
  const heroPool = { sets: ['classic', 'supplement'], exclude: UNCOVERED };
  const final = glitch(parse('zalgollo'), { counts: { above: 3, middle: 0.3, below: 2.5 }, jitter: 0.6, pool: heroPool, rng: seeded(7) });
  el.textContent = docText(final);
  if (reducedMotion()) return;
  const DURATION = 3200;
  let raf = 0;
  const run = () => {
    cancelAnimationFrame(raf);
    el.classList.add('animating');
    const start = performance.now();
    let last = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      if (now - last > 70 || t === 1) {
        last = now;
        // grow the stacks, and let a fading share of marks shimmer
        const shimmer = 0.5 * (1 - t) * (1 - t);
        el.textContent = docText(t < 1 ? reroll(grow(final, easeOut(t)), { probability: shimmer, pool: heroPool }) : final);
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else el.classList.remove('animating');
    };
    raf = requestAnimationFrame(tick);
  };
  run();
  let cooldown = 0;
  el.addEventListener('mouseenter', () => {
    if (performance.now() > cooldown) {
      cooldown = performance.now() + DURATION + 400;
      run();
    }
  });
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
    make: (t: string) => zalgoDoc(t, { preset: k, seed: 99, exclude: UNCOVERED }).doc,
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
          let cur = doc;
          timer = setInterval(() => show((cur = reroll(cur, { pool: { ...(r.pool ?? { sets: ['classic'] }), exclude: UNCOVERED }, probability: 0.25 }))), 120);
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
}

export function initHero() {
  animateTitle();
  buildRecipes();
  buildAnatomy();
  $('#footer-glitch').textContent = zalgo('bit trading company', { preset: 'drip', seed: 2 });
}
