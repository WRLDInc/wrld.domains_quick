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
    /** A paid order would create a real, billed registration (live flag on and not the sandbox). */
    realRegistrations: boolean;
    /** The Stripe key is a test/sandbox key. */
    testMode: boolean;
    /** Why direct checkout is off, for the logs and DEPLOYMENT.md checklist. */
    missing: string[];
  };
}

/**
 * TLDs whose registry minimum term is longer than the one year direct
 * checkout sells (Cloudflare documents .ai as two years). They stay on WRLD.host.
 */
export const MIN_TERM_OVER_ONE_YEAR = new Set(['ai']);

export function checkoutSettings(env: CloudflareEnv): CheckoutSettings {
  const raw = env.CHECKOUT_MODE?.trim().toLowerCase();
  const mode: CheckoutMode = raw === 'direct' || raw === 'both' ? raw : 'whmcs';
  const provider: FulfillmentProvider | null = (env.FULFILLMENT_PROVIDER ?? 'cloudflare') === 'cloudflare' ? 'cloudflare' : null;
  const key = env.STRIPE_SECRET_KEY ?? '';
  const testMode = key.startsWith('sk_test_') || key.startsWith('rk_test_');
  const live = flag(env.REGISTRAR_LIVE);
  const realRegistrations = live && !flag(env.CF_REGISTRAR_SANDBOX);

  const missing: string[] = [];
  if (mode === 'whmcs') missing.push('CHECKOUT_MODE=direct|both');
  if (!env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!env.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!env.ORDERS) missing.push('ORDERS (KV binding)');
  // Orders that stop for review must reach a person, or "our team was notified" is a lie.
  if (!env.ORDER_WEBHOOK_URL) missing.push('ORDER_WEBHOOK_URL');
  if (!provider) missing.push('FULFILLMENT_PROVIDER=cloudflare');
  if (provider === 'cloudflare' && !(env.CF_ACCOUNT_ID && env.CF_REGISTRAR_API_TOKEN)) {
    missing.push('CF_ACCOUNT_ID + CF_REGISTRAR_API_TOKEN');
  }
  // Test money must never buy a real domain, and real money must never end in a dry run.
  if (key && testMode === realRegistrations) {
    missing.push(
      testMode
        ? 'mode mismatch: Stripe test key with a live registrar (set CF_REGISTRAR_SANDBOX=true or REGISTRAR_LIVE=false)'
        : 'mode mismatch: live Stripe key without a live registrar (CF_REGISTRAR_SANDBOX=false and REGISTRAR_LIVE=true)',
    );
  }

  return {
    mode,
    direct: {
      enabled: missing.length === 0,
      provider,
      tlds: list(env.DIRECT_TLDS),
      live,
      realRegistrations,
      testMode,
      missing,
    },
  };
}

/** Direct checkout can sell this TLD (all one-year TLDs when DIRECT_TLDS is empty). */
export function directAllowsTld(settings: CheckoutSettings, tld: string): boolean {
  const { enabled, tlds } = settings.direct;
  return enabled && !MIN_TERM_OVER_ONE_YEAR.has(tld) && (tlds.length === 0 || tlds.includes(tld));
}

export function publicConfig(env: CloudflareEnv): PublicConfig {
  const providers = buildProviders(env).map((p) => p.id);
  const checkout = checkoutSettings(env);
  const engine = suggestEngine(env);
  return {
    availability: { live: providers.length > 0, providers },
    suggest: { enabled: engine !== null, engine: engine?.label ?? null },
    wishlist: { botId: env.GLEAP_WISHLIST_BOT_ID?.trim() || null },
    checkout: {
      mode: checkout.direct.enabled ? checkout.mode : 'whmcs',
      direct: {
        enabled: checkout.direct.enabled,
        provider: checkout.direct.provider,
        tlds: checkout.direct.tlds.filter((t) => !MIN_TERM_OVER_ONE_YEAR.has(t)),
      },
    },
  };
}

export function siteUrl(env: CloudflareEnv): string {
  return (env.SITE_URL ?? 'https://wrld.domains').replace(/\/+$/, '');
}
