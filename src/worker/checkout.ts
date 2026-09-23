import { DOMAIN_RE, tldOf } from '../lib/domains.ts';
import type { Money } from '../types/domains';
import { checkoutSettings, directAllowsTld, siteUrl, type CheckoutSettings } from './config.ts';
import { cloudflareProvider, registrarBase, type CloudflareConfig } from './providers/cloudflare.ts';
import type { ProviderResult } from './providers/types.ts';
import { retailPrice } from './pricing.ts';
import { ensureTldProduct, stripeClient, verifyWebhook, type StripeClient } from './stripe.ts';
import { json, readJsonObject } from './http.ts';

/**
 * Direct checkout: Stripe collects payment and the registrant's details, then
 * the webhook registers the domain with Cloudflare Registrar.
 *
 * Guard rails, because Cloudflare bills WRLD's card and registrations are
 * non-refundable:
 *  - availability and cost are re-checked at the registrar when the session
 *    is created AND again after payment; a higher cost or a taken name stops
 *    the order for human review instead of registering at a loss;
 *  - nothing is registered unless REGISTRAR_LIVE is exactly "true" (dry run
 *    otherwise, with the would-be request recorded on the order);
 *  - premium names never go through here (the Cloudflare API can't sell them);
 *  - orders are keyed by Checkout Session ID, so webhook retries are no-ops.
 */

export type OrderState =
  | 'paid' // payment confirmed, registration not yet attempted
  | 'dry_run' // REGISTRAR_LIVE is off: recorded, not registered
  | 'registering' // registrar accepted the request (202), still working
  | 'action_required' // e.g. registrant email confirmation pending
  | 'registered'
  | 'needs_review' // stopped before registering; a human decides (refund or retry)
  | 'failed';

export interface Order {
  sessionId: string;
  domain: string;
  years: number;
  amount: Money;
  cost: Money;
  provider: 'cloudflare';
  state: OrderState;
  livemode: boolean;
  email?: string;
  note?: string;
  registrar?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutDeps {
  fetch: typeof fetch;
  stripe?: StripeClient;
  now?: () => number;
}

type Ctx = Pick<ExecutionContext, 'waitUntil'>;

function cfConfig(env: CloudflareEnv): CloudflareConfig {
  return {
    accountId: env.CF_ACCOUNT_ID ?? '',
    apiToken: env.CF_REGISTRAR_API_TOKEN ?? '',
    sandbox: env.CF_REGISTRAR_SANDBOX?.trim().toLowerCase() === 'true',
  };
}

async function quote(env: CloudflareEnv, domain: string, fetcher: typeof fetch): Promise<ProviderResult> {
  const [result] = await cloudflareProvider(cfConfig(env), fetcher).check([domain]);
  return result;
}

// ---- POST /api/checkout -------------------------------------------------------

export async function handleCreateCheckout(
  request: Request,
  env: CloudflareEnv,
  deps: CheckoutDeps = { fetch },
): Promise<Response> {
  if (request.method !== 'POST') return json({ result: 'error', message: 'Use POST.' }, 405, { Allow: 'POST' });

  const settings = checkoutSettings(env);
  if (!settings.direct.enabled || settings.mode === 'whmcs') {
    return json({ result: 'error', message: 'Direct checkout is not available. Register on WRLD.host instead.' }, 503);
  }

  const body = await readJsonObject(request);
  const domain = typeof body?.domain === 'string' ? body.domain.trim().toLowerCase() : '';
  const years = Math.min(10, Math.max(1, Math.round(Number(body?.years ?? 1)) || 1));
  if (!DOMAIN_RE.test(domain)) return json({ result: 'error', message: 'That doesn’t look like a domain.' }, 400);
  const tld = tldOf(domain);
  if (!directAllowsTld(settings, tld)) {
    return json({ result: 'error', message: `.${tld} isn’t sold through quick checkout yet. Register it on WRLD.host.` }, 409);
  }

  // Never trust the price or availability the browser saw.
  const q = await quote(env, domain, deps.fetch);
  if (q.status !== 'available' || q.premium || !q.cost) {
    const message = q.status === 'unavailable' ? `${domain} was just taken.` : `We can’t sell ${domain} through quick checkout.`;
    return json({ result: 'error', message }, 409);
  }

  const amount = retailPrice(q.cost, env, years);
  const stripe = deps.stripe ?? stripeClient(env.STRIPE_SECRET_KEY ?? '', deps.fetch);
  const product = await ensureTldProduct(stripe, tld);
  const site = siteUrl(env);
  const now = deps.now?.() ?? Date.now();
  const metadata = {
    domain,
    years: String(years),
    provider: 'cloudflare',
    cost_cents: String(q.cost.amount * years),
    cost_currency: q.cost.currency,
  };

  const session = await stripe.request<{ id: string; url: string }>('POST', '/checkout/sessions', {
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: amount.currency.toLowerCase(),
          product,
          unit_amount: amount.amount,
        },
      },
    ],
    customer_creation: 'always',
    billing_address_collection: 'required',
    phone_number_collection: { enabled: true },
    custom_fields: [
      { key: 'organization', label: { type: 'custom', custom: 'Business name (optional)' }, type: 'text', optional: true },
    ],
    custom_text: {
      submit: { message: `We register ${domain} for ${years} year${years > 1 ? 's' : ''} as soon as payment clears. Your name and address become the registrant contact.` },
    },
    client_reference_id: domain,
    metadata,
    payment_intent_data: { metadata, description: `${domain} registration (${years}y)` },
    // Quotes go stale; the minimum Stripe allows is 30 minutes.
    expires_at: Math.floor(now / 1000) + 31 * 60,
    success_url: `${site}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/?cancelled=${encodeURIComponent(domain)}`,
  });

  return json({ result: 'success', url: session.url });
}

