'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { verifyNip98 } = require('../lib/nip98');

const SIGN = path.join(__dirname, '../sign.js');
const sign = (...args) => execFileSync(process.execPath, [SIGN, ...args], { encoding: 'utf8' }).trim();

test('keygen prints a secret key and its pubkey, and header makes a header the launcher accepts', () => {
  const [secret, pubkey] = sign('keygen').split(' ');
  assert.match(secret, /^[0-9a-f]{64}$/);
  assert.match(pubkey, /^[0-9a-f]{64}$/);
  const url = 'https://launcher.test/api/brains';
  const body = '{"slug":"avi"}';
  const header = sign('header', secret, 'POST', url, body);
  assert.deepEqual(
    verifyNip98({ header, method: 'POST', url, body, now: Math.floor(Date.now() / 1000) }),
    { ok: true, pubkey },
  );
});

test('header with no body has no payload tag, and is accepted for a GET', () => {
  const [secret, pubkey] = sign('keygen').split(' ');
  const url = 'https://launcher.test/api/brains';
  const header = sign('header', secret, 'GET', url);
  assert.deepEqual(verifyNip98({ header, method: 'GET', url, body: '', now: Math.floor(Date.now() / 1000) }), { ok: true, pubkey });
});
