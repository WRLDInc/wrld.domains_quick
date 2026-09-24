import { errorResult, parseMajorAmount, withTimeout, type AvailabilityProvider, type ProviderResult } from './types.ts';

/**
 * Cloudflare Registrar API (beta, 2026-04). POST .../registrar/domain-check
 * queries the registry on every call (no cache), takes 1–20 domains, and
 * returns Cloudflare's at-cost price. https://developers.cloudflare.com/registrar/registrar-api/
 *
 * `reason` values: domain_unavailable, domain_premium,
 * extension_not_supported_via_api, extension_not_supported,
 * extension_disallows_registration. Anything about the extension means
 * "Cloudflare can't answer for this TLD", so we return an error result and the
 * chain moves on to the next provider.
 */

const API = 'https://api.cloudflare.com/client/v4';

interface CheckEntry {
  name?: string;
  registrable?: boolean;
  tier?: string;
  reason?: string;
  pricing?: { currency?: string; registration_cost?: string; renewal_cost?: string };
}

interface CheckEnvelope {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: { domains?: CheckEntry[] };
}

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  /** Use the registrar-sandbox endpoints (com/net only, no billing). */
  sandbox?: boolean;
}

export function registrarBase({ accountId, sandbox }: Pick<CloudflareConfig, 'accountId' | 'sandbox'>): string {
  return `${API}/accounts/${encodeURIComponent(accountId)}/${sandbox ? 'registrar-sandbox' : 'registrar'}`;
}

/** Map one domain-check entry onto our result shape. Exported for tests. */
export function mapCheckEntry(domain: string, entry: CheckEntry | undefined): ProviderResult {
  if (!entry) return errorResult(domain, 'cloudflare', 'No answer for this domain');

  const cost = parseMajorAmount(entry.pricing?.registration_cost, entry.pricing?.currency);
  const renewalCost = parseMajorAmount(entry.pricing?.renewal_cost, entry.pricing?.currency);
  const premium = entry.tier === 'premium' || entry.reason === 'domain_premium';

  if (entry.registrable) {
    return { domain, status: 'available', source: 'cloudflare', premium: premium || undefined, cost, renewalCost };
  }
  if (entry.reason === 'domain_premium') {
    // Available at the registry, but Cloudflare's API can't sell premium names.
    return { domain, status: 'available', source: 'cloudflare', premium: true };
  }
  if (entry.reason === 'domain_unavailable') {
    return { domain, status: 'unavailable', source: 'cloudflare' };
  }
  return errorResult(domain, 'cloudflare', entry.reason ?? 'Not registrable via Cloudflare');
}

export function cloudflareProvider(config: CloudflareConfig, fetcher: typeof fetch = fetch): AvailabilityProvider {
  return {
    id: 'cloudflare',
    batchSize: 20,
    async check(domains, signal) {
      const res = await fetcher(`${registrarBase(config)}/domain-check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains }),
        signal: withTimeout(signal),
      });
      const body = (await res.json().catch(() => null)) as CheckEnvelope | null;
      if (!res.ok || !body?.success) {
        const message = body?.errors?.[0]?.message ?? `Cloudflare HTTP ${res.status}`;
        return domains.map((d) => errorResult(d, 'cloudflare', message));
      }
      const byName = new Map((body.result?.domains ?? []).map((e) => [e.name?.toLowerCase() ?? '', e]));
      return domains.map((d) => mapCheckEntry(d, byName.get(d)));
    },
  };
}
