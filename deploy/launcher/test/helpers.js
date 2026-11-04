'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { finalizeEvent, generateSecretKey, getPublicKey } = require('nostr-tools/pure');

function newKey() {
  const secret = generateSecretKey();
  return { secret, pubkey: getPublicKey(secret) };
}

/** A NIP-98 Authorization header. `overrides` changes the event before signing. */
function signedHeader(key, { url, method, body, createdAt, overrides = {} }) {
  const tags = [['u', url], ['method', method]];
  if (body !== undefined) tags.push(['payload', crypto.createHash('sha256').update(body).digest('hex')]);
  const event = finalizeEvent({
    kind: 27235,
    created_at: createdAt ?? Math.floor(Date.now() / 1000),
    tags,
    content: '',
    ...overrides,
  }, key.secret);
  return `Nostr ${Buffer.from(JSON.stringify(event)).toString('base64')}`;
}

function tempDir(prefix = 'launcher-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

module.exports = { newKey, signedHeader, tempDir };
