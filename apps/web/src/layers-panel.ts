import { compile, parse } from '@zalgollo/core';
import { BACKGROUNDS, FONTS, newLayer, store, type Layer } from './state';
import { $, h, section, slider } from './ui';

export function buildLayers() {
  const root = $('#tab-layers');
  const list = h('div', { class: 'layer-list' });
  const L = () => store.layer();

  const renderList = () => {
    const s = store.state;
    list.replaceChildren(
      ...s.layers
        .map((l, i) =>
          h(
            'div',
            { class: `layer-item${i === s.active ? ' active' : ''}`, onClick: () => store.set({ active: i, sel: null }) },
            h('span', {}, compile(l.doc).replace(/\n/g, ' ') || '(empty)'),
            h('button', { title: 'Move up', onClick: (e: Event) => { e.stopPropagation(); move(i, 1); } }, '↑'),
            h('button', { title: 'Move down', onClick: (e: Event) => { e.stopPropagation(); move(i, -1); } }, '↓'),
            h('button', { title: 'Delete', onClick: (e: Event) => { e.stopPropagation(); remove(i); } }, '✕'),
          ),
        )
        .reverse(),
    );
  };
  const move = (i: number, dir: number) => {
    const j = i + dir;
    const layers = [...store.state.layers];
    if (j < 0 || j >= layers.length) return;
    [layers[i], layers[j]] = [layers[j]!, layers[i]!];
    store.set({ layers, active: j }, { history: true });
  };
  const remove = (i: number) => {
    if (store.state.layers.length === 1) return;
    const layers = store.state.layers.filter((_, k) => k !== i);
    store.set({ layers, active: Math.min(store.state.active, layers.length - 1), sel: null }, { history: true });
  };
  const add = (layer: Layer) => {
    const layers = [...store.state.layers, layer];
    store.set({ layers, active: layers.length - 1, sel: null }, { history: true });
  };

  const font = h('select', {}, ...Object.keys(FONTS).map((k) => h('option', { value: k }, k[0]!.toUpperCase() + k.slice(1))));
  font.addEventListener('change', () => store.patchLayer({ font: font.value }));
  const color = h('input', { type: 'color' });
  color.addEventListener('input', () => store.patchLayer({ color: color.value }, 'color'));
  const glowColor = h('input', { type: 'color' });
  glowColor.addEventListener('input', () => store.patchLayer({ glowColor: glowColor.value }, 'glowcolor'));
  const sliders = {
    size: slider('Size', L().size, 12, 220, (v) => store.patchLayer({ size: v }, 'size'), { fmt: (v) => `${v}` }),
    weight: slider('Weight', L().weight, 100, 900, (v) => store.patchLayer({ weight: v }, 'weight'), { step: 100 }),
    rotate: slider('Rotate', L().rotate, -180, 180, (v) => store.patchLayer({ rotate: v }, 'rotate'), { fmt: (v) => `${v}°` }),
    opacity: slider('Opacity', L().opacity * 100, 5, 100, (v) => store.patchLayer({ opacity: v / 100 }, 'opacity'), { fmt: (v) => `${v}%` }),
    lineHeight: slider('Leading', L().lineHeight * 10, 6, 40, (v) => store.patchLayer({ lineHeight: v / 10 }, 'lh'), { fmt: (v) => (v / 10).toFixed(1) }),
    rgb: slider('RGB split', L().rgb, 0, 12, (v) => store.patchLayer({ rgb: v }, 'rgb'), { fmt: (v) => `${v}px` }),
    glow: slider('Glow', L().glow, 0, 60, (v) => store.patchLayer({ glow: v }, 'glow'), { fmt: (v) => `${v}px` }),
  };
  const bgs = h('div', { class: 'swatches' });
  const renderBgs = () =>
    bgs.replaceChildren(
      ...Object.entries(BACKGROUNDS).map(([k, v]) =>
        h('button', { class: 'swatch', title: k, 'aria-pressed': String(store.state.bg === k), style: `--sw:${v || 'var(--bg-2)'}`, onClick: () => store.set({ bg: k }) }),
      ),
    );

  root.replaceChildren(
    h('p', { class: 'hint' }, 'Compose a poster from several glitch lines, like stAllio’s text-art canvas. Click a layer on the stage to edit it; use ✥ Move to drag it.'),
    list,
    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn', onClick: () => add(newLayer('new layer', { y: 0.25 + Math.random() * 0.5, size: 48 })) }, '+ Layer'),
      h('button', { class: 'btn', onClick: () => add({ ...L(), id: Math.random().toString(36).slice(2), doc: parse(compile(L().doc)), x: Math.min(0.9, L().x + 0.04), y: Math.min(0.9, L().y + 0.06) }) }, 'Duplicate'),
      h('button', { class: 'btn', onClick: () => store.patchLayer({ x: 0.5, y: 0.5, rotate: 0 }) }, 'Center'),
    ),
    section(
      'Type',
      h('div', { class: 'prop-grid' }, h('label', {}, 'Font', font), h('label', {}, 'Colour', h('div', { class: 'row tight' }, color, h('button', { class: 'btn small', onClick: () => store.patchLayer({ color: '' }) }, 'Auto')))),
      sliders.size,
      sliders.weight,
      sliders.lineHeight,
    ),
    section('Transform', sliders.rotate, sliders.opacity),
    section('Effects', sliders.rgb, sliders.glow, h('label', { class: 'check' }, glowColor, 'Glow colour')),
    section('Stage background', bgs),
  );
  const sync = () => {
    const l = L();
    font.value = l.font;
    color.value = l.color || '#f3eefa';
    glowColor.value = l.glowColor;
    sliders.size.set(l.size);
    sliders.weight.set(l.weight);
    sliders.rotate.set(l.rotate);
    sliders.opacity.set(Math.round(l.opacity * 100));
    sliders.lineHeight.set(Math.round(l.lineHeight * 10));
    sliders.rgb.set(l.rgb);
    sliders.glow.set(l.glow);
    renderList();
    renderBgs();
  };
  sync();
  store.subscribe((_s, changed) => {
    if (changed.has('layers') || changed.has('active') || changed.has('bg')) sync();
  });
}
