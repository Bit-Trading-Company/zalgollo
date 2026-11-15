export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll(sel)] as T[];
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.style.cssText = String(v);
    else if (k in el && typeof v !== 'string') (el as any)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null && c !== false) el.append(c);
  return el;
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, kind: 'ok' | 'error' = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('error', kind === 'error');
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 1900);
}

export async function copyText(text: string, label = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) return toast('Copy failed — select the text manually', 'error');
  }
  toast(label);
}

export function download(filename: string, data: Blob | string, type = 'text/plain;charset=utf-8') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const isTyping = (e: Event) => {
  const t = e.target as HTMLElement;
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
};

/** Labelled range slider. */
export function slider(label: string, value: number, min: number, max: number, onInput: (v: number) => void, opts: { step?: number; fmt?: (v: number) => string; title?: string } = {}) {
  const out = h('span', {}, (opts.fmt ?? String)(value));
  const input = h('input', { type: 'range', min, max, step: opts.step ?? 1, value, 'aria-label': label });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = (opts.fmt ?? String)(v);
    onInput(v);
  });
  const el = h('div', { class: 'slider', title: opts.title ?? '' }, h('label', {}, label), input, out);
  return Object.assign(el, {
    set(v: number) {
      input.value = String(v);
      out.textContent = (opts.fmt ?? String)(v);
    },
  });
}

export function chip(label: string, pressed: boolean, onClick: () => void, title = '') {
  return h('button', { class: 'chip', 'aria-pressed': String(pressed), title, onClick }, label);
}

export function check(label: string, checked: boolean, onChange: (v: boolean) => void, title = '') {
  const input = h('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'check', title }, input, label);
}

export function section(title: string, ...children: (Node | string)[]) {
  return h('div', { class: 'group' }, h('span', { class: 'field-label' }, title), ...children);
}

/** Wire every .menu button to toggle its popup. */
export function setupMenus(onPick: (btn: HTMLButtonElement) => void) {
  for (const menu of $$('.menu')) {
    const btn = $<HTMLButtonElement>('button', menu);
    const pop = $('.menu-pop', menu);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = pop.hidden;
      $$('.menu-pop').forEach((p) => (p.hidden = true));
      pop.hidden = !open;
    });
    pop.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) onPick(b as HTMLButtonElement);
      pop.hidden = true;
    });
  }
  document.addEventListener('click', () => $$('.menu-pop').forEach((p) => (p.hidden = true)));
}
