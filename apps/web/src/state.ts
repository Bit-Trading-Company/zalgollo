import { MARKS, bidi, cloneDoc, compile, glitch, hideInk, parse, seeded, weave, type Doc, type PoolSpec, type Range, type Zone } from '@zalgollo/core';
import coverage from './font-coverage.json';

/** Marks the Zalgollo fonts can't draw — left out of the pool while "zalgo-safe" is on. */
const COVERED = new Set<number>(coverage.marks);
export const UNCOVERED: number[] = MARKS.filter((m) => m.zone !== 'invisible' && !COVERED.has(m.cp)).map((m) => m.cp);
export const isCovered = (cp: number) => COVERED.has(cp);

export interface Finish {
  weave: string; // 'none' | INVISIBLES key
  weaveDensity: number; // 0–100
  bidi: 'none' | 'rlo' | 'mirror' | 'isolate';
  ink: string;
  inkMethod: 'variation' | 'tags';
}

export interface Layer {
  id: string;
  doc: Doc;
  x: number; // centre, 0–1 of stage width
  y: number; // centre, 0–1 of stage height
  size: number; // px
  font: string;
  weight: number;
  color: string;
  rotate: number;
  opacity: number;
  glow: number; // shadow blur px (0 = none)
  glowColor: string;
  rgb: number; // chromatic aberration offset px
  lineHeight: number;
  finish: Finish;
}

export interface Brush {
  counts: Record<Exclude<Zone, 'invisible'>, number>;
  density: number; // 0–100
  jitter: number; // 0–100
  mode: 'add' | 'replace';
  includeSpaces: boolean;
  native: boolean;
  autoType: boolean;
  strength: number; // paint: marks per stroke step (multiplier %)
}

export type Mode = 'edit' | 'paint' | 'erase' | 'move';

export interface State {
  layers: Layer[];
  active: number;
  sel: Range | null;
  brush: Brush;
  sets: string[];
  exclude: number[];
  mode: Mode;
  boil: boolean;
  unleash: boolean;
  tab: string;
  bg: string;
  sketch: { max: number; mirror: boolean };
  /** Only use marks the Zalgollo fonts can draw. */
  fontSafe: boolean;
}

const SYS_SANS = "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
/**
 * Stage fonts. The first three are Zalgollo's own merged Noto fonts, which carry every mark the
 * studio uses (see scripts/build-fonts.py). The rest are system fonts — characterful, but they
 * may draw unsupported marks as boxes.
 */
export const FONTS: Record<string, string> = {
  sans: `'Zalgollo Sans', ${SYS_SANS}`,
  serif: "'Zalgollo Serif', Georgia, 'Times New Roman', serif",
  mono: "'Zalgollo Mono', ui-monospace, Menlo, Consolas, monospace",
  system: SYS_SANS,
  impact: "Impact, 'Haettenschweiler', 'Arial Narrow Bold', 'Franklin Gothic Bold', sans-serif",
  rounded: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Arial Rounded MT Bold', sans-serif",
  condensed: "'Avenir Next Condensed', 'Roboto Condensed', 'Arial Narrow', sans-serif",
  hand: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive",
  gothic: "'UnifrakturMaguntia', 'Old English Text MT', 'Blackletter', fantasy",
};
export const FONT_LABELS: Record<string, string> = {
  sans: 'Zalgollo Sans (zalgo-safe)',
  serif: 'Zalgollo Serif (zalgo-safe)',
  mono: 'Zalgollo Mono (zalgo-safe)',
  system: 'System sans',
  impact: 'Impact (system)',
  rounded: 'Rounded (system)',
  condensed: 'Condensed (system)',
  hand: 'Hand (system)',
  gothic: 'Gothic (system)',
};

export const BACKGROUNDS: Record<string, string> = {
  void: '#07060a',
  ink: '#0d1020',
  paper: '#f2ede4',
  white: '#ffffff',
  blood: 'radial-gradient(circle at 50% 120%, #5a0012, #0b0003 70%)',
  vapor: 'linear-gradient(135deg, #2b0b3f, #0b3f4a)',
  crt: 'radial-gradient(circle at 50% 50%, #0c2a12, #020803 75%)',
  sunset: 'linear-gradient(180deg, #ff5f6d, #ffc371)',
  theme: '',
};

