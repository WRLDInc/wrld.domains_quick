// Direct checkout guard rails: session creation, webhook verification, fulfilment. No network.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAIM_STALE_MS,
  RetryableError,
  SESSION_SOURCE,
  ascii,
  fulfil,
  handleCheckoutStatus,
  handleCreateCheckout,
  handleStripeWebhook,
  refreshOrder,
  registrantFromSession,
  registrarPhone,
  type Order,
} from './checkout.ts';
import { checkoutSettings, directAllowsTld } from './config.ts';
import { readJsonObject } from './http.ts';
import { resetProductCache, signPayload } from './stripe.ts';
import { baseEnv, ctx, fakeFetch, fakeKv, jsonResponse } from './test-helpers.ts';

beforeEach(() => resetProductCache());

const NOW = 1_790_000_000_000;
const HOOK = 'https://hooks.slack.test/orders';

function directEnv(overrides: Partial<CloudflareEnv> = {}) {
  return baseEnv({
    CHECKOUT_MODE: 'both',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    ORDERS: fakeKv(),
    ORDER_WEBHOOK_URL: HOOK,
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
  metadata: { source: SESSION_SOURCE, domain: 'acmecorp.com', years: '1', provider: 'cloudflare', cost_cents: '1046', cost_currency: 'USD' },
  customer_details: {
    name: 'Zoë Álvarez',
    email: 'zoe@example.com',
    phone: '+15555550123',
    address: { line1: '123 Main St', line2: 'Ste 4', city: 'Plano', state: 'TX', postal_code: '75024', country: 'US' },
  },
  custom_fields: [{ key: 'organization', text: { value: 'Acme Corp' } }],
};

test('helpers: ASCII transliteration and registrar phone format for any E.164 number', () => {
  assert.equal(ascii('Zoë Álvarez'), 'Zoe Alvarez');
  assert.equal(registrarPhone('+15555550123'), '+1.5555550123');
  assert.equal(registrarPhone('+442071234567'), '+44.2071234567'); // two-digit code
  assert.equal(registrarPhone('+353861234567'), '+353.861234567'); // three-digit code
  assert.equal(registrarPhone('+79161234567'), '+7.9161234567'); // one-digit code
  assert.equal(registrarPhone('12345'), null);
  assert.equal(registrarPhone(null), null);
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

test('settings: Stripe mode must match registrar mode, and order alerts are required', () => {
  assert.equal(checkoutSettings(directEnv()).direct.enabled, true); // test key + sandbox
  const testKeyRealRegistrar = checkoutSettings(directEnv({ CF_REGISTRAR_SANDBOX: 'false', REGISTRAR_LIVE: 'true' }));
  assert.equal(testKeyRealRegistrar.direct.enabled, false);
  assert.match(testKeyRealRegistrar.direct.missing.join(), /test key with a live registrar/);
  const liveKeyDryRun = checkoutSettings(directEnv({ STRIPE_SECRET_KEY: 'sk_live_1' }));
  assert.equal(liveKeyDryRun.direct.enabled, false);
  assert.match(liveKeyDryRun.direct.missing.join(), /live Stripe key without a live registrar/);
  const goLive = checkoutSettings(directEnv({ STRIPE_SECRET_KEY: 'sk_live_1', CF_REGISTRAR_SANDBOX: 'false', REGISTRAR_LIVE: 'true' }));
  assert.equal(goLive.direct.enabled, true);
  assert.equal(goLive.direct.realRegistrations, true);
  assert.deepEqual(checkoutSettings(directEnv({ ORDER_WEBHOOK_URL: undefined })).direct.missing, ['ORDER_WEBHOOK_URL']);
});

test('settings: TLDs with a registry minimum over one year never go through quick checkout', () => {
  const settings = checkoutSettings(directEnv());
  assert.equal(directAllowsTld(settings, 'com'), true);
  assert.equal(directAllowsTld(settings, 'ai'), false);
});

test('create: 503 while direct checkout is switched off', async () => {
  const res = await handleCreateCheckout(
    new Request('https://wrld.domains/api/checkout', { method: 'POST', body: '{"domain":"acmecorp.com"}' }),
    baseEnv(),
  );
  assert.equal(res.status, 503);
});

test('create: re-quotes at the registrar, creates the TLD product, prices and tags the session server-side', async () => {
  const f = fakeFetch([
    [/registrar-sandbox\/domain-check$/, cfCheck(OPEN)],
    [/\/v1\/products\/wrld_domain_com$/, () => jsonResponse({ error: { message: 'No such product' } }, 404)],
    [/\/v1\/products$/, () => jsonResponse({ id: 'wrld_domain_com' })],
    [/\/v1\/checkout\/sessions$/, () => jsonResponse({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })],
  ]);
  const res = await handleCreateCheckout(
    new Request('https://wrld.domains/api/checkout', { method: 'POST', body: '{"domain":"AcmeCorp.com","years":5,"price":1}' }),
    directEnv(),
    { fetch: f, now: () => NOW },
  );
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { url: string }).url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  const session = new URLSearchParams(await f.calls.at(-1)!.text());
  assert.equal(session.get('line_items[0][price_data][product]'), 'wrld_domain_com');
  assert.equal(session.get('line_items[0][price_data][unit_amount]'), '1346'); // 10.46 + 3.00, one year, not the client's numbers
  assert.equal(session.get('metadata[cost_cents]'), '1046');
  assert.equal(session.get('metadata[years]'), '1');
  assert.equal(session.get('metadata[source]'), SESSION_SOURCE);
  assert.equal(session.get('phone_number_collection[enabled]'), 'true');
  assert.equal(session.get('expires_at'), String(NOW / 1000 + 31 * 60));
});

test('create: refuses taken or premium names with a 409, and a registrar outage with a 503', async () => {
  for (const entry of [{ registrable: false, reason: 'domain_unavailable' }, { registrable: true, tier: 'premium' }]) {
    const f = fakeFetch([[/domain-check$/, cfCheck(entry)]]);
    const res = await handleCreateCheckout(
      new Request('https://wrld.domains/api/checkout', { method: 'POST', body: '{"domain":"acmecorp.com"}' }),
      directEnv(),
      { fetch: f },
    );
    assert.equal(res.status, 409, JSON.stringify(entry));
  }
  const down = fakeFetch([[/domain-check$/, () => jsonResponse({ success: false, errors: [{ message: 'Rate limited' }] }, 429)]]);
  const res = await handleCreateCheckout(
    new Request('https://wrld.domains/api/checkout', { method: 'POST', body: '{"domain":"acmecorp.com"}' }),
    directEnv(),
    { fetch: down },
  );
  assert.equal(res.status, 503);
});

test('create: a Stripe failure comes back as JSON, not an unhandled exception', async () => {
  const f = fakeFetch([
    [/domain-check$/, cfCheck(OPEN)],
    [/\/v1\/products\//, () => jsonResponse({ id: 'wrld_domain_com' })],
    [/\/v1\/checkout\/sessions$/, () => jsonResponse({ error: { message: 'Invalid API Key provided' } }, 401)],
  ]);
  const res = await handleCreateCheckout(
    new Request('https://wrld.domains/api/checkout', { method: 'POST', body: '{"domain":"acmecorp.com"}' }),
    directEnv(),
    { fetch: f },
  );
  assert.equal(res.status, 502);
  assert.match(((await res.json()) as { message: string }).message, /couldn’t start checkout/);
});

test('fulfil: dry run by default records the would-be registration and calls nothing', async () => {
  const f = fakeFetch([[/domain-check$/, cfCheck(OPEN)]]);
  const env = directEnv();
  const order = await fulfil(env, checkoutSettings(env), SESSION, { fetch: f, now: () => NOW });
  assert.equal(order.state, 'dry_run');
  assert.equal(f.calls.filter((r) => r.url.endsWith('/registrations')).length, 0);
  assert.equal((order.registrar as { request: { domain_name: string } }).request.domain_name, 'acmecorp.com');
});

test('fulfil: a Stripe/registrar mode mismatch stops for review without registering', async () => {
  const f = fakeFetch([[/domain-check$/, cfCheck(OPEN)]]);
  const env = directEnv({ REGISTRAR_LIVE: 'true' });
  const order = await fulfil(env, checkoutSettings(env), { ...SESSION, livemode: true }, { fetch: f });
  assert.equal(order.state, 'needs_review');
  assert.match(order.note ?? '', /Live payment/);
  assert.equal(f.calls.length, 0);
});

test('fulfil: a cost rise or a taken name stops for review; a registrar outage asks Stripe to retry', async () => {
  const env = directEnv({ REGISTRAR_LIVE: 'true' });
  const pricier = fakeFetch([[/domain-check$/, cfCheck({ ...OPEN, pricing: { currency: 'USD', registration_cost: '12.00' } })]]);
  assert.equal((await fulfil(env, checkoutSettings(env), SESSION, { fetch: pricier })).state, 'needs_review');
  const gone = fakeFetch([[/domain-check$/, cfCheck({ registrable: false, reason: 'domain_unavailable' })]]);
  assert.equal((await fulfil(env, checkoutSettings(env), SESSION, { fetch: gone })).state, 'needs_review');
  assert.equal(pricier.calls.some((r) => r.url.endsWith('/registrations')), false);
  const down = fakeFetch([[/domain-check$/, () => jsonResponse({ success: false, errors: [{ message: 'Rate limited' }] }, 429)]]);
  await assert.rejects(fulfil(env, checkoutSettings(env), SESSION, { fetch: down }), RetryableError);
});

test('fulfil: live mode registers asynchronously with the registrant from Stripe; blocked means review', async () => {
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

  const blocked = fakeFetch([
    [/domain-check$/, cfCheck(OPEN)],
    [/\/registrations$/, () => jsonResponse({ success: true, errors: [], result: { state: 'blocked', completed: false } }, 202)],
  ]);
  assert.equal((await fulfil(env, checkoutSettings(env), SESSION, { fetch: blocked })).state, 'needs_review');
});

async function signed(body: string, secret = 'whsec_test') {
  const t = Math.floor(NOW / 1000);
  return { 'Stripe-Signature': `t=${t},v1=${await signPayload(secret, t, body)}` };
}

const webhook = async (env: CloudflareEnv, body: string, f: typeof fetch, headers?: Record<string, string>, now = NOW) =>
  handleStripeWebhook(
    new Request('https://wrld.domains/api/stripe/webhook', { method: 'POST', body, headers: headers ?? (await signed(body)) }),
    env,
    ctx,
    { fetch: f, now: () => now },
  );

const completed = (session: object) => JSON.stringify({ type: 'checkout.session.completed', data: { object: session } });

test('webhook: bad signature → 400; a paid session is stored once, under KV’s write limit, and retries are no-ops', async () => {
  const env = directEnv();
  const body = completed(SESSION);
  assert.equal((await webhook(env, body, fetch, { 'Stripe-Signature': 't=1,v1=00' })).status, 400);

  const f = fakeFetch([
    [/domain-check$/, cfCheck(OPEN)],
    [HOOK, () => new Response('ok')],
  ]);
  const first = await webhook(env, body, f); // the rate-limited fake KV throws if one key is written twice
  assert.equal(first.status, 200);
  assert.equal(((await first.json()) as { state: string }).state, 'dry_run');
  const again = await webhook(env, body, f);
  assert.equal(((await again.json()) as { state: string }).state, 'dry_run');
  assert.equal(f.calls.filter((r) => r.url.endsWith('/domain-check')).length, 1);

  const status = await handleCheckoutStatus(new Request('https://wrld.domains/api/checkout/status?session_id=cs_test_abc123'), env);
  const shown = (await status.json()) as Record<string, unknown>;
  assert.deepEqual(shown, { result: 'success', state: 'dry_run', domain: 'acmecorp.com', years: 1, livemode: false });
});

test('webhook: a delivery that lands mid-flight gets a 409; after the claim goes stale, fulfilment resumes', async () => {
  const env = directEnv();
  const kv = env.ORDERS as KVNamespace & { store: Map<string, string> };
  kv.store.set(`claim:${SESSION.id}`, String(NOW - 1_000));
  const f = fakeFetch([[/domain-check$/, cfCheck(OPEN)]]);
  assert.equal((await webhook(env, completed(SESSION), f)).status, 409);
  assert.equal(f.calls.length, 0);

  kv.store.set(`claim:${SESSION.id}`, String(NOW - CLAIM_STALE_MS - 1));
  const resumed = await webhook(env, completed(SESSION), f);
  assert.equal(((await resumed.json()) as { state: string }).state, 'dry_run');
});

test('webhook: a registrar outage returns 503 so Stripe retries, and records no order', async () => {
  const env = directEnv();
  const down = fakeFetch([[/domain-check$/, () => jsonResponse({ success: false, errors: [{ message: 'Rate limited' }] }, 429)]]);
  assert.equal((await webhook(env, completed(SESSION), down)).status, 503);
  assert.equal((env.ORDERS as KVNamespace & { store: Map<string, string> }).store.has(`order:${SESSION.id}`), false);
});

test('webhook: sessions from other products on the Stripe account are ignored', async () => {
  const env = directEnv();
  const foreign = { ...SESSION, id: 'cs_test_other', metadata: { domain: 'acmecorp.com' } };
  const f = fakeFetch([]);
  const res = await webhook(env, completed(foreign), f);
  assert.equal(res.status, 200);
  assert.match(((await res.json()) as { ignored: string }).ignored, /not a wrld.domains session/);
  assert.equal(f.calls.length, 0);
});

test('status: an in-flight registration is refreshed from the registrar, at most every 20 seconds', async () => {
  const env = directEnv({ REGISTRAR_LIVE: 'true' });
  const order: Order = {
    sessionId: 'cs_test_abc123',
    domain: 'acmecorp.com',
    years: 1,
    amount: { amount: 1346, currency: 'USD' },
    cost: { amount: 1046, currency: 'USD' },
    provider: 'cloudflare',
    state: 'registering',
    livemode: false,
    createdAt: new Date(NOW - 60_000).toISOString(),
    updatedAt: new Date(NOW - 60_000).toISOString(),
  };
  const f = fakeFetch([
    [/registration-status$/, () => jsonResponse({ success: true, result: { state: 'succeeded', completed: true } })],
    [HOOK, () => new Response('ok')],
  ]);
  const refreshed = await refreshOrder(env, order, { fetch: f, now: () => NOW });
  assert.equal(refreshed.state, 'registered');
  assert.ok(f.calls.some((r) => r.url === HOOK)); // the state change reached the team
  const recent = { ...order, updatedAt: new Date(NOW - 5_000).toISOString() };
  const untouched = await refreshOrder(env, recent, { fetch: f, now: () => NOW });
  assert.equal(untouched, recent);
});

test('status: rejects anything that isn’t a Checkout Session ID', async () => {
  const res = await handleCheckoutStatus(new Request('https://wrld.domains/api/checkout/status?session_id=../../etc'), directEnv());
  assert.equal(res.status, 400);
});

test('body cap: a streamed body without Content-Length is cut off at the limit', async () => {
  const big = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < 20; i++) controller.enqueue(new TextEncoder().encode('x'.repeat(1024)));
      controller.close();
    },
  });
  const request = new Request('https://wrld.domains/api/domains/check', { method: 'POST', body: big, duplex: 'half' } as RequestInit);
  assert.equal(await readJsonObject(request), null);
});
