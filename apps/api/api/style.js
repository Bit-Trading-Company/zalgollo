/** GET/POST /api/style?text=hello&style=fraktur — styled alphabets (style=all for every style). */
import { endpoint, runStyle } from '../lib/core.js';
export const { GET, POST, OPTIONS } = endpoint(runStyle, 'text');
