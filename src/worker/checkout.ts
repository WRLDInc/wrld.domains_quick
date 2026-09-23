import { DOMAIN_RE, tldOf } from '../lib/domains.ts';
import type { Money } from '../types/domains';
import { checkoutSettings, directAllowsTld, siteUrl, type CheckoutSettings } from './config.ts';
import { cloudflareProvider, registrarBase, type CloudflareConfig } from './providers/cloudflare.ts';
import type { ProviderResult } from './providers/types.ts';
import { retailPrice } from './pricing.ts';
import { ensureTldProduct, stripeClient, verifyWebhook, type StripeClient } from './stripe.ts';
import { allowRequest, clientIp, json, readJsonObject, readLimitedText, tooMany } from './http.ts';

/**
 * Direct checkout: Stripe collects payment and the registrant's details, then
 * the webhook registers the domain with Cloudflare Registrar.
 *
 * Guard rails, because Cloudflare bills WRLD's card and registrations are
 * non-refundable:
 *  - availability and cost are re-checked at the registrar when the session
 *    is created AND again after payment; a higher cost or a taken name stops
 *    the order for human review instead of registering at a loss, and a
 *    registrar outage makes Stripe retry later instead;
 *  - Stripe's mode must match the registrar's: test payments only ever reach
 *    the sandbox or a dry run, and live payments only a live registrar;
 *  - nothing is registered unless REGISTRAR_LIVE is exactly "true";
 *  - premium names never go through here (the Cloudflare API can't sell them);
 *  - orders are keyed by Checkout Session ID, so webhook retries are no-ops.
 *
 * KV allows one write per second per key and is only eventually consistent,
 * so the claim and the order record live under different keys, each written
 * once per attempt. Before live sales, move orders to D1 or a Durable Object
 * (see DEPLOYMENT.md → go-live prerequisites).
 */

export type OrderState =
  | 'paid' // payment confirmed, registration not yet attempted
  | 'dry_run' // REGISTRAR_LIVE is off: recorded, not registered
  | 'registering' // registrar accepted the request (202), still working
  | 'action_required' // e.g. registrant email confirmation pending
  | 'registered'
  | 'needs_review' // stopped before or during registration; a human decides (refund or retry)
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

/** Tags every session we create, so other products' payments on the same Stripe account are ignored. */
export const SESSION_SOURCE = 'wrld.domains';
/** A claim younger than this means another delivery is mid-flight. */
export const CLAIM_STALE_MS = 2 * 60 * 1000;
const CLAIM_TTL_SECONDS = 7 * 24 * 60 * 60;
/** How often the status endpoint may ask the registrar about an in-flight registration. */
const STATUS_REFRESH_MS = 20_000;
/** Stripe event payloads are a few KB; anything near this is not Stripe. */
const WEBHOOK_MAX_BYTES = 256 * 1024;

