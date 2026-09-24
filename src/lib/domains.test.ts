import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NEW_TLDS, POPULAR_TLDS, buildCandidates } from './domains.ts';

test('buildCandidates keeps the typed domain first and removes duplicates', () => {
  const candidates = buildCandidates({ label: 'wrld', tld: 'com' });
  assert.equal(candidates[0], 'wrld.com');
  assert.equal(candidates.length, 8);
  assert.equal(new Set(candidates).size, candidates.length);
});

test('expanded candidates include newer TLDs up to the Worker limit', () => {
  const candidates = buildCandidates({ label: 'wrld', tld: null }, 20, [...POPULAR_TLDS, ...NEW_TLDS]);
  assert.equal(candidates.length, 20);
  assert.ok(candidates.includes('wrld.design'));
  assert.ok(candidates.includes('wrld.company'));
});
