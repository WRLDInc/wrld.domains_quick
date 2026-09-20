// Runtime imports carry the .ts extension so the handler also loads under
// Node's ESM loader for `npm test`; esbuild (wrangler) and tsc accept it too.
import { WHMCSClient } from '../../../src/lib/whmcs-client.ts';
import { DOMAIN_RE } from '../../../src/lib/domains.ts';
import type { DomainAnalytics, DomainCheckResponse } from '../../../src/types/whmcs';

const MAX_DOMAINS = 10;
const ANALYTICS_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

function json(body: DomainCheckResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * POST /api/domains/check  { domains: string[] }
 *
 * Checks up to ten domains against WHMCS `DomainWhois` in parallel and returns
 * one row per domain. Analytics are written to KV only when the namespace is
 * bound, and off the request path via waitUntil.
 */
export const onRequestPost: PagesFunction<CloudflareEnv> = async ({ request, env, waitUntil }) => {
  // Parse defensively: `null`, a bare string or an array are all valid JSON
  // that would otherwise blow up on `.domains` outside the try/catch.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ result: 'error', domains: [], message: 'Send a JSON body with a domains array.' }, 400);
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return json({ result: 'error', domains: [], message: 'Send a JSON body with a domains array.' }, 400);
  }

  const requested = (payload as { domains?: unknown }).domains;
  const list = Array.isArray(requested) ? requested : [];
  const domains = [
    ...new Set(
      list
        .filter((d): d is string => typeof d === 'string')
        .map((d) => d.trim().toLowerCase()),
    ),
  ]
    .filter((d) => DOMAIN_RE.test(d))
    .slice(0, MAX_DOMAINS);

  if (domains.length === 0) {
    return json({ result: 'error', domains: [], message: 'No valid domains to check.' }, 400);
  }

  if (!env.WHMCS_URL || !env.WHMCS_API_IDENTIFIER || !env.WHMCS_API_SECRET) {
    return json({ result: 'error', domains: [], message: 'Availability check is not configured.' }, 503);
  }

  try {
    const client = new WHMCSClient({
      url: env.WHMCS_URL,
      apiIdentifier: env.WHMCS_API_IDENTIFIER,
      apiSecret: env.WHMCS_API_SECRET,
    });

    const results = await client.checkDomains(domains);

    const kv = env.DOMAIN_ANALYTICS;
    if (kv) {
      const timestamp = new Date().toISOString();
      const userAgent = request.headers.get('user-agent');
      const country = request.headers.get('cf-ipcountry');
      const stamp = Date.now();
      waitUntil(
        Promise.all(
          results.map((r) => {
            const record: DomainAnalytics = {
              domain: r.domain,
              timestamp,
              userAgent,
              country,
              available: r.status === 'available',
            };
            return kv.put(`analytics:${r.domain}:${stamp}`, JSON.stringify(record), {
              expirationTtl: ANALYTICS_TTL_SECONDS,
            });
          }),
        ).catch((error) => console.error('Analytics write failed:', error)),
      );
    }

    return json({ result: 'success', domains: results });
  } catch (error) {
    console.error('Domain check error:', error);
    return json({ result: 'error', domains: [], message: 'We could not check availability right now.' }, 502);
  }
};

/** Anything but POST gets a clear 405 instead of the SPA shell. */
export const onRequest: PagesFunction<CloudflareEnv> = async (context) => {
  if (context.request.method === 'POST') return context.next();
  return new Response(JSON.stringify({ result: 'error', domains: [], message: 'Use POST.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' },
  });
};
