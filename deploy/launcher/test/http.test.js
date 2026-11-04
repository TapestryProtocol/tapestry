'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { createHandler } = require('../lib/http');
const { Refusal } = require('../lib/refusal');
const { newKey, signedHeader } = require('./helpers');

const owner = newKey();
const stranger = newKey();
const BASE = 'https://launcher.test';
const PUBLIC_DIR = path.join(__dirname, '../public');

/** A stand-in for the brains service, so these tests are about the HTTP layer alone. */
function fakeBrains() {
  const calls = [];
  const note = (name, value) => async (...args) => { calls.push([name, ...args]); return value; };
  return {
    calls,
    list: () => [{ slug: 'avi', status: 'running' }],
    create: note('create', { slug: 'avi', status: 'creating' }),
    destroy: note('destroy', { slug: 'avi', status: 'running', phase: 'destroying' }),
    restore: note('restore', { slug: 'avi', status: 'stopped', phase: 'restoring' }),
    startFresh: note('startFresh', { slug: 'avi', status: 'creating' }),
    detail(who, slug) {
      if (slug === 'missing') throw new Refusal(404, 'not-found', 'There is no brain named missing.');
      if (who !== owner.pubkey) throw new Refusal(403, 'not-owner', 'Only the owner of this brain can do that.');
      return { slug, status: 'running', neo4jPassword: 'pw', logTail: 'log' };
    },
    publicStatus: (slug) => (slug === 'avi' ? { slug, status: 'running', phase: null, queued: false } : null),
    askAllowed: (domain) => domain === 'avi.launcher.test',
  };
}

