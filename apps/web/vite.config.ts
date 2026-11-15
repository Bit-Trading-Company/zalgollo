import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Served from https://bit-trading-company.com/zalgollo/ (GitHub Pages project site).
const base = process.env.BASE_PATH ?? '/zalgollo/';

export default defineConfig({
  base,
  resolve: {
    alias: { '@zalgollo/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)) },
  },
  define: {
    __API_BASE__: JSON.stringify(process.env.ZALGOLLO_API ?? 'https://zalgollo.vercel.app'),
  },
  build: { target: 'es2022', sourcemap: true },
});
