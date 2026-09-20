/**
 * Worker entry. Only /api/* reaches this script (see `run_worker_first` in
 * wrangler.jsonc); every other request is served from the static assets in
 * dist/, with unmatched paths falling back to index.html for the SPA router.
 */
import { handleDomainCheck } from './domains-check.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/domains/check') {
      return handleDomainCheck(request, env, ctx);
    }

    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ result: 'error', message: 'No such endpoint.' }), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<CloudflareEnv>;