async function withServer(fn) {
  const brains = fakeBrains();
  const handler = createHandler({
    brains,
    config: { current: () => ({ baseUrl: BASE }), isAllowed: (p) => p !== stranger.pubkey },
    publicDir: PUBLIC_DIR,
    log: () => {},
  });
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const local = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, { key, body, headers = {}, sign = true, createdAt } = {}) => {
    const h = { ...headers };
    if (key && sign) h.authorization = signedHeader(key, { url: `${BASE}${p}`, method, body, createdAt });
    const res = await fetch(`${local}${p}`, { method, headers: h, body });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, text, json, headers: res.headers };
  };
  try {
    await fn({ call, brains });
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

test('the page is open to anyone, and nothing outside public/ can be read', async () => withServer(async ({ call }) => {
  const page = await call('GET', '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.text, /<script src="\/page\.js"/);
  const script = await call('GET', '/page.js');
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal((await call('GET', '/..%2flib%2fhttp.js')).status, 404);
  assert.equal((await call('GET', '/../lib/http.js')).status, 404);
}));

test('the page says plainly that a brain can be read by anyone with its URL', async () => withServer(async ({ call }) => {
  assert.match((await call('GET', '/')).text, /can be read by anyone with its URL/);
}));

test('no signature, or a bad one, gets 401', async () => withServer(async ({ call, brains }) => {
  assert.equal((await call('GET', '/api/brains')).status, 401);
  assert.equal((await call('GET', '/api/brains', { headers: { authorization: 'Nostr bad' } })).status, 401);
  assert.equal((await call('POST', '/api/brains', { body: '{"slug":"avi"}', headers: { authorization: 'Nostr bad' } })).status, 401);
  assert.equal(brains.calls.length, 0);
}));

test('a stale signature gets 401', async () => withServer(async ({ call }) => {
  const r = await call('GET', '/api/brains', { key: owner, createdAt: Math.floor(Date.now() / 1000) - 120 });
  assert.equal(r.status, 401);
}));

test('a good signature from a key off the allowlist gets 403', async () => withServer(async ({ call, brains }) => {
  assert.equal((await call('GET', '/api/brains', { key: stranger })).status, 403);
  assert.equal((await call('POST', '/api/brains', { key: stranger, body: '{"slug":"avi"}' })).status, 403);
  assert.equal(brains.calls.length, 0);
}));

test('a signature for one url does not work on another', async () => withServer(async ({ call }) => {
  const header = signedHeader(owner, { url: `${BASE}/api/brains/other`, method: 'GET' });
  assert.equal((await call('GET', '/api/brains', { headers: { authorization: header } })).status, 401);
}));

test('the list is for the allowlisted', async () => withServer(async ({ call }) => {
  const r = await call('GET', '/api/brains', { key: owner });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { brains: [{ slug: 'avi', status: 'running' }], you: owner.pubkey });
}));

test('create answers 202, and the owner is the signer, never anything in the body', async () => withServer(async ({ call, brains }) => {
  const r = await call('POST', '/api/brains', { key: owner, body: JSON.stringify({ slug: 'avi', ownerPubkey: stranger.pubkey }) });
  assert.equal(r.status, 202);
  assert.deepEqual(r.json, { slug: 'avi', status: 'creating' });
  assert.deepEqual(brains.calls, [['create', owner.pubkey, 'avi']]);
}));

test('a body that is not JSON gets 400', async () => withServer(async ({ call }) => {
  assert.equal((await call('POST', '/api/brains', { key: owner, body: 'nope' })).status, 400);
}));

test('a body over the limit gets 413', async () => withServer(async ({ call, brains }) => {
  const r = await call('POST', '/api/brains', { key: owner, body: JSON.stringify({ slug: 'a'.repeat(100000) }) });
  assert.equal(r.status, 413);
  assert.equal(brains.calls.length, 0);
}));

test('a refusal keeps its status, code and message', async () => withServer(async ({ call, brains }) => {
  brains.create = async () => { throw new Refusal(409, 'total-cap', 'This box is full.'); };
  const r = await call('POST', '/api/brains', { key: owner, body: '{"slug":"avi"}' });
  assert.equal(r.status, 409);
  assert.deepEqual(r.json, { error: 'total-cap', message: 'This box is full.' });
}));

test('an unexpected error gets a plain 500 with no detail', async () => withServer(async ({ call, brains }) => {
  brains.create = async () => { throw new Error('docker secret detail'); };
  const r = await call('POST', '/api/brains', { key: owner, body: '{"slug":"avi"}' });
  assert.equal(r.status, 500);
  assert.ok(!r.text.includes('secret detail'));
}));

test('detail is signed, and the service decides who sees it', async () => withServer(async ({ call }) => {
  assert.equal((await call('GET', '/api/brains/avi')).status, 401);
  const r = await call('GET', '/api/brains/avi', { key: owner });
  assert.equal(r.status, 200);
  assert.equal(r.json.neo4jPassword, 'pw');
  assert.equal((await call('GET', '/api/brains/avi', { key: { ...stranger, pubkey: stranger.pubkey } })).status, 403);
  assert.equal((await call('GET', '/api/brains/missing', { key: owner })).status, 404);
}));

test('destroy, restore and fresh are signed and reach the service with the signer', async () => withServer(async ({ call, brains }) => {
  assert.equal((await call('DELETE', '/api/brains/avi')).status, 401);
  assert.equal((await call('POST', '/api/brains/avi/restore')).status, 401);
  assert.equal((await call('POST', '/api/brains/avi/fresh')).status, 401);
  assert.equal((await call('DELETE', '/api/brains/avi', { key: owner })).status, 202);
  assert.equal((await call('POST', '/api/brains/avi/restore', { key: owner })).status, 202);
  assert.equal((await call('POST', '/api/brains/avi/fresh', { key: owner })).status, 202);
  assert.deepEqual(brains.calls.map((c) => c.slice(0, 3)), [
    ['destroy', owner.pubkey, 'avi'], ['restore', owner.pubkey, 'avi'], ['startFresh', owner.pubkey, 'avi'],
  ]);
}));

test('the status read needs no signature and holds status words only', async () => withServer(async ({ call }) => {
  const r = await call('GET', '/api/brains/avi/status');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { slug: 'avi', status: 'running', phase: null, queued: false });
  assert.equal((await call('GET', '/api/brains/nope/status')).status, 404);
}));

test('ask answers Caddy: 200 for a running brain, 404 otherwise', async () => withServer(async ({ call }) => {
  assert.equal((await call('GET', '/ask?domain=avi.launcher.test')).status, 200);
  assert.equal((await call('GET', '/ask?domain=nope.launcher.test')).status, 404);
  assert.equal((await call('GET', '/ask')).status, 404);
}));

test('ask refuses anything that came through a proxy, even for a running brain', async () => withServer(async ({ call }) => {
  const r = await call('GET', '/ask?domain=avi.launcher.test', { headers: { 'x-forwarded-for': '203.0.113.9' } });
  assert.equal(r.status, 404);
}));

test('anything else is 404', async () => withServer(async ({ call }) => {
  assert.equal((await call('GET', '/api/nope')).status, 404);
  assert.equal((await call('PUT', '/api/brains', { key: owner, body: '{}' })).status, 404);
  assert.equal((await call('POST', '/api/brains/UPPER/restore', { key: owner })).status, 404);
}));
