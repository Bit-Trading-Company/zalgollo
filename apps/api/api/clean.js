/** GET/POST /api/clean?text=… — strip combining marks and invisible characters, fold styled letters. */
import { endpoint, runClean } from '../lib/core.js';
export const { GET, POST, OPTIONS } = endpoint(runClean, 'text');
