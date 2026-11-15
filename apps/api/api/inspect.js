/** GET/POST /api/inspect?text=… — every code point with its Unicode name, plus stats. */
import { endpoint, runInspect } from '../lib/core.js';
export const { GET, POST, OPTIONS } = endpoint(runInspect);
