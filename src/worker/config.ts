import type { CheckoutMode, FulfillmentProvider, ProviderId, PublicConfig } from '../types/domains';
import type { AvailabilityProvider } from './providers/types.ts';
import { cloudflareProvider } from './providers/cloudflare.ts';
import { rdapProvider } from './providers/rdap.ts';
import { whmcsProvider } from './providers/whmcs.ts';
import { suggestEngine } from './suggest-engine.ts';

/**
 * Everything the Worker can do is switched on by the presence of credentials,
 * never by a code change. This module is the single place that reads env for
 * features, so /api/config always tells the UI the truth.
 */

/**
 * Cloudflare first (registry-authoritative, 20 names per call, price
 * included), WHMCS next (slow, one name per call, but it's the checkout's own
 * view), RDAP last (free, "looks available" only).
 */
export const DEFAULT_PROVIDER_ORDER: ProviderId[] = ['cloudflare', 'whmcs', 'rdap'];

const flag = (value: string | undefined) => value?.trim().toLowerCase() === 'true';
const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);

type ProviderFactory = (env: CloudflareEnv, fetcher: typeof fetch) => AvailabilityProvider | null;

const FACTORIES: Record<ProviderId, ProviderFactory> = {
  cloudflare: (env, fetcher) =>
    env.CF_ACCOUNT_ID && env.CF_REGISTRAR_API_TOKEN
      ? cloudflareProvider(
          { accountId: env.CF_ACCOUNT_ID, apiToken: env.CF_REGISTRAR_API_TOKEN, sandbox: flag(env.CF_REGISTRAR_SANDBOX) },
          fetcher,
        )
      : null,
  whmcs: (env) =>
    env.WHMCS_URL && env.WHMCS_API_IDENTIFIER && env.WHMCS_API_SECRET
      ? whmcsProvider({
          url: env.WHMCS_URL,
          apiIdentifier: env.WHMCS_API_IDENTIFIER,
          apiSecret: env.WHMCS_API_SECRET,
          accessKey: env.WHMCS_API_ACCESS_KEY,
        })
      : null,
  rdap: (_env, fetcher) => rdapProvider(fetcher),
};

/** Configured providers in the order DOMAIN_PROVIDERS (or the default) asks for. */
export function buildProviders(env: CloudflareEnv, fetcher: typeof fetch = fetch): AvailabilityProvider[] {
  const requested = env.DOMAIN_PROVIDERS ? list(env.DOMAIN_PROVIDERS) : DEFAULT_PROVIDER_ORDER;
  const seen = new Set<string>();
  const providers: AvailabilityProvider[] = [];
  for (const id of requested) {
    if (seen.has(id) || !(id in FACTORIES)) continue;
    seen.add(id);
    const provider = FACTORIES[id as ProviderId](env, fetcher);
    if (provider) providers.push(provider);
  }
  return providers;
}

export interface CheckoutSettings {
  mode: CheckoutMode;
  direct: {
    enabled: boolean;
    provider: FulfillmentProvider | null;
    tlds: string[];
    /** True only when REGISTRAR_LIVE is exactly "true"; otherwise paid orders are recorded, not registered. */
    live: boolean;
    /** The Stripe key is a test/sandbox key. */
    testMode: boolean;
    /** Why direct checkout is off, for the logs and DEPLOYMENT.md checklist. */
    missing: string[];
  };
}

export function checkoutSettings(env: CloudflareEnv): CheckoutSettings {
  const raw = env.CHECKOUT_MODE?.trim().toLowerCase();
  const mode: CheckoutMode = raw === 'direct' || raw === 'both' ? raw : 'whmcs';
  const provider: FulfillmentProvider | null = (env.FULFILLMENT_PROVIDER ?? 'cloudflare') === 'cloudflare' ? 'cloudflare' : null;

  const missing: string[] = [];
  if (mode === 'whmcs') missing.push('CHECKOUT_MODE=direct|both');
  if (!env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!env.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!env.ORDERS) missing.push('ORDERS (KV binding)');
  if (!provider) missing.push('FULFILLMENT_PROVIDER=cloudflare');
  if (provider === 'cloudflare' && !(env.CF_ACCOUNT_ID && env.CF_REGISTRAR_API_TOKEN)) {
    missing.push('CF_ACCOUNT_ID + CF_REGISTRAR_API_TOKEN');
  }

  const key = env.STRIPE_SECRET_KEY ?? '';
  return {
    mode,
    direct: {
      enabled: missing.length === 0,
      provider,
      tlds: list(env.DIRECT_TLDS),
      live: flag(env.REGISTRAR_LIVE),
      testMode: key.startsWith('sk_test_') || key.startsWith('rk_test_'),
      missing,
    },
  };
}

/** Direct checkout can sell this TLD (all TLDs when DIRECT_TLDS is empty). */
export function directAllowsTld(settings: CheckoutSettings, tld: string): boolean {
  const { enabled, tlds } = settings.direct;
  return enabled && (tlds.length === 0 || tlds.includes(tld));
}

export function publicConfig(env: CloudflareEnv): PublicConfig {
  const providers = buildProviders(env).map((p) => p.id);
  const checkout = checkoutSettings(env);
  const engine = suggestEngine(env);
  return {
    availability: { live: providers.length > 0, providers },
    suggest: { enabled: engine !== null, engine: engine?.label ?? null },
    checkout: {
      mode: checkout.direct.enabled ? checkout.mode : 'whmcs',
      direct: { enabled: checkout.direct.enabled, provider: checkout.direct.provider, tlds: checkout.direct.tlds },
    },
  };
}

export function siteUrl(env: CloudflareEnv): string {
  return (env.SITE_URL ?? 'https://wrld.domains').replace(/\/+$/, '');
}
