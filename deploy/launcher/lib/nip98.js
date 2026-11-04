'use strict';
const crypto = require('node:crypto');
const { verifyEvent } = require('nostr-tools/pure');

const MAX_HEADER_BYTES = 8192;
const WINDOW_SECONDS = 60;

const refuse = (reason) => ({ ok: false, reason });
const tag = (event, name) => event.tags.find((t) => Array.isArray(t) && t[0] === name)?.[1];

/**
 * Checks a NIP-98 Authorization header against the request it came with.
 * Returns { ok: true, pubkey } or { ok: false, reason }. `now` is seconds since the epoch.
 */
function verifyNip98({ header, method, url, body, now }) {
  if (typeof header !== 'string' || !header.startsWith('Nostr ')) return refuse('no Nostr authorization header');
  if (header.length > MAX_HEADER_BYTES) return refuse('authorization header too long');

  let event;
  try {
    event = JSON.parse(Buffer.from(header.slice('Nostr '.length), 'base64').toString('utf8'));
  } catch {
    return refuse('authorization header is not base64 JSON');
  }
  if (event === null || typeof event !== 'object' || !Array.isArray(event.tags)) return refuse('not a nostr event');
  if (event.kind !== 27235) return refuse('wrong kind');
  // verifyEvent recomputes the id from the event's contents, then checks the signature against it.
  try {
    if (!verifyEvent(event)) return refuse('bad signature');
  } catch {
    return refuse('malformed event');
  }
  if (!Number.isInteger(event.created_at) || Math.abs(now - event.created_at) > WINDOW_SECONDS) return refuse('too old or too far ahead');
  if (tag(event, 'u') !== url) return refuse('wrong url');
  if (tag(event, 'method') !== method) return refuse('wrong method');

  const payload = tag(event, 'payload');
  if (body && body.length > 0) {
    const hash = crypto.createHash('sha256').update(body).digest('hex');
    if (payload !== hash) return refuse('body hash mismatch');
  } else if (payload !== undefined) {
    const emptyHash = crypto.createHash('sha256').update('').digest('hex');
    if (payload !== emptyHash) return refuse('body hash mismatch');
  }
  return { ok: true, pubkey: event.pubkey };
}

module.exports = { verifyNip98 };
