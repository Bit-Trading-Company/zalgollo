import { clean, inspect, parse, revealInk, stripInvisible } from '@zalgollo/core';
import { activeOutput, newLayer, store } from './state';
import { $, copyText, debounce, esc, h, section, toast } from './ui';

export function buildXray() {
  const root = $('#tab-xray');
  const statsEl = h('div', { class: 'xray-stats' });
  const listEl = h('div', { class: 'cp-list' });
  let onlyHidden = false;
  let source: 'output' | 'paste' = 'output';
  const paste = h('textarea', { class: 'paste', placeholder: 'Paste any text to analyse or clean — zalgo, styled, invisible…' });
  const inkOut = h('p', { class: 'hint' });

  const text = () => (source === 'paste' && paste.value ? paste.value : activeOutput());
  const render = () => {
    if (root.hidden) return;
    const r = inspect(text(), 3000);
    const st = r.stats;
    statsEl.innerHTML = [
      [st.graphemes, 'letters'],
      [st.codePoints, 'code points'],
      [st.utf16, 'UTF-16 units'],
      [st.utf8Bytes, 'UTF-8 bytes'],
      [st.marks, 'marks'],
      [st.maxStack, 'tallest stack'],
    ]
      .map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`)
      .join('');
    listEl.innerHTML = r.graphemes
      .map((g) => {
        const cps = onlyHidden ? g.codePoints.filter((c) => c.invisible || c.zone) : g.codePoints;
        if (!cps.length) return '';
        return `<div class="cp-g">${cps
          .map((c) => `<div class="cp${c.invisible ? ' inv' : ''}"><span class="g">${c.invisible ? '·' : c.zone ? '◌' + esc(c.char) : esc(c.char)}</span><span class="h">${c.hex}</span><span class="nm" title="${esc(c.name || c.category)}">${esc((c.name || c.category).toLowerCase())}</span></div>`)
          .join('')}</div>`;
      })
      .join('') + (r.truncated ? '<p class="hint">…truncated</p>' : '');
    const inks = revealInk(text());
    inkOut.textContent = inks.length ? `🔍 Hidden ink found: ${inks.map((i) => `“${i.message}” (${i.method})`).join(', ')}` : 'No hidden ink found.';
  };
  const srcSeg = h('div', { class: 'seg' });
  const renderSrc = () =>
    srcSeg.replaceChildren(
      ...(['output', 'paste'] as const).map((v) => h('button', { 'aria-checked': String(source === v), onClick: () => { source = v; renderSrc(); render(); } }, v === 'output' ? 'This layer' : 'Pasted text')),
      h('button', { 'aria-pressed': String(onlyHidden), onClick: () => { onlyHidden = !onlyHidden; renderSrc(); render(); }, title: 'Show only marks and invisible characters' }, 'Marks & hidden only'),
    );
  paste.addEventListener('input', () => {
    source = 'paste';
    renderSrc();
    render();
  });

  root.replaceChildren(
    srcSeg,
    statsEl,
    inkOut,
    listEl,
    section(
      'Analyse & clean other text',
      paste,
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn', onClick: () => copyText(clean(text()), 'Copied cleaned text') }, 'Clean'),
        h('button', { class: 'btn', onClick: () => copyText(stripInvisible(text()), 'Copied without invisibles') }, 'Strip hidden'),
        h('button', {
          class: 'btn',
          title: 'Open the pasted text in the studio as a new layer — marks and all',
          onClick: () => {
            if (!paste.value) return toast('Paste something first', 'error');
            const layers = [...store.state.layers, { ...newLayer(''), doc: parse(paste.value) }];
            store.set({ layers, active: layers.length - 1, sel: null }, { history: true });
            toast('Loaded as a new layer');
          },
        }, 'Edit it'),
      ),
    ),
  );
  renderSrc();
  const later = debounce(render, 120);
  store.subscribe((_s, changed) => {
    if (changed.has('layers') || changed.has('active') || changed.has('tab')) later();
  });
}
