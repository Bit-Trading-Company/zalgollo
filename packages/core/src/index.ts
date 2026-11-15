/**
 * @zalgollo/core — craft glitch text on purpose.
 *
 *   import { zalgo, parse, glitch, compile } from '@zalgollo/core';
 *   zalgo('hello', { preset: 'crown', seed: 42 });
 *
 *   let doc = parse('hello');                                   // text → editable cells
 *   doc = glitch(doc, { counts: { above: 6 }, range: [0, 2] });  // edit
 *   compile(doc);                                                // cells → Unicode string
 */
export * from './marks.js';
export * from './doc.js';
export * from './ops.js';
export * from './rng.js';
export * from './styles.js';
export * from './shapes.js';
export * from './forbidden.js';
export * from './inspect.js';
export * from './presets.js';
export * from './zalgo.js';
export { SCRAMBLE_BLOCKS } from './data/blocks.js';
export { MONUMENTS } from './data/names.js';
