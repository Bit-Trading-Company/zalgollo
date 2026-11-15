import { MARKS, ZONE_INFO, describe, glitch, reroll, strip, zonesOf, type Zone } from '@zalgollo/core';
import { pool, store } from './state';
import { $, esc, h } from './ui';

const MAX_BAR = 40;

export function renderStrip() {
  const s = store.state;
  const doc = s.layers[s.active]!.doc;
  const el = $('#strip');
  const sel = s.sel;
  el.innerHTML = doc
    .map((c, i) => {
      if (c.ch === '\n') return `<div class="col nl" data-i="${i}" title="line break"><span></span><span class="ch">↵</span><span></span></div>`;
      const z = zonesOf(c);
      const up = z.above.length;
      const dn = z.below.length;
      const extra = z.middle.length + z.enclose.length + z.bridge.length + z.other.length;
      const on = sel && i >= sel[0] && i < sel[1] ? ' sel' : '';
      const ch = c.base ?? (c.ch === ' ' ? '␣' : c.ch);
      return `<div class="col${on}" data-i="${i}" role="option" aria-selected="${!!on}" title="${esc(c.ch)} · ${c.marks.length} marks">
        ${up ? `<span class="n up">${up}</span>` : ''}<span class="bar" style="height:${Math.min(MAX_BAR, up * 2)}px"></span>
        <span class="ch${c.base ? ' styled' : ''}">${esc(ch)}</span>
        <span class="bar down" style="height:${Math.min(MAX_BAR, dn * 2)}px"></span>${dn ? `<span class="n dn">${dn}</span>` : ''}
        ${extra ? `<span class="dots">${'<i></i>'.repeat(Math.min(4, extra))}</span>` : ''}
      </div>`;
    })
    .join('');
  const n = sel ? sel[1] - sel[0] : 0;
  $('#sel-label').textContent = n ? `— ${n} selected (tools apply to these)` : '— none selected: tools apply to everything · drag to select · double-click to inspect';
}

export function initStrip() {
  const el = $('#strip');
  let anchor = -1;
  const idx = (e: Event) => {
    const col = (e.target as HTMLElement).closest<HTMLElement>('.col');
    return col ? Number(col.dataset.i) : -1;
  };
  el.addEventListener('pointerdown', (e) => {
    const i = idx(e);
    if (i < 0) return;
    const s = store.state.sel;
    anchor = e.shiftKey && s ? s[0] : i;
    store.set({ sel: [Math.min(anchor, i), Math.max(anchor, i) + 1] });
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (anchor < 0) return;
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.col');
    if (!t) return;
    const i = Number(t.dataset.i);
    const s = store.state.sel;
    const next: [number, number] = [Math.min(anchor, i), Math.max(anchor, i) + 1];
    if (!s || s[0] !== next[0] || s[1] !== next[1]) store.set({ sel: next });
  });
  el.addEventListener('pointerup', () => (anchor = -1));
  el.addEventListener('dblclick', (e) => {
    const i = idx(e);
    if (i >= 0) openCell(i, (e.target as HTMLElement).closest('.col')!.getBoundingClientRect());
  });
  $('#sel-all').addEventListener('click', () => store.set({ sel: [0, store.layer().doc.length] }));
  $('#sel-none').addEventListener('click', () => store.set({ sel: null }));
  document.addEventListener('pointerdown', (e) => {
    const pop = $('#cell-pop');
    if (!pop.hidden && !pop.contains(e.target as Node)) pop.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $('#cell-pop').hidden = true;
  });
}

let openIndex = -1;
let openRect: DOMRect | null = null;

/** The cell inspector: every mark on one letter, removable one by one. */
export function openCell(i: number, rect: DOMRect) {
  openIndex = i;
  openRect = rect;
  renderCellPop();
}

export function renderCellPop() {
  const pop = $('#cell-pop');
  const doc = store.layer().doc;
  const cell = doc[openIndex];
  if (!cell || !openRect) return void (pop.hidden = true);
  const zones = zonesOf(cell);
  const remove = (cp: number, nth: number) => {
    let seen = -1;
    const marks = cell.marks.filter((m) => !(m === cp && ++seen === nth));
    const next = [...doc];
    next[openIndex] = { ...cell, marks };
    store.setDoc(next, `cell-${openIndex}`);
  };
  const r: [number, number] = [openIndex, openIndex + 1];
  const add = (zone: Zone) => store.setDoc(glitch(doc, { range: r, counts: { [zone]: 1 }, jitter: 0, pool: pool(), includeSpaces: true }), `cell-${openIndex}`);
  const search = h('input', { type: 'search', placeholder: 'Add a mark by name… (ring, tilde, arrow)', class: 'mark-search' });
  const results = h('div', { class: 'mchips' });
  search.addEventListener('input', () => {
    const q = search.value.trim().toUpperCase();
    results.replaceChildren(
      ...(q.length < 2 ? [] : MARKS.filter((m) => describe(m.cp).name.includes(q)).slice(0, 36)).map((m) =>
        h('button', { class: 'mchip', title: describe(m.cp).name, onClick: () => { const next = [...store.layer().doc]; const c = next[openIndex]!; next[openIndex] = { ...c, marks: [...c.marks, m.cp] }; store.setDoc(next, `cell-${openIndex}`); } }, `◌${m.char}`),
      ),
    );
  });
  const glyph = (cell.base ?? cell.ch) + String.fromCodePoint(...cell.marks);
  pop.replaceChildren(
    h('h4', {}, `Letter ${openIndex + 1}: “${cell.ch}”`, h('span', { class: 'muted small' }, `${cell.marks.length} marks`)),
    h('div', { class: 'pop-glyph' }, glyph),
    ...(Object.keys(ZONE_INFO) as Zone[])
      .filter((z) => zones[z].length || ['above', 'middle', 'below'].includes(z))
      .map((z) => {
        const counts = new Map<number, number>();
        return h(
          'div',
          { class: 'zone-row' },
          h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'field-label' }, `${ZONE_INFO[z].label} · ${zones[z].length}`), z !== 'invisible' ? h('button', { class: 'btn small', onClick: () => add(z) }, '+ random') : ''),
          h(
            'div',
            { class: 'mchips' },
            ...zones[z].map((cp) => {
              const nth = counts.get(cp) ?? 0;
              counts.set(cp, nth + 1);
              return h('button', { class: 'mchip', title: `${describe(cp).hex} ${describe(cp).name} — click to remove`, onClick: () => remove(cp, nth) }, `◌${String.fromCodePoint(cp)}`, h('i', {}, '×'));
            }),
          ),
        );
      }),
    h('div', { class: 'group' }, search, results),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn small', onClick: () => store.setDoc(reroll(doc, { range: r, pool: pool() })) }, 'Reroll'),
      h('button', { class: 'btn small', onClick: () => store.setDoc(strip(doc, { range: r })) }, 'Strip'),
      h('button', { class: 'btn small', onClick: () => (pop.hidden = true) }, 'Close'),
    ),
  );
  pop.hidden = false;
  const top = Math.min(innerHeight - pop.offsetHeight - 10, openRect.bottom + 8);
  pop.style.top = `${Math.max(10, top)}px`;
  pop.style.left = `${Math.max(10, Math.min(innerWidth - 330, openRect.left - 140))}px`;
}

export const isCellPopOpen = () => !$('#cell-pop').hidden;
