// Provider mapping and chain behaviour. Run with `npm test`; no network.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cloudflareProvider, mapCheckEntry, registrarBase } from './cloudflare.ts';
import { parseBootstrap, rdapProvider, resetRdapCache, RDAP_OVERRIDES } from './rdap.ts';
import { runChain, toPublic } from './index.ts';
import type { AvailabilityProvider, ProviderResult } from './types.ts';
import { BOOTSTRAP, fakeFetch, jsonResponse } from '../test-helpers.ts';

beforeEach(() => resetRdapCache());

test('cloudflare: registrable standard name → available with cost and renewal cost', () => {
  const r = mapCheckEntry('acmecorp.dev', {
    name: 'acmecorp.dev',
    registrable: true,
    tier: 'standard',
    pricing: { currency: 'USD', registration_cost: '10.11', renewal_cost: '10.11' },
  });
  assert.deepEqual(r, {
    domain: 'acmecorp.dev',
    status: 'available',
    source: 'cloudflare',
    premium: undefined,
    cost: { amount: 1011, currency: 'USD' },
    renewalCost: { amount: 1011, currency: 'USD' },
  });
});

test('cloudflare: premium tier or domain_premium → available + premium', () => {
  assert.equal(mapCheckEntry('x.com', { registrable: true, tier: 'premium' }).premium, true);
  const r = mapCheckEntry('y.com', { registrable: false, reason: 'domain_premium' });
  assert.equal(r.status, 'available');
  assert.equal(r.premium, true);
});

test('cloudflare: domain_unavailable → unavailable; extension reasons → error so the chain moves on', () => {
  assert.equal(mapCheckEntry('google.com', { registrable: false, reason: 'domain_unavailable' }).status, 'unavailable');
  for (const reason of ['extension_not_supported_via_api', 'extension_not_supported', 'extension_disallows_registration']) {
    assert.equal(mapCheckEntry('mybrand.uk', { registrable: false, reason }).status, 'error', reason);
  }
  assert.equal(mapCheckEntry('missing.com', undefined).status, 'error');
});

test('cloudflare: sandbox flag switches the base path', () => {
  assert.match(registrarBase({ accountId: 'abc', sandbox: true }), /\/accounts\/abc\/registrar-sandbox$/);
  assert.match(registrarBase({ accountId: 'abc' }), /\/accounts\/abc\/registrar$/);
});

test('cloudflare: one POST per batch, bearer token, results matched by name', async () => {
  const f = fakeFetch([
    [
      /\/registrar\/domain-check$/,
      async (req) => {
        const { domains } = (await req.json()) as { domains: string[] };
        return jsonResponse({
          success: true,
          errors: [],
          result: {
            domains: domains.map((name) =>
              name.startsWith('taken') ? { name, registrable: false, reason: 'domain_unavailable' } : { name, registrable: true, tier: 'standard' },
            ),
          },
        });
      },
    ],
  ]);
  const provider = cloudflareProvider({ accountId: 'acct', apiToken: 'tok' }, f);
  const results = await provider.check(['open.com', 'taken.com']);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].headers.get('Authorization'), 'Bearer tok');
  assert.deepEqual(results.map((r) => r.status), ['available', 'unavailable']);
});

test('cloudflare: API failure marks every domain in the batch as an error', async () => {
  const f = fakeFetch([[/domain-check/, () => jsonResponse({ success: false, errors: [{ message: 'Invalid token' }] }, 403)]]);
  const results = await cloudflareProvider({ accountId: 'a', apiToken: 'bad' }, f).check(['a.com', 'b.com']);
  assert.deepEqual(results.map((r) => [r.status, r.message]), [
    ['error', 'Invalid token'],
    ['error', 'Invalid token'],
  ]);
});

test('rdap: bootstrap parsing prefers https and normalises trailing slashes', () => {
  const map = parseBootstrap({ services: [[['xyz'], ['http://rdap.example/xyz', 'https://rdap.example/xyz']]] });
  assert.equal(map.get('xyz'), 'https://rdap.example/xyz/');
});

