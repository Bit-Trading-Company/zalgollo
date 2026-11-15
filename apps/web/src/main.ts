import './styles.css';
import { MARKS, UNICODE_VERSION, compile, edit, glitch, plainText, stats } from '@zalgollo/core';
import { applyBrush, applyReroll, applyStrip, buildBrush, buildSketch } from './brush';
import { initHero } from './hero';
import { buildLayers } from './layers-panel';
import { buildMarks } from './marks-panel';
import { allOutput, exportPng, initStage, renderStage, setBoil } from './stage';
import { activeOutput, loadFromLocation, pool, shareUrl, store, type Mode } from './state';
import { initStrip, isCellPopOpen, renderCellPop, renderStrip } from './strip';
import { buildForbidden, buildStyle } from './style-panel';
import { $, $$, copyText, download, esc, isTyping, setupMenus, toast } from './ui';
import { buildXray } from './xray-panel';

const API = __API_BASE__;
$$('[data-count-marks]').forEach((el) => (el.textContent = MARKS.length.toLocaleString('en')));
$$('[data-unicode]').forEach((el) => (el.textContent = UNICODE_VERSION.replace(/\.0$/, '').replace(/\.0$/, '')));
$$('[data-api]').forEach((el) => (el.textContent = el.textContent!.split('__API__').join(API)));
$$('[data-copyable]').forEach((el) => el.addEventListener('click', () => copyText(el.textContent!.trim(), 'Copied snippet')));

await loadFromLocation();

// ── text input ↔ document ───────────────────────────────────────────
const input = $<HTMLTextAreaElement>('#text-input');
const syncInput = () => {
  const plain = plainText(store.layer().doc);
  if (input.value !== plain) input.value = plain;
};
input.addEventListener('input', () => {
  const result = edit(store.layer().doc, input.value);
  let doc = result.doc;
  const fresh = result.inserted;
  const b = store.state.brush;
  const pastedMarks = doc.slice(fresh[0], fresh[1]).some((c) => c.marks.length);
  if (b.autoType && !pastedMarks && fresh[1] > fresh[0]) {
    doc = glitch(doc, { range: fresh, counts: b.counts, density: b.density / 100, jitter: b.jitter / 100, pool: pool(), includeSpaces: b.includeSpaces });
  }
  const sel = store.state.sel && store.state.sel[1] <= doc.length ? store.state.sel : null;
  store.setDoc(doc, 'typing');
  if (sel !== store.state.sel) store.set({ sel });
  // pasted zalgo: keep the field plain — the marks live in the document now
  if (pastedMarks) {
    const caret = input.selectionStart;
    syncInput();
    input.selectionStart = input.selectionEnd = Math.min(caret ?? 0, input.value.length);
  }
});

// ── tabs ─────────────────────────────────────────────────────────────
const TABS = ['brush', 'sketch', 'marks', 'style', 'forbidden', 'layers', 'xray'];
const showTab = () => {
  for (const t of TABS) {
    $(`#tab-${t}`).hidden = store.state.tab !== t;
    $(`[data-tab="${t}"]`).setAttribute('aria-selected', String(store.state.tab === t));
  }
};
$('#tabs').addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
  if (t) store.set({ tab: t.dataset.tab! });
});

// ── toolbar ──────────────────────────────────────────────────────────
const setMode = (mode: Mode) => store.set({ mode });
$('#mode-seg').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]');
  if (b) setMode(b.dataset.mode as Mode);
});
$('#undo-btn').addEventListener('click', () => store.undo());
$('#redo-btn').addEventListener('click', () => store.redo());
$('#boil-btn').addEventListener('click', () => store.set({ boil: !store.state.boil }));
$('#unleash-btn').addEventListener('click', () => store.set({ unleash: !store.state.unleash }));
const copyActive = () => copyText(activeOutput(), store.state.layers.length > 1 ? 'Copied this layer' : 'Copied — paste it anywhere');
$('#copy-btn').addEventListener('click', copyActive);

const poster = (on: boolean) => {
  document.body.classList.toggle('poster', on);
  $('#poster-exit').hidden = !on;
  setTimeout(renderStage, 30);
};
$('#poster-exit').addEventListener('click', () => poster(false));

