// WHMCS cart deep links. No network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartUrl } from './links.ts';

test('register adds the exact domain to the WHMCS cart (domains[] + regperiod)', () => {
  const url = new URL(cartUrl('register', 'acmecorp.com'));
  assert.equal(url.origin + url.pathname, 'https://wrld.host/cart.php');
  assert.equal(url.searchParams.get('a'), 'add');
  assert.equal(url.searchParams.get('domain'), 'register');
  assert.deepEqual(url.searchParams.getAll('domains[]'), ['acmecorp.com']);
  assert.equal(url.searchParams.get('domainsregperiod[acmecorp.com]'), '1');
  assert.equal(url.searchParams.has('query'), false);
});

test('lookup (premium / unchecked) and transfer hand WHMCS a query to check itself', () => {
  for (const url of [new URL(cartUrl('register', 'rare.com', { lookup: true })), new URL(cartUrl('transfer', 'mine.com'))]) {
    assert.equal(url.searchParams.has('domains[]'), false);
    assert.ok(url.searchParams.get('query'));
  }
  assert.equal(new URL(cartUrl('transfer', 'mine.com')).searchParams.get('domain'), 'transfer');
});

test('multi-year registrations carry the period', () => {
  assert.equal(new URL(cartUrl('register', 'acmecorp.com', { years: 3 })).searchParams.get('domainsregperiod[acmecorp.com]'), '3');
});