test('rdap: 404 → available, 200 → unavailable, 429 → error, unknown TLD → error', async () => {
  const f = fakeFetch([
    ['https://data.iana.org/rdap/dns.json', () => jsonResponse(BOOTSTRAP)],
    ['https://rdap.verisign.com/com/v1/domain/free.com', () => new Response('', { status: 404 })],
    ['https://rdap.verisign.com/com/v1/domain/google.com', () => jsonResponse({ objectClassName: 'domain' })],
    ['https://rdap.verisign.com/com/v1/domain/busy.com', () => new Response('', { status: 429 })],
  ]);
  const results = await rdapProvider(f).check(['free.com', 'google.com', 'busy.com', 'nope.zzz']);
  assert.deepEqual(results.map((r) => [r.domain, r.status]), [
    ['free.com', 'available'],
    ['google.com', 'unavailable'],
    ['busy.com', 'error'],
    ['nope.zzz', 'error'],
  ]);
  assert.ok(results.every((r) => r.source === 'rdap'));
});

test('rdap: verified overrides cover .io/.me/.us; .co stays unsupported', async () => {
  assert.equal(RDAP_OVERRIDES.io, 'https://rdap.identitydigital.services/rdap/');
  assert.equal('co' in RDAP_OVERRIDES, false);
  const f = fakeFetch([
    ['https://data.iana.org/rdap/dns.json', () => jsonResponse(BOOTSTRAP)],
    ['https://rdap.identitydigital.services/rdap/domain/free.io', () => new Response('', { status: 404 })],
  ]);
  const [io, co] = await rdapProvider(f).check(['free.io', 'free.co']);
  assert.equal(io.status, 'available');
  assert.equal(co.status, 'error');
});

function stub(id: AvailabilityProvider['id'], answer: (d: string) => ProviderResult['status'], batchSize = 20): AvailabilityProvider {
  return {
    id,
    batchSize,
    async check(domains) {
      return domains.map((domain) => ({ domain, status: answer(domain), source: id }));
    },
  };
}

test('chain: errors fall through to the next provider; definite answers stream once', async () => {
  const seen: string[] = [];
  const results = await runChain(
    ['a.com', 'b.co', 'c.xyz'],
    [
      stub('cloudflare', (d) => (d.endsWith('.com') ? 'available' : 'error')),
      stub('rdap', (d) => (d.endsWith('.co') ? 'unavailable' : 'error')),
    ],
    (r) => seen.push(`${r.domain}:${r.status}:${r.source}`),
  );
  assert.deepEqual(results.map((r) => [r.domain, r.status, r.source]), [
    ['a.com', 'available', 'cloudflare'],
    ['b.co', 'unavailable', 'rdap'],
    ['c.xyz', 'error', 'rdap'],
  ]);
  assert.deepEqual(seen, ['a.com:available:cloudflare', 'b.co:unavailable:rdap', 'c.xyz:error:rdap']);
});

test('chain: a provider that throws marks its batch as errors instead of failing the request', async () => {
  const boom: AvailabilityProvider = { id: 'whmcs', batchSize: 1, check: async () => Promise.reject(new Error('down')) };
  const results = await runChain(['a.com'], [boom, stub('rdap', () => 'available')]);
  assert.equal(results[0].status, 'available');
  assert.equal(results[0].source, 'rdap');
});

test('toPublic strips the cost basis before anything reaches the browser', () => {
  const pub = toPublic(
    { domain: 'a.com', status: 'available', source: 'cloudflare', cost: { amount: 1046, currency: 'USD' }, renewalCost: { amount: 1046, currency: 'USD' } },
    { amount: 1346, currency: 'USD' },
  );
  assert.deepEqual(pub, { domain: 'a.com', status: 'available', source: 'cloudflare', price: { amount: 1346, currency: 'USD' } });
  assert.equal('cost' in pub, false);
});