setupMenus(async (b) => {
  const kind = b.dataset.export;
  if (kind === 'png') exportPng();
  if (kind === 'txt') download('zalgollo.txt', allOutput());
  if (kind === 'html') copyText(`<p style="line-height:2.4">${esc(activeOutput())}</p>`, 'Copied HTML');
  if (kind === 'all') copyText(allOutput(), 'Copied all layers');
  if (kind === 'escaped') copyText(JSON.stringify(activeOutput()).replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')), 'Copied as JS string escapes');
  if (kind === 'share') copyText(await shareUrl(), 'Share link copied');
  if (kind === 'poster') poster(true);
});

// ── stats ───────────────────────────────────────────────────────────
const renderStats = () => {
  const st = stats(activeOutput());
  const warn = (cond: boolean) => (cond ? ' class="warn"' : '');
  $('#stats-bar').innerHTML = [
    `<span><b>${st.graphemes}</b> letters</span>`,
    `<span><b>${st.marks}</b> marks</span>`,
    `<span${warn(st.maxStack > 60)}><b>${st.maxStack}</b> tallest stack</span>`,
    `<span><b>${st.codePoints}</b> code points</span>`,
    `<span${warn(st.utf16 > 2000)} title="Most apps count UTF-16 units. Discord: 2000 · X: 280 weighted"><b>${st.utf16}</b> UTF-16 units${st.utf16 > 2000 ? ' — over Discord’s 2000' : ''}</span>`,
    `<span><b>${st.utf8Bytes}</b> bytes</span>`,
    st.invisible ? `<span${warn(true)}><b>${st.invisible}</b> invisible</span>` : '',
    store.state.sel ? `<span><b>${store.state.sel[1] - store.state.sel[0]}</b> selected</span>` : '',
  ].join('');
};

// ── render loop ─────────────────────────────────────────────────────
store.subscribe((s, changed) => {
  if (['layers', 'active', 'sel', 'bg', 'mode'].some((k) => changed.has(k as never))) renderStage();
  if (['layers', 'active', 'sel'].some((k) => changed.has(k as never))) {
    renderStrip();
    renderStats();
    if (isCellPopOpen()) renderCellPop();
  }
  if ((changed.has('layers') || changed.has('active')) && document.activeElement !== input) syncInput();
  if (changed.has('tab')) showTab();
  if (changed.has('boil')) {
    $('#boil-btn').setAttribute('aria-pressed', String(s.boil));
    setBoil(s.boil);
  }
  if (changed.has('unleash')) {
    $('#unleash-btn').setAttribute('aria-pressed', String(s.unleash));
    $('#stage-wrap').classList.toggle('unleashed', s.unleash);
  }
  if (changed.has('mode')) $$('#mode-seg [data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === s.mode)));
  ($('#undo-btn') as HTMLButtonElement).disabled = !store.canUndo();
  ($('#redo-btn') as HTMLButtonElement).disabled = !store.canRedo();
});

// ── keyboard ─────────────────────────────────────────────────────────
const shortcuts = $('#shortcuts') as HTMLDialogElement;
$('#shortcuts-btn').addEventListener('click', () => shortcuts.showModal());
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !isTyping(e)) {
    e.preventDefault();
    return e.shiftKey ? store.redo() : store.undo();
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') {
    if (document.body.classList.contains('poster')) return poster(false);
    if (isTyping(e)) return (e.target as HTMLElement).blur();
    return store.set({ sel: null });
  }
  if (isTyping(e)) return;
  const n = Number(e.key);
  if (n >= 1 && n <= TABS.length) return store.set({ tab: TABS[n - 1]! });
  const actions: Record<string, () => void> = {
    g: applyBrush,
    r: applyReroll,
    x: applyStrip,
    c: copyActive,
    b: () => store.set({ boil: !store.state.boil }),
    v: () => setMode('edit'),
    p: () => setMode('paint'),
    e: () => setMode('erase'),
    m: () => setMode('move'),
    a: () => store.set({ sel: [0, store.layer().doc.length] }),
    '?': () => shortcuts.showModal(),
  };
  const fn = actions[e.key.toLowerCase()] ?? actions[e.key];
  if (fn) {
    e.preventDefault();
    fn();
  }
});

$('#theme-btn').addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  localStorage.setItem('zalgollo:theme', next);
  renderStage();
});

// ── boot ─────────────────────────────────────────────────────────────
buildBrush();
buildSketch();
buildMarks();
buildStyle();
buildForbidden();
buildLayers();
buildXray();
initStage();
initStrip();
initHero();
syncInput();
showTab();
renderStage();
renderStrip();
renderStats();
store.set({ mode: store.state.mode });
if (!compile(store.layer().doc)) toast('Type something to begin');
