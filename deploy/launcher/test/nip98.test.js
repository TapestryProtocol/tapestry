'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyNip98 } = require('../lib/nip98');
const { newKey, signedHeader } = require('./helpers');

const URL_ = 'https://launcher.test/api/brains';
const key = newKey();
const now = 1800000000;
const base = { method: 'POST', url: URL_, body: '{"slug":"avi"}', now };
const header = (o = {}) => signedHeader(key, { url: URL_, method: 'POST', body: base.body, createdAt: now, ...o });

test('accepts a valid event and returns the signer', () => {
  assert.deepEqual(verifyNip98({ ...base, header: header() }), { ok: true, pubkey: key.pubkey });
});

test('accepts a GET with no body and no payload tag', () => {
  const h = signedHeader(key, { url: URL_, method: 'GET', createdAt: now });
  assert.equal(verifyNip98({ method: 'GET', url: URL_, body: '', now, header: h }).ok, true);
});

test('rejects a missing header', () => {
  assert.equal(verifyNip98({ ...base, header: undefined }).ok, false);
});

test('rejects a header that is not base64 JSON', () => {
  assert.equal(verifyNip98({ ...base, header: 'Nostr not-json!!' }).ok, false);
});

test('rejects a bad signature', () => {
  const event = JSON.parse(Buffer.from(header().slice(6), 'base64').toString());
  const flipped = event.sig[0] === '0' ? '1' : '0';
  event.sig = flipped + event.sig.slice(1);
  const h = `Nostr ${Buffer.from(JSON.stringify(event)).toString('base64')}`;
  assert.equal(verifyNip98({ ...base, header: h }).ok, false);
});

test('rejects an event whose id does not match its contents, even with its original signature', () => {
  const event = JSON.parse(Buffer.from(header().slice(6), 'base64').toString());
  event.tags = [['u', 'https://launcher.test/api/brains'], ['method', 'POST']];
  const h = `Nostr ${Buffer.from(JSON.stringify(event)).toString('base64')}`;
  assert.equal(verifyNip98({ method: 'POST', url: URL_, body: '', now, header: h }).ok, false);
});

test('rejects the wrong URL', () => {
  const h = signedHeader(key, { url: 'https://other.test/api/brains', method: 'POST', body: base.body, createdAt: now });
  assert.equal(verifyNip98({ ...base, header: h }).ok, false);
});

test('rejects the wrong method', () => {
  const h = signedHeader(key, { url: URL_, method: 'DELETE', body: base.body, createdAt: now });
  assert.equal(verifyNip98({ ...base, header: h }).ok, false);
});

test('rejects a body hash mismatch', () => {
  assert.equal(verifyNip98({ ...base, body: '{"slug":"evil"}', header: header() }).ok, false);
});

test('rejects a body with no payload tag', () => {
  const h = signedHeader(key, { url: URL_, method: 'POST', createdAt: now });
  assert.equal(verifyNip98({ ...base, header: h }).ok, false);
});

test('rejects created_at more than 60 seconds old', () => {
  assert.equal(verifyNip98({ ...base, header: header({ createdAt: now - 61 }) }).ok, false);
  assert.equal(verifyNip98({ ...base, header: header({ createdAt: now - 60 }) }).ok, true);
});

test('rejects created_at more than 60 seconds ahead', () => {
  assert.equal(verifyNip98({ ...base, header: header({ createdAt: now + 61 }) }).ok, false);
});

test('rejects the wrong kind', () => {
  const h = signedHeader(key, { url: URL_, method: 'POST', body: base.body, createdAt: now, overrides: { kind: 1 } });
  assert.equal(verifyNip98({ ...base, header: h }).ok, false);
});

test('rejects an oversized header without parsing it', () => {
  assert.equal(verifyNip98({ ...base, header: `Nostr ${'A'.repeat(20000)}` }).ok, false);
});

test('a malformed event is refused, not thrown', () => {
  const event = { kind: 27235, id: 'x', pubkey: 'y', sig: 'z', created_at: now, content: '', tags: [['u', URL_]] };
  const h = `Nostr ${Buffer.from(JSON.stringify(event)).toString('base64')}`;
  assert.equal(verifyNip98({ ...base, header: h }).ok, false);
  const weird = { ...event, tags: [[{}], 7], pubkey: 12, sig: null };
  const h2 = `Nostr ${Buffer.from(JSON.stringify(weird)).toString('base64')}`;
  assert.equal(verifyNip98({ ...base, header: h2 }).ok, false);
});