/** The registrar was unreachable or couldn't answer; Stripe should retry the webhook later. */
export class RetryableError extends Error {}

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

  // Every attempt costs a registrar quote against Cloudflare's shared API budget.
  if (!(await allowRequest(env.SUGGEST_LIMITER, `checkout:${clientIp(request)}`))) return tooMany();

  const body = await readJsonObject(request);
  const domain = typeof body?.domain === 'string' ? body.domain.trim().toLowerCase() : '';
  if (!DOMAIN_RE.test(domain)) return json({ result: 'error', message: 'That doesn’t look like a domain.' }, 400);
  const tld = tldOf(domain);
  if (!directAllowsTld(settings, tld)) {
    return json({ result: 'error', message: `.${tld} isn’t sold through quick checkout yet. Register it on WRLD.host.` }, 409);
  }
  // One year only: the Cloudflare API can't renew yet, so longer terms wait for renewal support.
  const years = 1;

  try {
    // Never trust the price or availability the browser saw.
    const q = await quote(env, domain, deps.fetch);
    if (q.status !== 'available' || q.premium || !q.cost) {
      const message =
        q.status === 'unavailable'
          ? `${domain} was just taken.`
          : q.status === 'error'
            ? 'We couldn’t confirm the price just now. Try again in a moment, or register on WRLD.host.'
            : `We can’t sell ${domain} through quick checkout.`;
      return json({ result: 'error', message }, q.status === 'error' ? 503 : 409);
    }

    const amount = retailPrice(q.cost, env, years);
    const stripe = deps.stripe ?? stripeClient(env.STRIPE_SECRET_KEY ?? '', deps.fetch);
    const product = await ensureTldProduct(stripe, tld);
    const site = siteUrl(env);
    const now = deps.now?.() ?? Date.now();
    const metadata = {
      source: SESSION_SOURCE,
      domain,
      years: String(years),
      provider: 'cloudflare',
      cost_cents: String(q.cost.amount * years),
      cost_currency: q.cost.currency,
    };

    const session = await stripe.request<{ id: string; url: string }>('POST', '/checkout/sessions', {
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: amount.currency.toLowerCase(), product, unit_amount: amount.amount } }],
      customer_creation: 'always',
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      custom_fields: [
        { key: 'organization', label: { type: 'custom', custom: 'Business name (optional)' }, type: 'text', optional: true },
      ],
      custom_text: {
        submit: {
          message: `We register ${domain} for one year as soon as payment clears. Your name and address become the registrant contact.`,
        },
      },
      client_reference_id: domain,
      metadata,
      payment_intent_data: { metadata, description: `${domain} registration (1y)` },
      // Quotes go stale; the minimum Stripe allows is 30 minutes.
      expires_at: Math.floor(now / 1000) + 31 * 60,
      success_url: `${site}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/?cancelled=${encodeURIComponent(domain)}`,
    });

    return json({ result: 'success', url: session.url });
  } catch (error) {
    console.error('Checkout could not start:', error);
    return json({ result: 'error', message: 'We couldn’t start checkout. Try again, or register on WRLD.host.' }, 502);
  }
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

/**
 * ITU country calling codes are prefix-free: 1 and 7 are the only one-digit
 * codes, these are all the two-digit ones, and every other code has three
 * digits. That's enough to split any E.164 number without knowing the country.
 */
const TWO_DIGIT_CODES = new Set([
  '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66',
  '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98',
]);