// ---- POST /api/stripe/webhook ------------------------------------------------

interface CheckoutSession {
  id: string;
  livemode: boolean;
  payment_status?: string;
  payment_intent?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string>;
  customer_details?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
    } | null;
  } | null;
  custom_fields?: { key: string; text?: { value?: string | null } | null }[];
}

/** Cloudflare wants ASCII-only contact data. */
export function ascii(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim();
}

const CALLING_CODES: Record<string, string> = {
  US: '1', CA: '1', PR: '1', MX: '52', GB: '44', IE: '353', DE: '49', FR: '33', ES: '34', IT: '39',
  NL: '31', BE: '32', CH: '41', AT: '43', SE: '46', NO: '47', DK: '45', FI: '358', PT: '351', PL: '48',
  AU: '61', NZ: '64', IN: '91', JP: '81', KR: '82', SG: '65', BR: '55', AR: '54', CO: '57', ZA: '27',
};

/** E.164 (+15555550123) → registrar format (+1.5555550123), using the billing country's calling code. */
export function registrarPhone(e164: string | null | undefined, country: string | null | undefined): string | null {
  const digits = (e164 ?? '').replace(/[^\d]/g, '');
  if (!digits) return null;
  const code = CALLING_CODES[(country ?? '').toUpperCase()];
  if (code && digits.startsWith(code) && digits.length > code.length) return `+${code}.${digits.slice(code.length)}`;
  return null;
}

export function registrantFromSession(session: CheckoutSession) {
  const d = session.customer_details ?? {};
  const a = d.address ?? {};
  const organization = ascii(session.custom_fields?.find((f) => f.key === 'organization')?.text?.value);
  const phone = registrarPhone(d.phone, a.country);
  const street = ascii([a.line1, a.line2].filter(Boolean).join(', '));
  const registrant = {
    email: (d.email ?? '').trim(),
    phone,
    postal_info: {
      name: ascii(d.name),
      ...(organization ? { organization } : {}),
      address: {
        street,
        city: ascii(a.city),
        state: ascii(a.state),
        postal_code: ascii(a.postal_code),
        country_code: (a.country ?? '').toUpperCase(),
      },
    },
  };
  const missing = [
    !registrant.email && 'email',
    !registrant.phone && 'phone',
    !registrant.postal_info.name && 'name',
    !street && 'street',
    !registrant.postal_info.address.city && 'city',
    !registrant.postal_info.address.country_code && 'country',
  ].filter(Boolean) as string[];
  return { registrant, missing };
}

