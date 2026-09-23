// Direct checkout guard rails: session creation, webhook verification, fulfilment. No network.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ascii, fulfil, handleCheckoutStatus, handleCreateCheckout, handleStripeWebhook, registrantFromSession, registrarPhone } from './checkout.ts';
import { checkoutSettings } from './config.ts';
import { resetProductCache, signPayload } from './stripe.ts';
import { baseEnv, ctx, fakeFetch, fakeKv, jsonResponse } from './test-helpers.ts';

beforeEach(() => resetProductCache());

const NOW = 1_790_000_000_000;

function directEnv(overrides: Partial<CloudflareEnv> = {}) {
  return baseEnv({
    CHECKOUT_MODE: 'both',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    ORDERS: fakeKv(),
    CF_ACCOUNT_ID: 'acct',
    CF_REGISTRAR_API_TOKEN: 'cf_tok',
    CF_REGISTRAR_SANDBOX: 'true',
    ...overrides,
  });
}

const cfCheck = (entry: Record<string, unknown>) => () =>
  jsonResponse({ success: true, errors: [], result: { domains: [{ name: 'acmecorp.com', ...entry }] } });

const OPEN = { registrable: true, tier: 'standard', pricing: { currency: 'USD', registration_cost: '10.46', renewal_cost: '10.46' } };

const SESSION = {
  id: 'cs_test_abc123',
  livemode: false,
  payment_status: 'paid',
  amount_total: 1346,
  currency: 'usd',
  metadata: { domain: 'acmecorp.com', years: '1', provider: 'cloudflare', cost_cents: '1046', cost_currency: 'USD' },
  customer_details: {
    name: 'Zoë Álvarez',
    email: 'zoe@example.com',
    phone: '+15555550123',
    address: { line1: '123 Main St', line2: 'Ste 4', city: 'Plano', state: 'TX', postal_code: '75024', country: 'US' },
  },
  custom_fields: [{ key: 'organization', text: { value: 'Acme Corp' } }],
};

test('helpers: ASCII transliteration and registrar phone format', () => {
  assert.equal(ascii('Zoë Álvarez'), 'Zoe Alvarez');
  assert.equal(registrarPhone('+15555550123', 'US'), '+1.5555550123');
  assert.equal(registrarPhone('+442071234567', 'GB'), '+44.2071234567');
  assert.equal(registrarPhone('+15555550123', 'ZZ'), null);
  assert.equal(registrarPhone(null, 'US'), null);
});

test('registrant: built from Stripe customer details; gaps are reported, not guessed', () => {
  const { registrant, missing } = registrantFromSession(SESSION);
  assert.deepEqual(missing, []);
  assert.equal(registrant.postal_info.name, 'Zoe Alvarez');
  assert.equal(registrant.postal_info.organization, 'Acme Corp');
  assert.equal(registrant.postal_info.address.street, '123 Main St, Ste 4');
  assert.equal(registrant.phone, '+1.5555550123');
  const partial = registrantFromSession({ ...SESSION, customer_details: { email: 'x@y.z' } });
  assert.deepEqual(partial.missing, ['phone', 'name', 'street', 'city', 'country']);
});

test('create: 503 while direct checkout is switched off', async () => {
  const res = await handleCreateCheckout(
    new Request('https://wrld.domains/api/checkout', { method: 'POST', body: '{"domain":"acmecorp.com"}' }),
    baseEnv(),
  );
  assert.equal(res.status, 503);
});

test('create: re-quotes at the registrar, creates the TLD product, prices the session server-side', async () => {
  const f = fakeFetch([
    [/registrar-sandbox\/domain-check$/, cfCheck(OPEN)],
    [/\/v1\/products\/wrld_domain_com$/, () => jsonResponse({ error: { message: 'No such product' } }, 404)],
    [/\/v1\/products$/, () => jsonResponse({ id: 'wrld_domain_com' })],
    [/\/v1\/checkout\/sessions$/, () => jsonResponse({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })],
  ]);
  const res = await handleCreateCheckout(
    new Request('https://wrld.domains/api/checkout', { method: 'POST', body: '{"domain":"AcmeCorp.com","price":1}' }),
    directEnv(),
    { fetch: f, now: () => NOW },
  );
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { url: string }).url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  const session = new URLSearchParams(await f.calls.at(-1)!.text());
  assert.equal(session.get('line_items[0][price_data][product]'), 'wrld_domain_com');
  assert.equal(session.get('line_items[0][price_data][unit_amount]'), '1346'); // 10.46 + 3.00, not the client's number
  assert.equal(session.get('metadata[cost_cents]'), '1046');
  assert.equal(session.get('phone_number_collection[enabled]'), 'true');
  assert.equal(session.get('expires_at'), String(NOW / 1000 + 31 * 60));
});

