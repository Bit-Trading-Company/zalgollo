/** Shared request handling for the REST API and the MCP server. */
import { MARK_SETS, PRESETS, SHAPES, STYLES, ZONE_INFO, clean, inspect, stats, styleText, zalgoDoc } from '@zalgollo/core';

export const MAX_TEXT = 1000;
export const MAX_PER_ZONE = 100;
/** Upper bound on output code points so a single request can't build a megabyte bomb. */
export const MAX_OUTPUT = 60_000;

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const num = (v, name, min, max) => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `Invalid ${name} "${v}" (expected ${min}–${max})`);
  return n;
};
const list = (v) => (Array.isArray(v) ? v : v ? String(v).split(',') : []).map((s) => String(s).trim()).filter(Boolean);
const bool = (v) => (v == null || v === '' ? undefined : !/^(0|false|no|off)$/i.test(String(v)));

export function requireText(p, max = MAX_TEXT) {
  const text = p.text ?? p.t;
  if (text == null || String(text) === '') throw new HttpError(400, 'Missing "text" parameter');
  if (String(text).length > max) throw new HttpError(400, `"text" is too long (max ${max} characters)`);
  return String(text);
}

/** Validate loose params (query string, JSON body or MCP args) into zalgo options. */
export function parseZalgo(p) {
  const text = requireText(p);
  const preset = p.preset || undefined;
  if (preset && !PRESETS[preset]) throw new HttpError(400, `Unknown preset "${preset}". Available: ${Object.keys(PRESETS).join(', ')}`);
  const sets = list(p.sets);
  for (const s of sets) if (!MARK_SETS[s]) throw new HttpError(400, `Unknown mark set "${s}". Available: ${Object.keys(MARK_SETS).join(', ')}`);
  const style = p.style || undefined;
  if (style && style !== 'none' && !STYLES[style]) throw new HttpError(400, `Unknown style "${style}". Available: none, ${Object.keys(STYLES).join(', ')}`);
  const shapeName = p.shape || undefined;
  if (shapeName && !SHAPES[shapeName]) throw new HttpError(400, `Unknown shape "${shapeName}". Available: ${Object.keys(SHAPES).join(', ')}`);

  const counts = {};
  for (const z of ['above', 'middle', 'below', 'enclose', 'bridge', 'other']) {
    const v = num(p[z], z, 0, MAX_PER_ZONE);
    if (v != null) counts[z] = v;
  }
  const shapeHeight = num(p.shapeHeight ?? p.height, 'shapeHeight', 1, MAX_PER_ZONE) ?? 16;
  const shapeZone = p.shapeZone ?? 'both';
  const scrambleBlocks = list(p.scramble);
  return {
    text,
    options: {
      preset: preset ?? (Object.keys(counts).length || shapeName ? undefined : 'classic'),
      counts: Object.keys(counts).length ? counts : undefined,
      intensity: num(p.intensity, 'intensity', 0, 10),
      density: num(p.density, 'density', 0, 1),
      jitter: num(p.jitter, 'jitter', 0, 1),
      sets: sets.length ? sets : undefined,
      native: bool(p.native),
      style,
      shape: shapeName
        ? {
            name: shapeName,
            above: shapeZone === 'below' ? 0 : shapeHeight,
            below: shapeZone === 'above' ? 0 : Math.round(shapeHeight * (shapeZone === 'both' ? 0.6 : 1)),
            seed: num(p.seed, 'seed', 0, 2 ** 32),
          }
        : undefined,
      scramble: scrambleBlocks.length ? { blocks: scrambleBlocks, probability: num(p.scrambleChance, 'scrambleChance', 0, 1) ?? 1 } : undefined,
      seed: num(p.seed, 'seed', 0, 2 ** 32),
    },
  };
}

export function runZalgo(p) {
  const { text, options } = parseZalgo(p);
  let result;
  try {
    result = zalgoDoc(text, options);
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  const s = stats(result.text);
  if (s.codePoints > MAX_OUTPUT) throw new HttpError(413, `Output would be ${s.codePoints} code points (max ${MAX_OUTPUT}). Lower the counts or shorten the text.`);
  return { text: result.text, seed: result.seed, stats: s };
}

export function runStyle(p) {
  const text = requireText(p);
  const style = p.style || undefined;
  if (!style || style === 'all') return { styles: Object.fromEntries(Object.keys(STYLES).map((k) => [k, styleText(text, k)])) };
  if (!STYLES[style]) throw new HttpError(400, `Unknown style "${style}". Available: ${Object.keys(STYLES).join(', ')}`);
  return { text: styleText(text, style), style };
}

export function runClean(p) {
  const text = requireText(p, 100_000);
  const normalize = p.normalize ?? 'NFKC';
  if (!['NFC', 'NFKC', 'none'].includes(normalize)) throw new HttpError(400, 'normalize must be NFC, NFKC or none');
  return { text: clean(text, { marks: bool(p.marks) ?? true, invisible: bool(p.invisible) ?? true, normalize }), before: stats(text) };
}

export function runInspect(p) {
  const text = requireText(p, 100_000);
  return inspect(text, Math.min(Number(p.limit) || 2000, 5000));
}

export function options() {
  return {
    presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.description])),
    markSets: Object.fromEntries(Object.entries(MARK_SETS).map(([k, v]) => [k, v.description])),
    zones: Object.fromEntries(Object.entries(ZONE_INFO).map(([k, v]) => [k, v.description])),
    styles: STYLES,
    shapes: Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, v.label])),
  };
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...headers } });
}
export const text = (body, headers = {}) => new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS, ...headers } });

export function errorResponse(e) {
  if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
  console.error(e);
  return json({ error: 'Internal error' }, 500);
}

export async function readParams(request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  if (request.method === 'POST') {
    const type = request.headers.get('content-type') ?? '';
    if (type.includes('application/json')) Object.assign(params, await request.json().catch(() => ({})));
    else if (type.includes('form')) Object.assign(params, Object.fromEntries(await request.formData()));
    else {
      const body = await request.text();
      if (body && params.text == null) params.text = body;
    }
  }
  return params;
}

/** Wrap a params→result function as GET/POST handlers. `asText` picks the plain-text field. */
export function endpoint(fn, asText) {
  const handle = async (request) => {
    try {
      const p = await readParams(request);
      const result = fn(p);
      if (asText && (p.format ?? 'text') === 'text' && result[asText] != null) return text(result[asText] + '\n', { 'Cache-Control': 'no-store' });
      return json(result, 200, { 'Cache-Control': 'no-store' });
    } catch (e) {
      return errorResponse(e);
    }
  };
  return { GET: handle, POST: handle, OPTIONS: () => new Response(null, { status: 204, headers: CORS }) };
}

export const publicBase = (request) => {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  return `${proto}://${host}`;
};
