// Regression tests for the Worker's /api/domains/check route and routing.
// Runs on Node's built-in runner with native TypeScript stripping (Node 22.6+):
//   npm test
// WHMCS is never contacted: every case below is rejected before the client is built.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleDomainCheck } from './domains-check.ts';
import worker from './index.ts';

type Env = Parameters<typeof handleDomainCheck>[1];

const ctx = { waitUntil: () => undefined };

function env(overrides: Partial<Env> = {}): Env {
  const assets = { fetch: async (req: Request) => new Response(`asset:${new URL(req.url).pathname}`) };
  return { ASSETS: assets as unknown as Fetcher, WHMCS_URL: '', WHMCS_API_IDENTIFIER: '', WHMCS_API_SECRET: '', ...overrides };
}

async function post(body: string | null, e: Env = env()) {
  const request = new Request('https://wrld.domains/api/domains/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const res = await handleDomainCheck(request, e, ctx);
  return { status: res.status, body: (await res.json()) as { result: string; message?: string } };
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

test('valid domains without WHMCS secrets → 503 JSON', async () => {
  const { status, body } = await post('{"domains":["acme.com","ACME.io "]}');
  assert.equal(status, 503);
  assert.equal(body.result, 'error');
  assert.match(body.message ?? '', /not configured/);
});

test('GET on the check route → 405 with Allow header', async () => {
  const res = await handleDomainCheck(new Request('https://wrld.domains/api/domains/check'), env(), ctx);
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('Allow'), 'POST');
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