test('create: refuses taken or premium names with a 409', async () => {
  for (const entry of [{ registrable: false, reason: 'domain_unavailable' }, { registrable: true, tier: 'premium' }]) {
    const f = fakeFetch([[/domain-check$/, cfCheck(entry)]]);
    const res = await handleCreateCheckout(
      new Request('https://wrld.domains/api/checkout', { method: 'POST', body: '{"domain":"acmecorp.com"}' }),
      directEnv(),
      { fetch: f },
    );
    assert.equal(res.status, 409, JSON.stringify(entry));
  }
});

test('fulfil: dry run by default records the would-be registration and calls nothing', async () => {
  const f = fakeFetch([[/domain-check$/, cfCheck(OPEN)]]);
  const env = directEnv();
  const order = await fulfil(env, checkoutSettings(env), SESSION, { fetch: f, now: () => NOW });
  assert.equal(order.state, 'dry_run');
  assert.equal(f.calls.filter((r) => r.url.endsWith('/registrations')).length, 0);
  assert.equal((order.registrar as { request: { domain_name: string } }).request.domain_name, 'acmecorp.com');
});

test('fulfil: a cost rise or a taken name stops for review instead of registering', async () => {
  const env = directEnv({ REGISTRAR_LIVE: 'true' });
  const pricier = fakeFetch([[/domain-check$/, cfCheck({ ...OPEN, pricing: { currency: 'USD', registration_cost: '12.00' } })]]);
  assert.equal((await fulfil(env, checkoutSettings(env), SESSION, { fetch: pricier })).state, 'needs_review');
  const gone = fakeFetch([[/domain-check$/, cfCheck({ registrable: false, reason: 'domain_unavailable' })]]);
  assert.equal((await fulfil(env, checkoutSettings(env), SESSION, { fetch: gone })).state, 'needs_review');
  assert.equal(pricier.calls.some((r) => r.url.endsWith('/registrations')), false);
});

test('fulfil: live mode registers asynchronously with the registrant from Stripe', async () => {
  const f = fakeFetch([
    [/domain-check$/, cfCheck(OPEN)],
    [/\/registrations$/, () => jsonResponse({ success: true, errors: [], result: { state: 'in_progress', completed: false } }, 202)],
  ]);
  const env = directEnv({ REGISTRAR_LIVE: 'true' });
  const order = await fulfil(env, checkoutSettings(env), SESSION, { fetch: f });
  assert.equal(order.state, 'registering');
  const call = f.calls.find((r) => r.url.endsWith('/registrations'))!;
  assert.equal(call.headers.get('Prefer'), 'respond-async');
  const body = (await call.json()) as { domain_name: string; contacts: { registrant: { email: string } } };
  assert.equal(body.domain_name, 'acmecorp.com');
  assert.equal(body.contacts.registrant.email, 'zoe@example.com');
});

async function signed(body: string, secret = 'whsec_test') {
  const t = Math.floor(NOW / 1000);
  return { 'Stripe-Signature': `t=${t},v1=${await signPayload(secret, t, body)}` };
}

test('webhook: bad signature → 400; a paid session is stored once and retries are no-ops', async () => {
  const env = directEnv();
  const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: SESSION } });
  const bad = await handleStripeWebhook(
    new Request('https://wrld.domains/api/stripe/webhook', { method: 'POST', body, headers: { 'Stripe-Signature': 't=1,v1=00' } }),
    env,
    ctx,
    { fetch, now: () => NOW },
  );
  assert.equal(bad.status, 400);

  const f = fakeFetch([[/domain-check$/, cfCheck(OPEN)]]);
  const first = await handleStripeWebhook(
    new Request('https://wrld.domains/api/stripe/webhook', { method: 'POST', body, headers: await signed(body) }),
    env,
    ctx,
    { fetch: f, now: () => NOW },
  );
  assert.equal(((await first.json()) as { state: string }).state, 'dry_run');
  const again = await handleStripeWebhook(
    new Request('https://wrld.domains/api/stripe/webhook', { method: 'POST', body, headers: await signed(body) }),
    env,
    ctx,
    { fetch: f, now: () => NOW },
  );
  assert.equal(((await again.json()) as { state: string }).state, 'dry_run');
  assert.equal(f.calls.filter((r) => r.url.endsWith('/domain-check')).length, 1);

  const status = await handleCheckoutStatus(new Request('https://wrld.domains/api/checkout/status?session_id=cs_test_abc123'), env);
  const shown = (await status.json()) as Record<string, unknown>;
  assert.deepEqual(shown, { result: 'success', state: 'dry_run', domain: 'acmecorp.com', years: 1, livemode: false });
});

test('status: rejects anything that isn’t a Checkout Session ID', async () => {
  const res = await handleCheckoutStatus(new Request('https://wrld.domains/api/checkout/status?session_id=../../etc'), directEnv());
  assert.equal(res.status, 400);
});
