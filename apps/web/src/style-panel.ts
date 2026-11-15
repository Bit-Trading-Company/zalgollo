import { BLANKS, INVISIBLES, MONUMENT_CHARS, SCRAMBLE_BLOCKS, STYLES, describe, plainText, reverse, scramble, style, styleText } from '@zalgollo/core';
import { flashCells } from './stage';
import { range, store, type Finish } from './state';
import { $, chip, h, section, slider, toast } from './ui';

export function buildStyle() {
  const root = $('#tab-style');
  const grid = h('div', { class: 'style-grid' });
  const sample = () => (plainText(store.layer().doc).replace(/\n/g, ' ').trim() || 'Zalgollo').slice(0, 18);
  const renderStyles = () =>
    grid.replaceChildren(
      h('button', { class: 'style-btn', onClick: () => apply('none') }, sample(), h('small', {}, 'none — plain')),
      ...Object.entries(STYLES).map(([k, label]) => h('button', { class: 'style-btn', onClick: () => apply(k), title: label }, styleText(sample(), k), h('small', {}, label))),
    );
  const apply = (k: string) => {
    let doc = style(store.layer().doc, k, { range: range() });
    if (k === 'upside-down') doc = reverse(doc, { range: range() });
    store.setDoc(doc);
    flashCells(range() ?? [0, doc.length]);
  };

  let blocks = ['Runic'];
  let prob = 100;
  const blockChips = h('div', { class: 'chips' });
  const renderBlocks = () =>
    blockChips.replaceChildren(
      ...SCRAMBLE_BLOCKS.map(([name]) =>
        chip(name.replace('Unified Canadian Aboriginal Syllabics', 'Canadian Syllabics').replace('CJK Unified Ideographs', 'CJK'), blocks.includes(name), () => {
          blocks = blocks.includes(name) ? blocks.filter((b) => b !== name) : [...blocks, name];
          if (!blocks.length) blocks = [name];
          renderBlocks();
        }),
      ),
    );
  renderBlocks();

  root.replaceChildren(
    section('Alphabets — applies to selection or all', grid),
    h('p', { class: 'hint' }, 'The studio renders in Zalgollo Sans/Serif/Mono — merged fonts that carry these alphabets and their marks together. Other apps use their own fonts, where heavily stacked styled letters can show as boxes; keep stacks light if it must render everywhere.'),
    section(
      'Scramble — swap letters for random characters (marks stay)',
      blockChips,
      slider('Chance', prob, 5, 100, (v) => (prob = v), { fmt: (v) => `${v}%` }),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn primary', onClick: () => { store.setDoc(scramble(store.layer().doc, { range: range(), blocks, probability: prob / 100 })); flashCells(range() ?? [0, store.layer().doc.length]); } }, 'Scramble'),
        h('button', { class: 'btn', onClick: () => apply('none') }, 'Unscramble'),
        h('span', {}),
      ),
    ),
  );
  renderStyles();
  store.subscribe((_s, changed) => {
    if (changed.has('layers') || changed.has('active')) renderStyles();
  });
}

/** Insert text at the caret of the main text field. */
function insertAtCaret(text: string) {
  const ta = $<HTMLTextAreaElement>('#text-input');
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? start;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  ta.dispatchEvent(new Event('input'));
}

export function buildForbidden() {
  const root = $('#tab-forbidden');
  const f = () => store.layer().finish;
  const setF = (patch: Partial<Finish>) => store.patchLayer({ finish: { ...f(), ...patch } }, 'finish');

  const weaveSel = h('select', { 'aria-label': 'Invisible weave' }, h('option', { value: 'none' }, 'No weave'), ...Object.entries(INVISIBLES).map(([k, v]) => h('option', { value: k, title: v.description }, v.label)));
  weaveSel.addEventListener('change', () => setF({ weave: weaveSel.value }));
  const weaveDensity = slider('Density', f().weaveDensity, 5, 100, (v) => setF({ weaveDensity: v }), { fmt: (v) => `${v}%` });
  const bidiSeg = h('div', { class: 'seg' });
  const renderBidi = () =>
    bidiSeg.replaceChildren(
      ...(['none', 'rlo', 'mirror', 'isolate'] as const).map((m) =>
        h('button', { 'aria-checked': String(f().bidi === m), onClick: () => setF({ bidi: m }), title: { none: 'Normal direction', rlo: 'Right-to-left override: renders backwards, copies forwards', mirror: 'Text + its reversed twin', isolate: 'Isolate so it cannot flip neighbouring text' }[m] }, { none: 'None', rlo: 'Reverse', mirror: 'Mirror', isolate: 'Isolate' }[m]),
      ),
    );
  const ink = h('textarea', { class: 'paste', placeholder: 'Secret message — invisible in the output, revealed by X-ray', rows: 2 });
  ink.addEventListener('input', () => setF({ ink: ink.value }));
  const inkMethod = h('select', {}, h('option', { value: 'variation' }, 'Variation selectors (any text)'), h('option', { value: 'tags' }, 'Tag characters (ASCII)'));
  inkMethod.addEventListener('change', () => setF({ inkMethod: inkMethod.value as Finish['inkMethod'] }));

  const blanks = h('div', { class: 'row tight' }, ...Object.entries(BLANKS).map(([, b]) => h('button', { class: 'btn small', title: b.label, onClick: () => { insertAtCaret(b.char); toast(`Inserted ${b.label.split(' —')[0]}`); } }, b.label.split(' —')[0]!)));
  const monuments = h(
    'div',
    { class: 'monuments' },
    ...MONUMENT_CHARS.map((c) => h('button', { title: describe(c.codePointAt(0)!).name, onClick: () => insertAtCaret(c) }, c)),
  );

  root.replaceChildren(
    h('p', { class: 'hint' }, 'Finishing passes applied to this layer’s output when you copy it. Use responsibly — some of these can confuse apps, screen readers and filters.'),
    section('Invisible weave — hide characters between every letter', weaveSel, weaveDensity),
    section('Direction tricks', bidiSeg),
    section('Invisible ink', ink, inkMethod),
    section('Blank characters — insert at the text cursor', blanks),
    section('Monuments — huge glyphs that break line boxes', monuments),
  );
  const sync = () => {
    weaveSel.value = f().weave;
    weaveDensity.set(f().weaveDensity);
    if (document.activeElement !== ink) ink.value = f().ink;
    inkMethod.value = f().inkMethod;
    renderBidi();
  };
  sync();
  store.subscribe((_s, changed) => {
    if (changed.has('layers') || changed.has('active')) sync();
  });
}
