/** GET/POST /api/zalgo?text=hello&preset=crown — glitch text. format=json for seed + stats. */
import { endpoint, runZalgo } from '../lib/core.js';
export const { GET, POST, OPTIONS } = endpoint(runZalgo, 'text');