const uid = () => Math.random().toString(36).slice(2, 9);
const DEFAULT_FINISH: Finish = { weave: 'none', weaveDensity: 100, bidi: 'none', ink: '', inkMethod: 'variation' };

export function newLayer(text: string, patch: Partial<Layer> = {}): Layer {
  return {
    id: uid(),
    doc: parse(text),
    x: 0.5,
    y: 0.5,
    size: 72,
    font: 'sans',
    weight: 800,
    color: '',
    rotate: 0,
    opacity: 1,
    glow: 0,
    glowColor: '#ff2bd6',
    rgb: 0,
    lineHeight: 1.5,
    finish: { ...DEFAULT_FINISH },
    ...patch,
  };
}

const DEFAULT_BRUSH: Brush = {
  counts: { above: 6, middle: 1, below: 6, enclose: 0, bridge: 0, other: 0 },
  density: 100,
  jitter: 55,
  mode: 'add',
  includeSpaces: false,
  native: false,
  autoType: true,
  strength: 35,
};

function initial(): State {
  const first = newLayer('zalgollo');
  first.doc = glitch(first.doc, { counts: { above: 6, middle: 1, below: 5 }, jitter: 0.6, pool: { sets: ['classic'] }, rng: seeded(1337) });
  let prefs: Partial<State> = {};
  try {
    prefs = JSON.parse(localStorage.getItem('zalgollo:prefs') ?? '{}');
  } catch {}
  return {
    layers: [first],
    active: 0,
    sel: null,
    brush: { ...DEFAULT_BRUSH, ...prefs.brush, counts: { ...DEFAULT_BRUSH.counts, ...prefs.brush?.counts } },
    sets: prefs.sets ?? ['classic'],
    exclude: prefs.exclude ?? [],
    mode: 'edit',
    boil: false,
    unleash: false,
    tab: prefs.tab ?? 'brush',
    bg: prefs.bg ?? 'theme',
    sketch: prefs.sketch ?? { max: 16, mirror: false },
    fontSafe: prefs.fontSafe ?? true,
  };
}

type Listener = (s: State, changed: Set<keyof State>) => void;
const listeners = new Set<Listener>();

// ── history ──────────────────────────────────────────────────────
interface Snapshot {
  layers: Layer[];
  active: number;
}
const snap = (s: State): Snapshot => ({ active: s.active, layers: s.layers.map((l) => ({ ...l, doc: cloneDoc(l.doc), finish: { ...l.finish } })) });
const past: Snapshot[] = [];
const future: Snapshot[] = [];
let lastKey = '';
let lastAt = 0;

export const store = {
  state: initial(),
  /** Update state. `history` pushes an undo step; consecutive updates with the same `coalesce` key merge. */
  set(patch: Partial<State>, opts: { history?: boolean; coalesce?: string } = {}) {
    if (opts.history) {
      const now = performance.now();
      if (!(opts.coalesce && opts.coalesce === lastKey && now - lastAt < 800)) {
        past.push(snap(this.state));
        if (past.length > 200) past.shift();
        future.length = 0;
      }
      lastKey = opts.coalesce ?? '';
      lastAt = now;
    }
    const changed = new Set(Object.keys(patch) as (keyof State)[]);
    Object.assign(this.state, patch);
    emit(changed);
  },
  layer(): Layer {
    return this.state.layers[this.state.active]!;
  },
  /** Replace the active layer's document (with undo). */
  setDoc(doc: Doc, coalesce?: string) {
    const layers = [...this.state.layers];
    layers[this.state.active] = { ...this.layer(), doc };
    this.set({ layers }, { history: true, coalesce });
  },
  patchLayer(patch: Partial<Layer>, coalesce = 'layer-props') {
    const layers = [...this.state.layers];
    layers[this.state.active] = { ...this.layer(), ...patch };
    this.set({ layers }, { history: true, coalesce });
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  undo() {
    const s = past.pop();
    if (!s) return;
    future.push(snap(this.state));
    lastKey = '';
    this.set({ ...s, sel: null });
  },
  redo() {
    const s = future.pop();
    if (!s) return;
    past.push(snap(this.state));
    lastKey = '';
    this.set({ ...s, sel: null });
  },
  canUndo: () => past.length > 0,
  canRedo: () => future.length > 0,
};

function emit(changed: Set<keyof State>) {
  for (const l of listeners) l(store.state, changed);
  persist();
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const s = store.state;
    try {
      localStorage.setItem('zalgollo:prefs', JSON.stringify({ brush: s.brush, sets: s.sets, exclude: s.exclude, tab: s.tab, bg: s.bg, sketch: s.sketch, fontSafe: s.fontSafe }));
      localStorage.setItem('zalgollo:work', JSON.stringify(serialize(s)));
    } catch {}
  }, 400);
}

