// Runtime imports carry the .ts extension so this module also loads under
// Node's ESM loader for `npm test`; esbuild (wrangler) and tsc accept it too.
import { DOMAIN_RE, tldOf } from '../lib/domains.ts';
import type { DomainAnalytics } from '../types/whmcs';
import type { DomainCheckResponse, DomainCheckResult } from '../types/domains';
import { buildProviders, checkoutSettings, directAllowsTld, type CheckoutSettings } from './config.ts';
import { checkWithCache, toPublic, type ProviderResult } from './providers/index.ts';
import { retailPrice } from './pricing.ts';
import { allowRequest, clientIp, json, ndjson, readJsonObject, tooMany, wantsNdjson } from './http.ts';

export const MAX_DOMAINS = 20;
const ANALYTICS_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const BAD_BODY = 'Send a JSON body with a domains array.';

export interface Deps {
  fetch: typeof fetch;
}

type Ctx = Pick<ExecutionContext, 'waitUntil'>;

function fail(message: string, status: number, extra: Record<string, string> = {}): Response {
  const body: DomainCheckResponse = { result: 'error', domains: [], message };
  return json(body, status, extra);
}

/**
 * The browser-facing version of a result. A price is attached only when it is
 * exactly what direct checkout would charge: the name is available, standard
 * tier, sold through direct checkout, and costed by the fulfilment registrar.
 * Otherwise no price is shown and WHMCS prices it at checkout.
 */
export function publicResult(result: ProviderResult, env: CloudflareEnv, settings: CheckoutSettings): DomainCheckResult {
  const eligible =
    result.status === 'available' &&
    !result.premium &&
    result.cost !== undefined &&
    result.source === settings.direct.provider &&
    directAllowsTld(settings, tldOf(result.domain));
  return toPublic(result, eligible && result.cost ? retailPrice(result.cost, env) : undefined);
}

/** Pull a clean, de-duplicated list of checkable domains out of the body. */
export function parseDomainList(value: unknown, max = MAX_DOMAINS): string[] {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter((d): d is string => typeof d === 'string').map((d) => d.trim().toLowerCase()))]
    .filter((d) => DOMAIN_RE.test(d))
    .slice(0, max);
}

function recordAnalytics(env: CloudflareEnv, ctx: Ctx, request: Request, results: ProviderResult[]): void {
  const kv = env.DOMAIN_ANALYTICS;
  if (!kv) return;
  const timestamp = new Date().toISOString();
  const userAgent = request.headers.get('user-agent');
  const country = request.headers.get('cf-ipcountry');
  const stamp = Date.now();
  ctx.waitUntil(
    Promise.all(
      results.map((r) => {
        const record: DomainAnalytics = { domain: r.domain, timestamp, userAgent, country, available: r.status === 'available' };
        return kv.put(`analytics:${r.domain}:${stamp}`, JSON.stringify(record), { expirationTtl: ANALYTICS_TTL_SECONDS });
      }),
    ).catch((error) => console.error('Analytics write failed:', error)),
  );
}

/**
 * POST /api/domains/check  { domains: string[] }
 *
 * Checks up to 20 domains through the provider chain (Cloudflare Registrar →
 * WHMCS → RDAP, whichever are configured). With `Accept: application/x-ndjson`
 * it streams one `result` event per domain as it lands; otherwise it returns
 * a single JSON body. Anything but POST gets a 405.
 */
export async function handleDomainCheck(
  request: Request,
  env: CloudflareEnv,
  ctx: Ctx,
  deps: Deps = { fetch },
): Promise<Response> {
  if (request.method !== 'POST') return fail('Use POST.', 405, { Allow: 'POST' });

  const payload = await readJsonObject(request);
  if (!payload) return fail(BAD_BODY, 400);

  const domains = parseDomainList(payload.domains);
  if (domains.length === 0) return fail('No valid domains to check.', 400);

  if (!(await allowRequest(env.SEARCH_LIMITER, clientIp(request)))) return tooMany();

  const providers = buildProviders(env, deps.fetch);
  if (providers.length === 0) return fail('Availability check is not configured.', 503);

  const settings = checkoutSettings(env);
  const waitUntil = (p: Promise<unknown>) => ctx.waitUntil(p);

  if (wantsNdjson(request)) {
    return ndjson(async (send) => {
      send({ type: 'start', domains });
      const results = await checkWithCache(
        domains,
        providers,
        (r) => send({ type: 'result', result: publicResult(r, env, settings) }),
        { waitUntil },
      );
      recordAnalytics(env, ctx, request, results);
      send({ type: 'done' });
    }, waitUntil);
  }

  try {
    const results = await checkWithCache(domains, providers, () => undefined, { waitUntil });
    recordAnalytics(env, ctx, request, results);
    const body: DomainCheckResponse = { result: 'success', domains: results.map((r) => publicResult(r, env, settings)) };
    return json(body);
  } catch (error) {
    console.error('Domain check error:', error);
    return fail('We could not check availability right now.', 502);
  }
}
