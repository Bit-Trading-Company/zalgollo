import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as zalgo from '../api/zalgo.js';
import * as style from '../api/style.js';
import * as clean from '../api/clean.js';
import * as inspect from '../api/inspect.js';
import * as mcp from '../api/mcp.js';

const get = (h, qs) => h.GET(new Request(`http://localhost/api/x?${qs}`));

test('zalgo: text + json + seed reproducible', async () => {
  const a = await (await get(zalgo, 'text=hello&preset=crown&seed=5')).text();
  const b = await (await get(zalgo, 'text=hello&preset=crown&seed=5')).text();
  assert.equal(a, b);
  assert.ok([...a].length > 10);
  const j = await (await get(zalgo, 'text=hi&above=3&below=2&seed=1&format=json')).json();
  assert.equal(j.seed, 1);
  assert.ok(j.stats.marks > 0);
});

test('zalgo: shape + style', async () => {
  const j = await (await get(zalgo, 'text=mountain&shape=mountain&shapeHeight=10&style=bold&seed=2&format=json')).json();
  assert.ok(j.text.startsWith('𝐦'));
  assert.ok(j.stats.maxStack >= 8);
});

test('zalgo: validation and output cap', async () => {
  assert.equal((await get(zalgo, 'preset=crown')).status, 400);
  assert.equal((await get(zalgo, 'text=a&preset=nope')).status, 400);
  assert.equal((await get(zalgo, 'text=a&above=1000')).status, 400);
  assert.equal((await get(zalgo, `text=${'x'.repeat(900)}&above=100&below=100`)).status, 413);
});

test('style / clean / inspect', async () => {
  assert.equal((await (await get(style, 'text=Hi&style=fraktur')).text()).trim(), 'ℌ𝔦');
  const all = await (await get(style, 'text=Hi&format=json')).json();
  assert.ok(Object.keys(all.styles).length > 20);
  const z = await (await get(zalgo, 'text=clean%20me&preset=he-comes&seed=3')).text();
  const c = await (await get(clean, `text=${encodeURIComponent(z.trim())}`)).text();
  assert.equal(c.trim(), 'clean me');
  const ins = await (await get(inspect, 'text=e%CC%81%E2%80%8B')).json();
  assert.equal(ins.stats.invisible, 1);
  assert.equal(ins.graphemes[0].codePoints[1].name, 'COMBINING ACUTE ACCENT');
});

async function rpc(body) {
  const res = await mcp.POST(new Request('http://localhost/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' }, body: JSON.stringify(body) }));
  assert.equal(res.status, 200, await res.clone().text());
  return res.json();
}

test('mcp: initialize, list, call', async () => {
  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal(init.result.serverInfo.name, 'zalgollo');
  const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name).sort(), ['clean_text', 'inspect_text', 'style_text', 'zalgo_options', 'zalgo_text']);
  const z = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'zalgo_text', arguments: { text: 'mcp', preset: 'drip', seed: 4 } } });
  assert.ok(z.result.structuredContent.marks > 0);
  const s = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'style_text', arguments: { text: 'ok', style: 'circled' } } });
  assert.equal(s.result.content[0].text, 'ⓞⓚ');
  const c = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'clean_text', arguments: { text: z.result.content[0].text } } });
  assert.equal(c.result.content[0].text, 'mcp');
  const bad = await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'zalgo_text', arguments: { text: 'x'.repeat(900), above: 100, below: 100 } } });
  assert.equal(bad.result.isError, true);
});
