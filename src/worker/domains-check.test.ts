// Regression tests for the Worker's /api/domains/check route and routing.
// Runs on Node's built-in runner with native TypeScript stripping (Node 22.6+):
//   npm test
// Nothing here touches the network: upstreams are fakes from test-helpers.ts.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleDomainCheck, parseDomainList, publicResult } from './domains-check.ts';
import { checkoutSettings } from './config.ts';
import { resetRdapCache } from './providers/rdap.ts';
import worker from './index.ts';
import { BOOTSTRAP, baseEnv as env, ctx, fakeFetch, fakeKv, jsonResponse, readEvents } from './test-helpers.ts';

type Env = Parameters<typeof handleDomainCheck>[1];

beforeEach(() => resetRdapCache());

async function post(body: string | null, e: Env = env(), f: typeof fetch = fetch) {
  const request = new Request('https://wrld.domains/api/domains/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const res = await handleDomainCheck(request, e, ctx, { fetch: f });
  return { status: res.status, body: (await res.json()) as { result: string; message?: string; domains?: unknown[] } };
}

const BAD_BODY = 'Send a JSON body with a domains array.';

test('malformed JSON → 400 JSON error', async () => {
  const { status, body } = await post('{not json');
  assert.equal(status, 400);
  assert.equal(body.result, 'error');
  assert.equal(body.message, BAD_BODY);
});

test('JSON null → 400 JSON error, not an unhandled throw', async () => {
  const { status, body } = await post('null');
  assert.equal(status, 400);
  assert.equal(body.message, BAD_BODY);
});

test('non-object JSON (array, string, number) → 400', async () => {
  for (const raw of ['["acme.com"]', '"acme.com"', '42']) {
    const { status, body } = await post(raw);
    assert.equal(status, 400, raw);
    assert.equal(body.message, BAD_BODY, raw);
  }
});

test('missing or empty domains → 400', async () => {
  for (const raw of ['{}', '{"domains":[]}', '{"domains":"acme.com"}', '{"domains":[1, null]}']) {
    const { status, body } = await post(raw);
    assert.equal(status, 400, raw);
    assert.equal(body.message, 'No valid domains to check.', raw);
  }
});

test('invalid domain strings are dropped → 400 when none remain', async () => {
  const { status } = await post('{"domains":["not a domain", "x", "bad_name.com"]}');
  assert.equal(status, 400);
});

test('domain list is trimmed, lowercased, de-duplicated and capped at 20', () => {
  const many = Array.from({ length: 30 }, (_, i) => `name${i}.com`);
  assert.deepEqual(parseDomainList([' ACME.io ', 'acme.io', 'x']), ['acme.io']);
  assert.equal(parseDomainList(many).length, 20);
});

test('no configured provider → 503 JSON', async () => {
  // RDAP needs no credentials, so it has to be ruled out explicitly to reach this path.
  const { status, body } = await post('{"domains":["acme.com","ACME.io "]}', env({ DOMAIN_PROVIDERS: 'whmcs' }));
  assert.equal(status, 503);
  assert.equal(body.result, 'error');
  assert.match(body.message ?? '', /not configured/);
});

test('GET on the check route → 405 with Allow header', async () => {
  const res = await handleDomainCheck(new Request('https://wrld.domains/api/domains/check'), env(), ctx);
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('Allow'), 'POST');
});

const rdapFake = () =>
  fakeFetch([
    ['https://data.iana.org/rdap/dns.json', () => jsonResponse(BOOTSTRAP)],
    ['https://rdap.verisign.com/com/v1/domain/wrldtest.com', () => new Response('', { status: 404 })],
    ['https://rdap.verisign.com/com/v1/domain/google.com', () => jsonResponse({ objectClassName: 'domain' })],
  ]);

test('JSON mode: RDAP fallback answers with source "rdap"', async () => {
  const { status, body } = await post('{"domains":["wrldtest.com","google.com"]}', env(), rdapFake());
  assert.equal(status, 200);
  assert.deepEqual(body.domains, [
    { domain: 'wrldtest.com', status: 'available', source: 'rdap' },
    { domain: 'google.com', status: 'unavailable', source: 'rdap' },
  ]);
});

