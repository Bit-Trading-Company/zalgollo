import { MARKS, MARK_SETS, ZONE_INFO, addMark, describe, resolvePool, type Zone } from '@zalgollo/core';
import { flashCells } from './stage';
import { FONTS, pool, range, store } from './state';
import { $, chip, h, section, toast } from './ui';

let unsupported = new Set<number>();

/**
 * Detect marks this device can't draw in the active layer's font when mixed with other marks.
 * Browsers shape a whole cluster in one font, so a missing mark falls back to a "last resort"
 * placeholder box: zero advance, but wide ink. We measure ink width on a canvas.
 */
function testDevice(): Set<number> {
  const l = store.layer();
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `${l.weight} 40px ${FONTS[l.font] ?? l.font}`;
  const ink = (s: string) => {
    const m = ctx.measureText(s);
    return m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  };
  const ref = ink('o\u0301');
  const bad = new Set<number>();
  for (const m of MARKS) {
    if (m.zone === 'invisible' || m.zone === 'bridge') continue;
    const limit = m.zone === 'enclose' ? ref * 2.6 : ref * 1.45;
    if (ink('o\u0301' + m.char) > limit) bad.add(m.cp);
  }
  return bad;
}

export function buildMarks() {
  const root = $('#tab-marks');
  let zone: Zone | 'all' = 'all';
  let show: 'pool' | 'all' = 'all';
  let clickMode: 'add' | 'toggle' = 'add';
  let query = '';

  const setChips = h('div', { class: 'chips' });
  const renderSets = () => {
    const s = store.state.sets;
    setChips.replaceChildren(
      ...Object.entries(MARK_SETS).map(([k, set]) =>
        chip(
          set.label,
          s.includes(k),
          () => store.set({ sets: s.includes(k) ? s.filter((x) => x !== k) : [...s, k] }),
          set.description,
        ),
      ),
    );
  };
  const summary = h('p', { class: 'hint' });
  const renderSummary = () => {
    let p;
    try {
      p = resolvePool(pool());
    } catch {
      return;
    }
    summary.textContent =
      `Pool: ${(['above', 'middle', 'below', 'enclose', 'bridge', 'other'] as Zone[]).map((z) => `${p[z].length} ${ZONE_INFO[z].label.toLowerCase()}`).join(' · ')}` +
      (store.state.exclude.length ? ` · ${store.state.exclude.length} excluded` : '');
  };

  const search = h('input', { type: 'search', class: 'mark-search', placeholder: 'Search 2,103 marks by name — ring, tilde, arrow, dot…' });
  search.addEventListener('input', () => {
    query = search.value.trim().toUpperCase();
    filter();
  });
  const zoneChips = h('div', { class: 'chips' });
  const renderZones = () =>
    zoneChips.replaceChildren(
      chip('All zones', zone === 'all', () => { zone = 'all'; renderZones(); filter(); }),
      ...(Object.keys(ZONE_INFO) as Zone[]).map((z) => chip(ZONE_INFO[z].label, zone === z, () => { zone = z; renderZones(); filter(); }, ZONE_INFO[z].description)),
    );
  const segs = h('div', { class: 'row' });
  const renderSegs = () =>
    segs.replaceChildren(
      h('div', { class: 'seg' }, ...(['all', 'pool'] as const).map((v) => h('button', { 'aria-checked': String(show === v), onClick: () => { show = v; renderSegs(); filter(); } }, v === 'all' ? 'All marks' : 'In pool'))),
      h('div', { class: 'seg', title: 'What clicking a mark does' }, ...(['add', 'toggle'] as const).map((v) => h('button', { 'aria-checked': String(clickMode === v), onClick: () => { clickMode = v; renderSegs(); } }, v === 'add' ? 'Click adds' : 'Click excludes'))),
    );

  // one tile per mark, built once
  const grid = h('div', { class: 'mark-grid' });
  const tiles = new Map<number, HTMLButtonElement>();
  const headers: { el: HTMLElement; cps: number[] }[] = [];
  let lastBlock = '';
  let current: number[] = [];
  for (const m of MARKS) {
    if (m.block !== lastBlock) {
      current = [];
      const el = h('p', { class: 'mark-block' }, m.block);
      headers.push({ el, cps: current });
      grid.append(el);
      lastBlock = m.block;
    }
    current.push(m.cp);
    const name = describe(m.cp).name;
    const t = h('button', { class: 'mk', 'data-cp': String(m.cp), title: `${describe(m.cp).hex} ${name} · ${ZONE_INFO[m.zone].label}`, 'aria-label': name }, (m.zone === 'invisible' ? '·' : '◌') + m.char);
    tiles.set(m.cp, t);
    grid.append(t);
  }
  grid.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('.mk');
    if (!t) return;
    const cp = Number(t.dataset.cp);
    if (clickMode === 'toggle' || e.altKey) {
      const ex = store.state.exclude;
      store.set({ exclude: ex.includes(cp) ? ex.filter((x) => x !== cp) : [...ex, cp] });
    } else {
      store.setDoc(addMark(store.layer().doc, cp, { range: range() }), `add-${cp}`);
      flashCells(range() ?? [0, store.layer().doc.length]);
      toast(`Added ${describe(cp).name.toLowerCase()}`);
    }
  });

  const filter = () => {
    let p: ReturnType<typeof resolvePool> | null = null;
    try {
      p = resolvePool(pool());
    } catch {}
    const inPool = new Set(p ? Object.values(p).flat() : []);
    const ex = new Set(store.state.exclude);
    for (const m of MARKS) {
      const t = tiles.get(m.cp)!;
      const visible = (zone === 'all' || m.zone === zone) && (show === 'all' || inPool.has(m.cp)) && (!query || describe(m.cp).name.includes(query) || describe(m.cp).hex.includes(query));
      t.hidden = !visible;
      t.classList.toggle('off', ex.has(m.cp) || (show === 'all' && !inPool.has(m.cp)));
      t.classList.toggle('bad', unsupported.has(m.cp));
    }
    for (const hd of headers) hd.el.hidden = hd.cps.every((cp) => tiles.get(cp)!.hidden);
  };

  const deviceBtn = h('button', {
    class: 'btn',
    onClick: () => {
      unsupported = testDevice();
      filter();
      toast(`${unsupported.size} marks can't be drawn by this device's fonts`);
      excludeBtn.hidden = !unsupported.size;
    },
  }, 'Test my device');
  const excludeBtn = h('button', { class: 'btn', hidden: true, onClick: () => store.set({ exclude: [...new Set([...store.state.exclude, ...unsupported])] }) }, 'Exclude unsupported');

  root.replaceChildren(
    section('Mark sets in the pool', setChips),
    summary,
    h('div', { class: 'row' }, deviceBtn, excludeBtn, h('button', { class: 'btn', onClick: () => store.set({ exclude: [] }) }, 'Reset exclusions')),
    search,
    zoneChips,
    segs,
    h('p', { class: 'hint' }, 'Click a mark to add it to the selected letters (stAllio’s “precise” mode). Switch to “Click excludes” — or Alt-click — to ban a mark from the random pool.'),
    grid,
  );
  renderSets();
  renderSummary();
  renderZones();
  renderSegs();
  filter();
  store.subscribe((_s, changed) => {
    if (changed.has('sets') || changed.has('exclude') || changed.has('brush')) {
      renderSets();
      renderSummary();
      filter();
    }
  });
}
