import type { DomainCheckResult, ProviderId } from '../../types/domains';
import { errorResult, type AvailabilityProvider, type ProviderResult } from './types.ts';

export type { AvailabilityProvider, ProviderResult } from './types.ts';

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += Math.max(1, size)) out.push(items.slice(i, i + Math.max(1, size)));
  return out;
}

/**
 * Ask providers in order. Each domain takes the first definite answer
 * (available / unavailable); an "error" from one provider hands that domain
 * to the next. Definite answers are reported through `onResult` the moment
 * they land, so the UI can stream rows; domains nobody could answer are
 * reported last with the final error.
 */
export async function runChain(
  domains: string[],
  providers: AvailabilityProvider[],
  onResult: (result: ProviderResult) => void = () => undefined,
  signal?: AbortSignal,
): Promise<ProviderResult[]> {
  const final = new Map<string, ProviderResult>();
  let pending = [...domains];

  for (const provider of providers) {
    if (pending.length === 0 || signal?.aborted) break;
    const errored: string[] = [];

    await Promise.all(
      chunk(pending, provider.batchSize).map(async (batch) => {
        let results: ProviderResult[];
        try {
          results = await provider.check(batch, signal);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Lookup failed';
          results = batch.map((d) => errorResult(d, provider.id, message));
        }
        const byDomain = new Map(results.map((r) => [r.domain, r]));
        for (const domain of batch) {
          const result = byDomain.get(domain) ?? errorResult(domain, provider.id, 'No answer');
          final.set(domain, result);
          if (result.status === 'error') errored.push(domain);
          else onResult(result);
        }
      }),
    );

    // A provider that can't answer is otherwise invisible: the next one covers
    // for it. Log why, once per pass, so a misconfigured credential (e.g. the
    // WHMCS "Invalid IP" rejection) shows up in the Worker's logs.
    if (errored.length) {
      const reasons = [...new Set(errored.map((d) => final.get(d)?.message ?? 'No answer'))].slice(0, 3);
      console.warn(`[availability] ${provider.id} could not answer ${errored.length} of ${pending.length}: ${reasons.join(' | ')}`);
    }

    pending = errored;
  }

  for (const domain of pending) {
    const last = providers[providers.length - 1];
    const result = final.get(domain) ?? errorResult(domain, last?.id ?? 'rdap', 'No provider is configured');
    final.set(domain, result);
    onResult(result);
  }

  return domains.map((d) => final.get(d)!);
}

/**
 * Short-lived edge cache in front of the chain. Taken names barely change;
 * available ones can go at any moment, so they expire fast. Errors are never
 * cached. The Cache API is a no-op on workers.dev, which is fine.
 */
const TTL_SECONDS: Record<'available' | 'unavailable', number> = { available: 60, unavailable: 900 };
const CACHE_ORIGIN = 'https://availability-cache.wrld.domains/v1/';

function cacheKey(domain: string): Request {
  return new Request(`${CACHE_ORIGIN}${encodeURIComponent(domain)}`);
}

async function edgeCache(): Promise<Cache | null> {
  try {
    return typeof caches !== 'undefined' && 'default' in caches ? (caches as unknown as { default: Cache }).default : null;
  } catch {
    return null;
  }
}

export async function checkWithCache(
  domains: string[],
  providers: AvailabilityProvider[],
  onResult: (result: ProviderResult) => void,
  { signal, waitUntil }: { signal?: AbortSignal; waitUntil?: (p: Promise<unknown>) => void } = {},
): Promise<ProviderResult[]> {
  const cache = await edgeCache();
  const hits = new Map<string, ProviderResult>();

  if (cache) {
    await Promise.all(
      domains.map(async (domain) => {
        const res = await cache.match(cacheKey(domain)).catch(() => undefined);
        if (res) hits.set(domain, (await res.json()) as ProviderResult);
      }),
    );
  }
  for (const hit of hits.values()) onResult(hit);

  const misses = domains.filter((d) => !hits.has(d));
  const fresh = misses.length ? await runChain(misses, providers, onResult, signal) : [];

  if (cache) {
    const writes = fresh
      .filter((r): r is ProviderResult & { status: 'available' | 'unavailable' } => r.status !== 'error')
      .map((r) =>
        cache.put(
          cacheKey(r.domain),
          new Response(JSON.stringify(r), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${TTL_SECONDS[r.status]}` },
          }),
        ),
      );
    const settle = Promise.allSettled(writes);
    if (waitUntil) waitUntil(settle);
  }

  const byDomain = new Map([...hits.values(), ...fresh].map((r) => [r.domain, r]));
  return domains.map((d) => byDomain.get(d)!);
}

/** Drop internal fields (cost basis) before a result leaves the Worker. */
export function toPublic(result: ProviderResult, price?: DomainCheckResult['price']): DomainCheckResult {
  const { cost: _cost, renewalCost: _renewal, ...rest } = result;
  void _cost;
  void _renewal;
  return price ? { ...rest, price } : rest;
}

export function providerIds(providers: AvailabilityProvider[]): ProviderId[] {
  return providers.map((p) => p.id);
}