test('NDJSON mode: start, one result per domain, done', async () => {
  const res = await handleDomainCheck(
    new Request('https://wrld.domains/api/domains/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: '{"domains":["wrldtest.com","google.com","nope.zzz"]}',
    }),
    env(),
    ctx,
    { fetch: rdapFake() },
  );
  assert.equal(res.headers.get('Content-Type'), 'application/x-ndjson; charset=utf-8');
  const events = await readEvents(res);
  assert.equal(events[0].type, 'start');
  assert.equal(events.filter((e) => e.type === 'result').length, 3);
  const zzz = events.find((e) => e.type === 'result' && (e.result as { domain: string }).domain === 'nope.zzz');
  assert.equal((zzz?.result as { status: string }).status, 'error');
  assert.equal(events.at(-1)?.type, 'done');
});

test('prices appear only when direct checkout would charge exactly that', () => {
  const cost = { amount: 1046, currency: 'USD' };
  const direct = env({
    CHECKOUT_MODE: 'both',
    STRIPE_SECRET_KEY: 'sk_test_1',
    STRIPE_WEBHOOK_SECRET: 'whsec_1',
    ORDERS: fakeKv(),
    ORDER_WEBHOOK_URL: 'https://hooks.slack.test/orders',
    CF_ACCOUNT_ID: 'a',
    CF_REGISTRAR_API_TOKEN: 't',
  });
  const on = checkoutSettings(direct);
  assert.equal(on.direct.enabled, true);
  assert.deepEqual(publicResult({ domain: 'a.com', status: 'available', source: 'cloudflare', cost }, direct, on).price, {
    amount: 1346,
    currency: 'USD',
  });
  // .ai has a two-year registry minimum, so quick checkout never prices it.
  assert.equal(publicResult({ domain: 'a.ai', status: 'available', source: 'cloudflare', cost }, direct, on).price, undefined);
  // Premium, RDAP-sourced, taken, or direct checkout off → no price.
  assert.equal(publicResult({ domain: 'a.com', status: 'available', source: 'cloudflare', premium: true, cost }, direct, on).price, undefined);
  assert.equal(publicResult({ domain: 'a.com', status: 'available', source: 'rdap' }, direct, on).price, undefined);
  assert.equal(publicResult({ domain: 'a.com', status: 'unavailable', source: 'cloudflare', cost }, direct, on).price, undefined);
  const off = env({ CF_ACCOUNT_ID: 'a', CF_REGISTRAR_API_TOKEN: 't' });
  assert.equal(publicResult({ domain: 'a.com', status: 'available', source: 'cloudflare', cost }, off, checkoutSettings(off)).price, undefined);
});

test('worker routes /api/domains/check to the handler, unknown /api/* to 404, everything else to assets', async () => {
  const e = env();
  const exec = ctx as unknown as ExecutionContext;
  const check = await worker.fetch(new Request('https://wrld.domains/api/domains/check', { method: 'POST', body: 'null' }), e, exec);
  assert.equal(check.status, 400);
  const missing = await worker.fetch(new Request('https://wrld.domains/api/nope'), e, exec);
  assert.equal(missing.status, 404);
  const page = await worker.fetch(new Request('https://wrld.domains/support'), e, exec);
  assert.equal(await page.text(), 'asset:/support');
});

test('/api/config reports only what is switched on, and never a secret', async () => {
  const exec = ctx as unknown as ExecutionContext;
  const res = await worker.fetch(
    new Request('https://wrld.domains/api/config'),
    env({ CF_ACCOUNT_ID: 'acct', CF_REGISTRAR_API_TOKEN: 'secret-token', STRIPE_SECRET_KEY: 'sk_test_zz' }),
    exec,
  );
  const text = await res.text();
  const config = JSON.parse(text);
  assert.deepEqual(config.availability, { live: true, providers: ['cloudflare', 'rdap'] });
  assert.equal(config.checkout.mode, 'whmcs'); // Stripe alone doesn't switch direct checkout on
  assert.equal(config.suggest.enabled, false);
  assert.equal(text.includes('secret-token') || text.includes('sk_test_zz'), false);
});
