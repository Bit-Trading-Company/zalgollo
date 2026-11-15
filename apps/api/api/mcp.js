/**
 * POST /mcp (rewritten to /api/mcp) — MCP server over Streamable HTTP, stateless.
 *   claude mcp add --transport http zalgollo https://zalgollo.vercel.app/mcp
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '../lib/mcp.js';
import { CORS, publicBase } from '../lib/core.js';

async function handle(request) {
  // Stateless: a fresh server + transport per request (works on serverless, no sticky sessions).
  const server = createMcpServer({ baseUrl: publicBase(request) });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const res = await transport.handleRequest(request);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export const POST = handle;
export const GET = (request) =>
  request.headers.get('accept')?.includes('text/event-stream')
    ? handle(request)
    : new Response(
        JSON.stringify({ name: 'zalgollo', transport: 'streamable-http', usage: `claude mcp add --transport http zalgollo ${publicBase(request)}/mcp` }, null, 2),
        { headers: { 'Content-Type': 'application/json', ...CORS } },
      );
export const DELETE = handle;
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
