#!/usr/bin/env node
/** Local stand-in for Vercel: routes /api/* to the function modules and serves /public. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const REWRITES = { '/mcp': '/api/mcp', '/zalgo': '/api/zalgo', '/clean': '/api/clean' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = REWRITES[url.pathname] ?? url.pathname;
    try {
      if (pathname.startsWith('/api/')) {
        const mod = await import(path.join(DIR, `${pathname}.js`));
        const handler = mod[req.method];
        if (!handler) return res.writeHead(405).end();
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const request = new Request(url.origin + pathname + url.search, {
          method: req.method,
          headers: req.headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
        });
        const response = await handler(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const file = path.join(DIR, 'public', pathname === '/' ? 'index.html' : pathname);
      if (!file.startsWith(path.join(DIR, 'public')) || !fs.existsSync(file)) return res.writeHead(404).end('Not found');
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
    } catch (e) {
      console.error(e);
      res.writeHead(500).end(String(e));
    }
  })
  .listen(PORT, () => console.log(`zalgollo api on http://localhost:${PORT}`));