/** E.164 (+15555550123) → registrar format (+1.5555550123). Null when it isn't a plausible E.164 number. */
export function registrarPhone(e164: string | null | undefined): string | null {
  const digits = (e164 ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  const cc =
    digits[0] === '1' || digits[0] === '7' ? digits.slice(0, 1) : TWO_DIGIT_CODES.has(digits.slice(0, 2)) ? digits.slice(0, 2) : digits.slice(0, 3);
  return `+${cc}.${digits.slice(cc.length)}`;
}

export function registrantFromSession(session: CheckoutSession) {
  const d = session.customer_details ?? {};
  const a = d.address ?? {};
  const organization = ascii(session.custom_fields?.find((f) => f.key === 'organization')?.text?.value);
  const phone = registrarPhone(d.phone);
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

function orderFromSession(session: CheckoutSession, state: OrderState, at: string, note?: string): Order {
  const meta = session.metadata ?? {};
  return {
    sessionId: session.id,
    domain: meta.domain ?? '',
    years: Number(meta.years ?? '1') || 1,
    amount: { amount: session.amount_total ?? 0, currency: (session.currency ?? 'usd').toUpperCase() },
    cost: { amount: Number(meta.cost_cents ?? '0'), currency: meta.cost_currency ?? 'USD' },
    provider: 'cloudflare',
    state,
    livemode: session.livemode,
    email: session.customer_details?.email ?? undefined,
    ...(note ? { note } : {}),
    createdAt: at,
    updatedAt: at,
  };
}

function mapRegistrarState(state: string | undefined): OrderState {
  switch (state) {
    case 'succeeded':
      return 'registered';
    case 'failed':
      return 'failed';
    case 'action_required':
      return 'action_required';
    case 'blocked':
      return 'needs_review';
    default:
      return 'registering';
  }
}

/**
 * Register (or dry-run) a paid order. Returns the order to record. Throws
 * RetryableError when the registrar can't be reached, so Stripe retries the
 * webhook instead of the order being parked for review. Exported for tests.
 */
export async function fulfil(
  env: CloudflareEnv,
  settings: CheckoutSettings,
  session: CheckoutSession,
  deps: CheckoutDeps,
): Promise<Order> {
  const now = new Date(deps.now?.() ?? Date.now()).toISOString();
  const order = orderFromSession(session, 'paid', now);
  const { domain, years, cost: quotedCost } = order;
  const stop = (note: string): Order => ({ ...order, state: 'needs_review', note });

  if (session.livemode !== settings.direct.realRegistrations) {
    return stop(
      session.livemode
        ? 'Live payment, but the registrar is in sandbox or dry-run mode'
        : 'Test payment, but the registrar is live; refusing to register a real domain',
    );
  }
  if (!DOMAIN_RE.test(domain)) return stop('Session metadata has no valid domain');
  const { registrant, missing } = registrantFromSession(session);
  if (missing.length) return stop(`Registrant details incomplete or not ASCII: ${missing.join(', ')}`);

  const q = await quote(env, domain, deps.fetch);
  if (q.status === 'error') throw new RetryableError(q.message ?? 'Registrar quote failed');
  if (q.status !== 'available' || q.premium || !q.cost) return stop(`No longer registrable (${q.status})`);
  if (q.cost.currency !== quotedCost.currency || q.cost.amount * years > quotedCost.amount) {
    return stop(`Registrar cost rose from ${quotedCost.amount} to ${q.cost.amount * years} ${q.cost.currency}`);
  }

  const request = { domain_name: domain, years, auto_renew: false, privacy_mode: 'redaction', contacts: { registrant } };
  if (!settings.direct.live) {
    return { ...order, state: 'dry_run', note: 'REGISTRAR_LIVE is off; nothing was registered', registrar: { request } };
  }

  const config = cfConfig(env);
  let res: Response;
  try {
    res = await deps.fetch(`${registrarBase(config)}/registrations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json', Prefer: 'respond-async' },
      body: JSON.stringify(request),
    });
  } catch (error) {
    // The request may or may not have reached Cloudflare. One registration per
    // domain makes a retry safe: a duplicate comes back as a failure, not a charge.
    throw new RetryableError(error instanceof Error ? error.message : 'Registration request failed');
  }
  const payload = (await res.json().catch(() => null)) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: { state?: string; completed?: boolean };
  } | null;
  if (!res.ok || !payload?.success) {
    return { ...order, state: 'failed', note: payload?.errors?.[0]?.message ?? `Cloudflare HTTP ${res.status}`, registrar: payload };
  }
  return { ...order, state: mapRegistrarState(payload.result?.state), registrar: payload.result };
}

export async function handleStripeWebhook(
  request: Request,
  env: CloudflareEnv,
  ctx: Ctx,
  deps: CheckoutDeps = { fetch },
): Promise<Response> {
  if (request.method !== 'POST') return json({ received: false }, 405, { Allow: 'POST' });
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ received: false, message: 'Webhook secret not configured.' }, 503);

  const payload = await readLimitedText(request, WEBHOOK_MAX_BYTES);
  if (payload === null) return json({ received: false, message: 'Payload too large.' }, 413);
  const nowMs = deps.now?.() ?? Date.now();
  const ok = await verifyWebhook(payload, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET, { now: nowMs });
  if (!ok) return json({ received: false, message: 'Bad signature.' }, 400);

  const event = JSON.parse(payload) as { type?: string; data?: { object?: CheckoutSession } };
  const session = event.data?.object;
  const paidEvent =
    (event.type === 'checkout.session.completed' && session?.payment_status === 'paid') ||
    event.type === 'checkout.session.async_payment_succeeded';
  if (!paidEvent || !session?.id) return json({ received: true, ignored: event.type });
  if (session.metadata?.source !== SESSION_SOURCE) return json({ received: true, ignored: 'not a wrld.domains session' });

  const existing = await loadOrder(env, session.id);
  if (existing) return json({ received: true, state: existing.state }); // Stripe retries are no-ops.

  // Claim under its own key (the order key is written once, at the end). A
  // fresh claim means another delivery is working on it: ask Stripe to retry.
  // A stale one means an earlier attempt died; fulfilment re-quotes first and
  // Cloudflare allows one registration per domain, so carrying on is safe.
  const claimKey = `claim:${session.id}`;
  const claimedAt = Number((await env.ORDERS?.get(claimKey)) ?? NaN);
  if (Number.isFinite(claimedAt) && nowMs - claimedAt < CLAIM_STALE_MS) {
    return json({ received: false, message: 'Already processing this order.' }, 409);
  }
  await env.ORDERS?.put(claimKey, String(nowMs), { expirationTtl: CLAIM_TTL_SECONDS });

  let order: Order;
  try {
    order = await fulfil(env, checkoutSettings(env), session, deps);
  } catch (error) {
    if (error instanceof RetryableError) {
      console.warn(`Fulfilment deferred for ${session.id}: ${error.message}`);
      return json({ received: false, message: 'Registrar unavailable; retry later.' }, 503);
    }
    order = orderFromSession(
      session,
      'needs_review',
      new Date(nowMs).toISOString(),
      `Fulfilment error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await saveOrder(env, order);
  ctx.waitUntil(notify(env, deps.fetch, order));
  return json({ received: true, state: order.state });
}

// ---- GET /api/checkout/status?session_id= --------------------------------------

/**
 * While a registration is in flight, ask Cloudflare where it stands (at most
 * every 20 seconds, which also keeps the order key under KV's write limit).
 * Returns the updated order, or the original when nothing changed. Exported for tests.
 */
export async function refreshOrder(env: CloudflareEnv, order: Order, deps: CheckoutDeps): Promise<Order> {
  const nowMs = deps.now?.() ?? Date.now();
  if (order.state !== 'registering' || nowMs - Date.parse(order.updatedAt) < STATUS_REFRESH_MS) return order;
  const config = cfConfig(env);
  if (!config.accountId || !config.apiToken) return order;
  try {
    const res = await deps.fetch(`${registrarBase(config)}/registrations/${encodeURIComponent(order.domain)}/registration-status`, {
      headers: { Authorization: `Bearer ${config.apiToken}` },
    });
    const body = (await res.json().catch(() => null)) as { success?: boolean; result?: { state?: string } } | null;
    if (!res.ok || !body?.success) return order;
    const state = mapRegistrarState(body.result?.state);
    const updated: Order = { ...order, state, updatedAt: new Date(nowMs).toISOString(), registrar: body.result };
    await saveOrder(env, updated);
    if (state !== order.state) await notify(env, deps.fetch, updated);
    return updated;
  } catch (error) {
    console.warn('Registration status check failed:', error);
    return order;
  }
}

/** What the success page may show: never contact details or registrar payloads. */
export async function handleCheckoutStatus(request: Request, env: CloudflareEnv, deps: CheckoutDeps = { fetch }): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get('session_id') ?? '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return json({ result: 'error', message: 'Unknown order.' }, 400);
  const stored = await loadOrder(env, sessionId);
  if (!stored) return json({ result: 'pending', state: 'paid' }, 200, { 'Retry-After': '2' });
  const order = await refreshOrder(env, stored, deps);
  return json({ result: 'success', state: order.state, domain: order.domain, years: order.years, livemode: order.livemode });
}
