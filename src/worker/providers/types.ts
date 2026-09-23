import type { DomainCheckResult, Money, ProviderId } from '../../types/domains';

/**
 * A provider's answer for one domain. `cost` is what WRLD would pay the
 * registrar; it feeds the pricing policy and is stripped before anything is
 * sent to the browser (see toPublic in ./index.ts).
 */
export interface ProviderResult extends DomainCheckResult {
  cost?: Money;
  /** Renewal cost, when the provider reports it. Also never sent to the browser. */
  renewalCost?: Money;
}

export interface AvailabilityProvider {
  id: ProviderId;
  /** Most domains one check() call may carry; the chain splits larger sets. */
  batchSize: number;
  /**
   * Answer every domain passed in, one result each, in any order. A result
   * with status "error" means "I can't answer this one"; the chain then asks
   * the next provider. Throwing marks the whole batch as errors.
   */
  check(domains: string[], signal?: AbortSignal): Promise<ProviderResult[]>;
}

/** Per-request timeout for any single upstream call. */
export const UPSTREAM_TIMEOUT_MS = 6_000;

/** Combine the caller's signal (client went away) with a per-call timeout. */
export function withTimeout(signal: AbortSignal | undefined, ms = UPSTREAM_TIMEOUT_MS): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** "10.11" (major units, as registrars send it) → 1011 minor units. */
export function parseMajorAmount(value: unknown, currency: unknown): Money | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0 || typeof currency !== 'string' || !currency) return undefined;
  return { amount: Math.round(n * 100), currency: currency.toUpperCase() };
}

export function errorResult(domain: string, source: ProviderId, message: string): ProviderResult {
  return { domain, status: 'error', source, message };
}
