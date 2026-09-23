import { buildProviders, checkoutSettings } from './config.ts';
import { publicResult, type Deps } from './domains-check.ts';
import { checkWithCache } from './providers/index.ts';
import { suggestEngine, type SuggestEngine } from './suggest-engine.ts';
import { allowRequest, clientIp, json, ndjson, readJsonObject, tooMany, wantsNdjson } from './http.ts';

export const MIN_DESCRIPTION = 8;
export const MAX_DESCRIPTION = 500;

type Ctx = Pick<ExecutionContext, 'waitUntil'>;

/** Collapse whitespace, strip control characters, and cap the length. */
export function cleanDescription(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

/**
 * POST /api/domains/suggest  { description: string }
 *
 * Generates names from a business description (Claude → Workers AI →
 * wordplay), then checks every name through the same provider chain as the
 * search. Streams a `suggestions` event followed by one `result` per name
 * when the client asks for NDJSON; otherwise returns everything as JSON.
 */
export async function handleSuggest(
  request: Request,
  env: CloudflareEnv,
  ctx: Ctx,
  deps: Deps & { engine?: SuggestEngine | null } = { fetch },
): Promise<Response> {
  if (request.method !== 'POST') return json({ result: 'error', message: 'Use POST.' }, 405, { Allow: 'POST' });

  const payload = await readJsonObject(request);
  const description = cleanDescription(payload?.description);
  if (description.length < MIN_DESCRIPTION) {
    return json({ result: 'error', message: 'Tell us a little about the business. A sentence is plenty.' }, 400);
  }

  const engine = deps.engine !== undefined ? deps.engine : suggestEngine(env);
  if (!engine) return json({ result: 'error', message: 'AI suggestions are not configured.' }, 503);

  if (!(await allowRequest(env.SUGGEST_LIMITER, clientIp(request)))) return tooMany();

  const providers = buildProviders(env, deps.fetch);
  const settings = checkoutSettings(env);
  const waitUntil = (p: Promise<unknown>) => ctx.waitUntil(p);

  if (wantsNdjson(request)) {
    return ndjson(async (send) => {
      const generated = await engine.generate({ description });
      send({ type: 'suggestions', engine: generated.engine, suggestions: generated.suggestions });
      const domains = generated.suggestions.map((s) => s.domain);
      if (domains.length && providers.length) {
        await checkWithCache(domains, providers, (r) => send({ type: 'result', result: publicResult(r, env, settings) }), {
          waitUntil,
        });
      }
      send({ type: 'done' });
    }, waitUntil);
  }

  const generated = await engine.generate({ description });
  const domains = generated.suggestions.map((s) => s.domain);
  const results = domains.length && providers.length ? await checkWithCache(domains, providers, () => undefined, { waitUntil }) : [];
  const byDomain = new Map(results.map((r) => [r.domain, publicResult(r, env, settings)]));
  return json({
    result: 'success',
    engine: generated.engine,
    suggestions: generated.suggestions.map((s) => ({ ...s, ...(byDomain.get(s.domain) ?? { status: 'error' }) })),
  });
}
