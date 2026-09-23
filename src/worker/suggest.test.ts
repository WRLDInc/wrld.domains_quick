// AI suggestions: output sanitising, the fallback chain and the route. No network, no model calls.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { chainEngines, sanitizeSuggestions, wordplay, type SuggestEngine } from './suggest-engine.ts';
import { cleanDescription, handleSuggest } from './suggest.ts';
import { resetRdapCache } from './providers/rdap.ts';
import { BOOTSTRAP, baseEnv, ctx, fakeFetch, jsonResponse, readEvents } from './test-helpers.ts';

beforeEach(() => resetRdapCache());

test('sanitize: keeps valid letters-only names on the WRLD TLD list, deduped, reasons trimmed', () => {
  const out = sanitizeSuggestions({
    names: [
      { domain: 'RidgelineHVAC.com', reason: '  Local,   memorable  ' },
      { domain: 'https://www.ridgelinehvac.com/', reason: 'duplicate after normalising' },
      { domain: 'plano-air.com', reason: 'hyphen' },
      { domain: 'air24.com', reason: 'digits' },
      { domain: 'coolplano.xyz', reason: 'not on the list' },
      { domain: 'ab.com', reason: 'too short' },
      { domain: 'fixitfast.co', reason: 'fine' },
      { domain: 42, reason: 'not a string' },
    ],
  });
  assert.deepEqual(out, [
    { domain: 'ridgelinehvac.com', reason: 'Local, memorable' },
    { domain: 'fixitfast.co', reason: 'fine' },
  ]);
});

test('sanitize: accepts JSON text, and anything malformed yields an empty list', () => {
  assert.equal(sanitizeSuggestions('{"names":[{"domain":"brisketbros.com","reason":"x"}]}').length, 1);
  assert.deepEqual(sanitizeSuggestions('not json'), []);
  assert.deepEqual(sanitizeSuggestions({ nope: true }), []);
  assert.deepEqual(sanitizeSuggestions(null), []);
});

test('wordplay: always produces candidates from the description', () => {
  const out = wordplay('Family-owned HVAC company in Plano, TX. Fast emergency repairs.');
  assert.ok(out.length > 0);
  assert.ok(out.every((s) => /^[a-z]+\.(com|net)$/.test(s.domain)));
});

test('engine chain: a failing or empty engine falls through; all failing ends in wordplay', async () => {
  const failing: SuggestEngine = { label: 'claude:x', generate: async () => Promise.reject(new Error('529 overloaded')) };
  const empty: SuggestEngine = { label: 'workers-ai:y', generate: async () => ({ engine: 'workers-ai:y', suggestions: [] }) };
  const good: SuggestEngine = {
    label: 'workers-ai:z',
    generate: async () => ({ engine: 'workers-ai:z', suggestions: [{ domain: 'brisketbros.com', reason: 'r' }] }),
  };
  assert.equal((await chainEngines([failing, good]).generate({ description: 'brisket tacos in austin' })).engine, 'workers-ai:z');
  const fallback = await chainEngines([failing, empty]).generate({ description: 'smoked brisket tacos austin' });
  assert.equal(fallback.engine, 'wordplay');
  assert.ok(fallback.suggestions.length > 0);
});

test('cleanDescription: control characters and runs of whitespace collapse; length is capped', () => {
  assert.equal(cleanDescription('  HVAC\n\n in\tPlano\u0000 '), 'HVAC in Plano');
  assert.equal(cleanDescription('x'.repeat(900)).length, 500);
  assert.equal(cleanDescription(42), '');
});

test('route: 405 on GET, 400 on a thin description, 503 when no engine is configured', async () => {
  const env = baseEnv();
  const get = await handleSuggest(new Request('https://wrld.domains/api/domains/suggest'), env, ctx);
  assert.equal(get.status, 405);
  const stub: SuggestEngine = { label: 'claude:stub', generate: async () => ({ engine: 'claude:stub', suggestions: [] }) };
  const thin = await handleSuggest(
    new Request('https://wrld.domains/api/domains/suggest', { method: 'POST', body: '{"description":"hi"}' }),
    env,
    ctx,
    { fetch, engine: stub },
  );
  assert.equal(thin.status, 400);
  const none = await handleSuggest(
    new Request('https://wrld.domains/api/domains/suggest', { method: 'POST', body: '{"description":"hvac company in plano"}' }),
    env,
    ctx,
    { fetch, engine: null },
  );
  assert.equal(none.status, 503);
});

test('route: streams suggestions, then one availability result per name', async () => {
  const engine: SuggestEngine = {
    label: 'claude:test',
    generate: async () => ({
      engine: 'claude:test',
      suggestions: [
        { domain: 'ridgelinehvac.com', reason: 'Local and plain' },
        { domain: 'google.com', reason: 'Taken, obviously' },
      ],
    }),
  };
  const f = fakeFetch([
    ['https://data.iana.org/rdap/dns.json', () => jsonResponse(BOOTSTRAP)],
    ['https://rdap.verisign.com/com/v1/domain/ridgelinehvac.com', () => new Response('', { status: 404 })],
    ['https://rdap.verisign.com/com/v1/domain/google.com', () => jsonResponse({ objectClassName: 'domain' })],
  ]);
  const res = await handleSuggest(
    new Request('https://wrld.domains/api/domains/suggest', {
      method: 'POST',
      headers: { Accept: 'application/x-ndjson' },
      body: JSON.stringify({ description: 'Family-owned HVAC company in Plano, TX' }),
    }),
    baseEnv(),
    ctx,
    { fetch: f, engine },
  );
  assert.equal(res.headers.get('Content-Type'), 'application/x-ndjson; charset=utf-8');
  const events = await readEvents(res);
  assert.equal(events[0].type, 'suggestions');
  assert.equal(events[0].engine, 'claude:test');
  const results = events.filter((e) => e.type === 'result').map((e) => e.result as { domain: string; status: string });
  assert.deepEqual(
    results.map((r) => [r.domain, r.status]).sort(),
    [
      ['google.com', 'unavailable'],
      ['ridgelinehvac.com', 'available'],
    ],
  );
  assert.equal(events.at(-1)?.type, 'done');
});
