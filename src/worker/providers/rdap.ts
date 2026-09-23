import { errorResult, withTimeout, type AvailabilityProvider, type ProviderResult } from './types.ts';

/**
 * RDAP: the free fallback that needs no account. The IANA bootstrap file maps
 * each TLD to its registry's RDAP server; a domain lookup there answers 200
 * when the name is registered and 404 when it isn't.
 *
 * Caveats, which is why this sits last in the chain:
 *  - 404 means "not registered", not "purchasable": reserved, blocked and
 *    premium names also 404 (example.tech → "Registry Blocked"). The UI
 *    therefore labels an RDAP "available" as "Looks available", and direct
 *    checkout always re-checks with the registrar before charging.
 *  - .io, .co, .me and .us have no bootstrap entry. io/me/us use verified
 *    overrides below; everything else missing (including .co) comes back as
 *    an error and the UI hands off to WHMCS.
 *  - Registries rate-limit, and Workers egress from shared Cloudflare IPs, so
 *    a 429 is possible under load. It is reported as an error, never a guess.
 */

export const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const BOOTSTRAP_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Servers for TLDs missing from the IANA file. Each was verified on
 * 2026-09-23 to answer 200 for a registered name and 404 for an unregistered
 * one. `.co` is deliberately absent: rdap.registry.co returns 404 even for
 * google.co, which would show taken names as available.
 */
export const RDAP_OVERRIDES: Readonly<Record<string, string>> = {
  io: 'https://rdap.identitydigital.services/rdap/',
  me: 'https://rdap.identitydigital.services/rdap/',
  us: 'https://rdap.nic.us/',
};

interface Bootstrap {
  services?: [string[], string[]][];
}

let cached: { at: number; map: Map<string, string> } | null = null;

/** Build tld → base URL (always ending in "/"), preferring https. Exported for tests. */
export function parseBootstrap(data: Bootstrap): Map<string, string> {
  const map = new Map<string, string>();
  for (const service of data.services ?? []) {
    const [tlds, urls] = service;
    const url = urls.find((u) => u.startsWith('https://')) ?? urls[0];
    if (!url) continue;
    const base = url.endsWith('/') ? url : `${url}/`;
    for (const tld of tlds) map.set(tld.toLowerCase(), base);
  }
  return map;
}

async function bootstrap(fetcher: typeof fetch, signal?: AbortSignal): Promise<Map<string, string>> {
  if (cached && Date.now() - cached.at < BOOTSTRAP_TTL_MS) return cached.map;
  const res = await fetcher(BOOTSTRAP_URL, {
    signal: withTimeout(signal),
    // Let Cloudflare's edge cache the file too, so cold isolates don't all hit IANA.
    cf: { cacheTtl: 43_200, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) throw new Error(`RDAP bootstrap HTTP ${res.status}`);
  const map = parseBootstrap((await res.json()) as Bootstrap);
  for (const [tld, base] of Object.entries(RDAP_OVERRIDES)) if (!map.has(tld)) map.set(tld, base);
  cached = { at: Date.now(), map };
  return map;
}

/** Test hook: forget the cached bootstrap. */
export function resetRdapCache(): void {
  cached = null;
}

/** The registry-level TLD RDAP is keyed by: "uk" for acme.co.uk. */
function registryTld(domain: string): string {
  return domain.slice(domain.lastIndexOf('.') + 1);
}

export function rdapProvider(fetcher: typeof fetch = fetch): AvailabilityProvider {
  async function lookup(domain: string, servers: Map<string, string>, signal?: AbortSignal): Promise<ProviderResult> {
    const base = servers.get(registryTld(domain));
    if (!base) return errorResult(domain, 'rdap', 'No RDAP service for this TLD');
    try {
      const res = await fetcher(`${base}domain/${encodeURIComponent(domain)}`, {
        headers: { Accept: 'application/rdap+json, application/json' },
        signal: withTimeout(signal, 4_000),
        redirect: 'follow',
      });
      // Drain the body so the connection can be reused.
      await res.body?.cancel();
      if (res.status === 404) return { domain, status: 'available', source: 'rdap' };
      if (res.ok) return { domain, status: 'unavailable', source: 'rdap' };
      return errorResult(domain, 'rdap', `RDAP HTTP ${res.status}`);
    } catch (error) {
      return errorResult(domain, 'rdap', error instanceof Error ? error.message : 'RDAP lookup failed');
    }
  }

  return {
    id: 'rdap',
    // One HTTP lookup per domain; the chain runs batches in parallel.
    batchSize: 1,
    async check(domains, signal) {
      const servers = await bootstrap(fetcher, signal);
      return Promise.all(domains.map((d) => lookup(d, servers, signal)));
    },
  };
}
