#!/usr/bin/env node
'use strict';
// For the test scripts: makes a throwaway key, and signs a NIP-98 header with it. People sign with their own extension.
//   node sign.js keygen                               prints "<secret hex> <pubkey hex>"
//   node sign.js header <secret hex> METHOD URL [BODY]  prints the Authorization header's value
const crypto = require('node:crypto');
const { finalizeEvent, generateSecretKey, getPublicKey } = require('nostr-tools/pure');

const [command, secretHex, method, url, body] = process.argv.slice(2);

if (command === 'keygen') {
  const secret = generateSecretKey();
  console.log(`${Buffer.from(secret).toString('hex')} ${getPublicKey(secret)}`);
} else if (command === 'header') {
  const tags = [['u', url], ['method', method]];
  if (body) tags.push(['payload', crypto.createHash('sha256').update(body).digest('hex')]);
  const event = finalizeEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), tags, content: '' }, Buffer.from(secretHex, 'hex'));
  console.log(`Nostr ${Buffer.from(JSON.stringify(event)).toString('base64')}`);
} else {
  console.error('usage: node sign.js keygen | header <secret hex> METHOD URL [BODY]');
  process.exitCode = 2;
}
