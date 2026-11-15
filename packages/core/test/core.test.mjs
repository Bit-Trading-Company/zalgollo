import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as z from '../dist/index.js';

test('catalog: every combining mark, sorted into zones', () => {
  assert.ok(z.MARKS.length > 2000);
  assert.equal(z.markInfo(0x301).zone, 'above');
  assert.equal(z.markInfo(0x316).zone, 'below');
  assert.equal(z.markInfo(0x336).zone, 'middle');
  assert.equal(z.markInfo(0x20dd).zone, 'enclose');
  assert.equal(z.markInfo(0x35c).zone, 'bridge');
  assert.equal(z.markInfo(0xfe0f).zone, 'invisible');
  assert.deepEqual(z.SAFE_SETS, ['classic']);
});

test('parse ↔ compile round-trips any text', () => {
  for (const s of ['hello', 'z̷̢a͝l̴g̵o̶', '👩‍💻 ok', 'नमस्ते', 'line\nbreak', '́lead']) assert.equal(z.compile(z.parse(s)), s);
});

test('edit keeps marks on untouched letters', () => {
  const doc = z.glitch(z.parse('abc'), { counts: { above: 3 }, jitter: 0, rng: z.seeded(1) });
  const { doc: next, inserted } = z.edit(doc, 'abXc');
  assert.deepEqual(inserted, [2, 3]);
  assert.equal(next[0].marks.length, 3);
  assert.equal(next[3].marks.length, 3);
  assert.equal(next[2].marks.length, 0);
});

test('ops: glitch/shape/strip/reroll/erase/addMark', () => {
  const rng = z.seeded(2);
  let d = z.parse('glitch');
  d = z.glitch(d, { counts: { above: 4, below: 2 }, jitter: 0, rng, range: [0, 3] });
  assert.equal(z.heights(d, 'above').join(), '4,4,4,0,0,0');
  d = z.shape(d, { heights: { above: [1, 2, 3, 4, 5, 6] }, rng });
  assert.equal(z.heights(d, 'above').join(), '1,2,3,4,5,6');
  const r = z.reroll(d, { rng });
  assert.equal(z.heights(r, 'above').join(), '1,2,3,4,5,6');
  assert.equal(z.erase(d, { count: 1, zone: 'above' })[5].marks.filter((m) => z.zoneOf(m) === 'above').length, 5);
  assert.equal(z.addMark(d, 0x20dd, { range: [0, 1] })[0].marks.at(-1), 0x20dd);
  assert.equal(z.compile(z.strip(d)), 'glitch');
});

test('styles fold back with parse + style none', () => {
  assert.equal(z.styleText('Hi 1', 'bold'), '𝐇𝐢 𝟏');
  assert.equal(z.styleText('ab', 'upside-down'), 'qɐ');
  const d = z.parse(z.styleText('Hey', 'fraktur'));
  assert.equal(z.plainText(d), 'Hey');
  assert.equal(z.compile(z.style(d, 'none')), 'Hey');
  assert.equal(z.compile(z.style(z.parse('AB'), 'regional')), '🇦‌🇧');
});

test('zalgo is reproducible with a seed', () => {
  assert.equal(z.zalgo('seed', { preset: 'classic', seed: 9 }), z.zalgo('seed', { preset: 'classic', seed: 9 }));
  for (const p of Object.keys(z.PRESETS)) assert.ok(z.zalgo('abc', { preset: p, seed: 1 }).length >= 3, p);
});

test('forbidden: ink round-trips, clean removes everything', () => {
  for (const method of ['variation', 'tags']) {
    const t = z.hideInk('visible', 'secret msg', method);
    assert.equal(z.revealInk(t)[0].message, 'secret msg');
    assert.equal(z.stripInvisible(t), 'visible');
  }
  const messy = z.bidi(z.weave(z.zalgo('𝐂𝐥𝐞𝐚𝐧', { preset: 'he-comes', seed: 1 }), 'zwsp'), 'rlo');
  assert.equal(z.clean(messy), 'Clean');
});

test('inspect names code points', () => {
  const r = z.inspect('é​');
  assert.equal(r.graphemes[0].codePoints[1].name, 'COMBINING ACUTE ACCENT');
  assert.equal(r.stats.invisible, 1);
});
