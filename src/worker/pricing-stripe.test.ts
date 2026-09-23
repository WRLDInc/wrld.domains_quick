// Pricing policy and the Stripe helpers. No network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MARKUP_CENTS, retailPrice } from './pricing.ts';
import { encodeForm, ensureTldProduct, productIdForTld, resetProductCache, signPayload, stripeClient, verifyWebhook } from './stripe.ts';
import { fakeFetch, jsonResponse } from './test-helpers.ts';

const COST = { amount: 1046, currency: 'USD' };

test('pricing: default is cost + $3.00, and the currency is kept', () => {
  assert.equal(DEFAULT_MARKUP_CENTS, 300);
  assert.deepEqual(retailPrice(COST, {}), { amount: 1346, currency: 'USD' });
});

test('pricing: percent then fixed, rounded up to the cent, times years', () => {
  assert.deepEqual(retailPrice(COST, { PRICE_MARKUP_PERCENT: '10', PRICE_MARKUP_FIXED_CENTS: '0' }), { amount: 1151, currency: 'USD' });
  assert.equal(retailPrice(COST, { PRICE_MARKUP_FIXED_CENTS: '100' }, 2).amount, (1046 + 100) * 2);
});

test('pricing: junk or out-of-range vars fall back or clamp instead of producing nonsense', () => {
  assert.equal(retailPrice(COST, { PRICE_MARKUP_FIXED_CENTS: 'lots' }).amount, 1346);
  assert.equal(retailPrice(COST, { PRICE_MARKUP_FIXED_CENTS: '-500' }).amount, 1046);
  assert.equal(retailPrice(COST, { PRICE_MARKUP_PERCENT: '9999', PRICE_MARKUP_FIXED_CENTS: '0' }).amount, 1046 * 6);
});

test('stripe: nested params flatten to bracket form', () => {
  const body = encodeForm({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', product: 'wrld_domain_com', unit_amount: 1346 } }],
    phone_number_collection: { enabled: true },
    skip: undefined,
  });
  const params = new URLSearchParams(body);
  assert.equal(params.get('mode'), 'payment');
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '1346');
  assert.equal(params.get('phone_number_collection[enabled]'), 'true');
  assert.equal(params.has('skip'), false);
});

test('stripe: product IDs are stable and dot-free', () => {
  assert.equal(productIdForTld('com'), 'wrld_domain_com');
  assert.equal(productIdForTld('co.uk'), 'wrld_domain_co_uk');
});

test('stripe: the TLD product is created on first sale and remembered after', async () => {
  resetProductCache();
  const f = fakeFetch([
    [/\/v1\/products\/wrld_domain_dev$/, () => jsonResponse({ error: { message: 'No such product' } }, 404)],
    [/\/v1\/products$/, () => jsonResponse({ id: 'wrld_domain_dev' })],
  ]);
  const stripe = stripeClient('sk_test_x', f);
  assert.equal(await ensureTldProduct(stripe, 'dev'), 'wrld_domain_dev');
  assert.equal(await ensureTldProduct(stripe, 'dev'), 'wrld_domain_dev');
  assert.deepEqual(f.calls.map((r) => r.method), ['GET', 'POST']);
  const created = new URLSearchParams(await f.calls[1].text());
  assert.equal(created.get('id'), 'wrld_domain_dev');
  assert.equal(created.get('metadata[tld]'), 'dev');
  assert.equal(f.calls[1].headers.get('Idempotency-Key'), 'product-wrld_domain_dev');
});

test('stripe webhook: valid signature passes; tampered, stale or missing fails', async () => {
  const secret = 'whsec_test';
  const payload = JSON.stringify({ type: 'checkout.session.completed' });
  const t = 1_790_000_000;
  const sig = await signPayload(secret, t, payload);
  const now = t * 1000;
  assert.equal(await verifyWebhook(payload, `t=${t},v1=${sig}`, secret, { now }), true);
  assert.equal(await verifyWebhook(`${payload} `, `t=${t},v1=${sig}`, secret, { now }), false);
  assert.equal(await verifyWebhook(payload, `t=${t},v1=${sig}`, secret, { now: now + 301_000 }), false);
  assert.equal(await verifyWebhook(payload, null, secret, { now }), false);
  assert.equal(await verifyWebhook(payload, `t=${t}`, secret, { now }), false);
});