async function saveOrder(env: CloudflareEnv, order: Order): Promise<void> {
  await env.ORDERS?.put(`order:${order.sessionId}`, JSON.stringify(order));
}

export async function loadOrder(env: CloudflareEnv, sessionId: string): Promise<Order | null> {
  const raw = await env.ORDERS?.get(`order:${sessionId}`);
  return raw ? (JSON.parse(raw) as Order) : null;
}

async function notify(env: CloudflareEnv, fetcher: typeof fetch, order: Order): Promise<void> {
  if (!env.ORDER_WEBHOOK_URL) return;
  const money = `${(order.amount.amount / 100).toFixed(2)} ${order.amount.currency}`;
  const mode = order.livemode ? '' : ' [test]';
  const text = `WRLD.domains order${mode}: ${order.domain} (${order.years}y, ${money}) → ${order.state}${order.note ? ` — ${order.note}` : ''}`;
  await fetcher(env.ORDER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch((error) => console.error('Order notification failed:', error));
}

/** Register (or dry-run) a paid order. Exported for tests. */
export async function fulfil(
  env: CloudflareEnv,
  settings: CheckoutSettings,
  session: CheckoutSession,
  deps: CheckoutDeps,
): Promise<Order> {
  const now = new Date(deps.now?.() ?? Date.now()).toISOString();
  const meta = session.metadata ?? {};
  const domain = meta.domain ?? '';
  const years = Number(meta.years ?? '1') || 1;
  const quotedCost: Money = { amount: Number(meta.cost_cents ?? '0'), currency: meta.cost_currency ?? 'USD' };
  const order: Order = {
    sessionId: session.id,
    domain,
    years,
    amount: { amount: session.amount_total ?? 0, currency: (session.currency ?? 'usd').toUpperCase() },
    cost: quotedCost,
    provider: 'cloudflare',
    state: 'paid',
    livemode: session.livemode,
    email: session.customer_details?.email ?? undefined,
    createdAt: now,
    updatedAt: now,
  };

  const stop = (note: string): Order => ({ ...order, state: 'needs_review', note, updatedAt: now });

  if (!DOMAIN_RE.test(domain)) return stop('Session metadata has no valid domain');
  const { registrant, missing } = registrantFromSession(session);
  if (missing.length) return stop(`Registrant details incomplete: ${missing.join(', ')}`);

  const q = await quote(env, domain, deps.fetch);
  if (q.status !== 'available' || q.premium || !q.cost) return stop(`No longer registrable (${q.status}${q.message ? `: ${q.message}` : ''})`);
  if (q.cost.currency !== quotedCost.currency || q.cost.amount * years > quotedCost.amount) {
    return stop(`Registrar cost rose from ${quotedCost.amount} to ${q.cost.amount * years} ${q.cost.currency}`);
  }

  const request = { domain_name: domain, years, auto_renew: false, privacy_mode: 'redaction', contacts: { registrant } };
  if (!settings.direct.live) {
    return { ...order, state: 'dry_run', note: 'REGISTRAR_LIVE is off; nothing was registered', registrar: { request }, updatedAt: now };
  }

  const config = cfConfig(env);
  const res = await deps.fetch(`${registrarBase(config)}/registrations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify(request),
  });
  const payload = (await res.json().catch(() => null)) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: { state?: string; completed?: boolean };
  } | null;
  if (!res.ok || !payload?.success) {
    return { ...order, state: 'failed', note: payload?.errors?.[0]?.message ?? `Cloudflare HTTP ${res.status}`, registrar: payload, updatedAt: now };
  }
  const state = payload.result?.state;
  const mapped: OrderState =
    state === 'succeeded' ? 'registered' : state === 'failed' ? 'failed' : state === 'action_required' ? 'action_required' : 'registering';
  return { ...order, state: mapped, registrar: payload.result, updatedAt: now };
}

export async function handleStripeWebhook(
  request: Request,
  env: CloudflareEnv,
  ctx: Ctx,
  deps: CheckoutDeps = { fetch },
): Promise<Response> {
  if (request.method !== 'POST') return json({ received: false }, 405, { Allow: 'POST' });
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ received: false, message: 'Webhook secret not configured.' }, 503);

  const payload = await request.text();
  const ok = await verifyWebhook(payload, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET, {
    now: deps.now?.() ?? Date.now(),
  });
  if (!ok) return json({ received: false, message: 'Bad signature.' }, 400);

  const event = JSON.parse(payload) as { type?: string; data?: { object?: CheckoutSession } };
  const session = event.data?.object;
  const paidEvent =
    (event.type === 'checkout.session.completed' && session?.payment_status === 'paid') ||
    event.type === 'checkout.session.async_payment_succeeded';
  if (!paidEvent || !session?.id) return json({ received: true, ignored: event.type });

  const existing = await loadOrder(env, session.id);
  if (existing) return json({ received: true, state: existing.state }); // Stripe retries are no-ops.

  // Claim the order before calling the registrar so a retry that lands mid-flight
  // sees it. (KV isn't transactional; Cloudflare allowing one registration per
  // domain is the backstop against a double registration.)
  const claimedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await saveOrder(env, {
    sessionId: session.id,
    domain: session.metadata?.domain ?? '',
    years: Number(session.metadata?.years ?? '1') || 1,
    amount: { amount: session.amount_total ?? 0, currency: (session.currency ?? 'usd').toUpperCase() },
    cost: { amount: Number(session.metadata?.cost_cents ?? '0'), currency: session.metadata?.cost_currency ?? 'USD' },
    provider: 'cloudflare',
    state: 'paid',
    livemode: session.livemode,
    createdAt: claimedAt,
    updatedAt: claimedAt,
  });

  const settings = checkoutSettings(env);
  const order = await fulfil(env, settings, session, deps).catch((error): Order => {
    const now = new Date(deps.now?.() ?? Date.now()).toISOString();
    return {
      sessionId: session.id,
      domain: session.metadata?.domain ?? '',
      years: Number(session.metadata?.years ?? '1') || 1,
      amount: { amount: session.amount_total ?? 0, currency: (session.currency ?? 'usd').toUpperCase() },
      cost: { amount: Number(session.metadata?.cost_cents ?? '0'), currency: session.metadata?.cost_currency ?? 'USD' },
      provider: 'cloudflare',
      state: 'needs_review',
      livemode: session.livemode,
      note: `Fulfilment error: ${error instanceof Error ? error.message : String(error)}`,
      createdAt: now,
      updatedAt: now,
    };
  });
  await saveOrder(env, order);
  ctx.waitUntil(notify(env, deps.fetch, order));
  return json({ received: true, state: order.state });
}

// ---- GET /api/checkout/status?session_id= --------------------------------------

/** What the success page may show: never contact details or registrar payloads. */
export async function handleCheckoutStatus(request: Request, env: CloudflareEnv): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get('session_id') ?? '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return json({ result: 'error', message: 'Unknown order.' }, 400);
  const order = await loadOrder(env, sessionId);
  if (!order) return json({ result: 'pending', state: 'paid' }, 200, { 'Retry-After': '2' });
  return json({ result: 'success', state: order.state, domain: order.domain, years: order.years, livemode: order.livemode });
}