// ── selection & pool helpers ─────────────────────────────────────
export const range = (): Range | undefined => store.state.sel ?? undefined;
export const pool = (): PoolSpec => ({
  sets: store.state.sets,
  exclude: store.state.fontSafe ? [...store.state.exclude, ...UNCOVERED] : store.state.exclude,
  native: store.state.brush.native,
});

// ── output ───────────────────────────────────────────────────────
export function finishText(text: string, f: Finish): string {
  let out = text;
  if (f.weave !== 'none') out = weave(out, f.weave, f.weaveDensity / 100);
  if (f.ink) {
    try {
      out = hideInk(out, f.ink, f.inkMethod);
    } catch {}
  }
  if (f.bidi !== 'none') out = bidi(out, f.bidi);
  return out;
}
export const layerOutput = (l: Layer) => finishText(compile(l.doc), l.finish);
export const activeOutput = () => layerOutput(store.layer());

// ── share links & autosave ───────────────────────────────────────
/** Cells are stored as [ch, marks] or [ch, marks, base] so styles survive save/load. */
type SavedCell = [string, number[]] | [string, number[], string];
interface Saved {
  v: 1 | 2;
  bg: string;
  layers: (Omit<Layer, 'doc' | 'id'> & { t?: string; c?: SavedCell[] })[];
}
export function serialize(s: State): Saved {
  return {
    v: 2,
    bg: s.bg,
    layers: s.layers.map(({ doc, id: _id, ...rest }) => ({ ...rest, c: doc.map((c): SavedCell => (c.base ? [c.ch, c.marks, c.base] : [c.ch, c.marks])) })),
  };
}
export function deserialize(saved: Saved): Partial<State> {
  return {
    bg: saved.bg,
    active: 0,
    sel: null,
    layers: saved.layers.map(({ t, c, ...rest }) => ({
      ...newLayer(''),
      ...rest,
      finish: { ...DEFAULT_FINISH, ...rest.finish },
      doc: c ? c.map(([ch, marks, base]) => (base ? { ch, marks, base } : { ch, marks })) : parse(t ?? ''),
    })),
  };
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function shareUrl(): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(serialize(store.state)));
  const packed = await pipe(json, new CompressionStream('deflate-raw'));
  return `${location.origin}${location.pathname}#z=${b64url(packed)}`;
}

export async function loadFromLocation(): Promise<boolean> {
  const m = location.hash.match(/#z=([\w-]+)/);
  try {
    if (m) {
      const json = new TextDecoder().decode(await pipe(unb64url(m[1]!), new DecompressionStream('deflate-raw')));
      store.set(deserialize(JSON.parse(json)));
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    }
    const t = new URLSearchParams(location.search).get('text');
    if (t) {
      store.set({ layers: [newLayer(t)], active: 0, sel: null });
      return true;
    }
    const work = localStorage.getItem('zalgollo:work');
    if (work) store.set(deserialize(JSON.parse(work)));
  } catch {
    /* corrupted link or storage — keep the default */
  }
  return false;
}
