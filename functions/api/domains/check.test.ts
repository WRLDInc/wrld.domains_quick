// Regression tests for the request-validation paths of /api/domains/check.
// Runs on Node's built-in runner with native TypeScript stripping (Node 22.6+):
//   npm test
// WHMCS is never contacted: every case below is rejected before the client is built.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './check.ts';

type Handler = (context: {
  request: Request;
  env: Record<string, unknown>;
  waitUntil: (p: Promise<unknown>) => void;
}) => Promise<Response> | Response;

const handler = onRequestPost as unknown as Handler;

async function post(body: string | null, env: Record<string, unknown> = {}) {
  const request = new Request('https://wrld.domains/api/domains/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const res = await handler({ request, env, waitUntil: () => undefined });
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
