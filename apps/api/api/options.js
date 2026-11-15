/** GET /api/options — presets, mark sets, zones, styles and shapes. */
import { endpoint, options } from '../lib/core.js';
export const { GET, OPTIONS } = endpoint(() => options());
